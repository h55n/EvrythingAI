// index.js — EvrythingAI main pipeline
import "dotenv/config";
import { readFileSync, appendFileSync, mkdirSync, writeFileSync } from "fs";
import { Resend } from "resend";
import { collectNews, collectFunding, collectTools, collectToolPool } from "./sources.js";
import { loadSeen, isSeen, filterUnseen, remember, saveSeen } from "./seen.js";
import { runPipeline, appendDailyTool, pickFunding, generateMonthlyWrap } from "./ai.js";
import { buildEmailHTML, buildEmailText, buildMonthlyHTML, buildMonthlyText } from "./email.js";

// ── Pipeline monitor (local only — gitignored) ─────────────────
const MONITOR_FILE = new URL("./pipeline_monitor.json", import.meta.url);
function logMonitor(entry) {
  try {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n";
    appendFileSync(MONITOR_FILE, line, "utf-8");
  } catch { /* monitor logging is best-effort */ }
}

// ── Top-level error boundary ────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("\n💥  Uncaught exception:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("\n💥  Unhandled rejection:", err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

// ── Env validation ──────────────────────────────────────────────
function validateEnv() {
  const required = [process.env.GROQ_API_KEY ? "GROQ_API_KEY" : process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "MISTRAL_API_KEY", "RESEND_API_KEY", "FROM_EMAIL"];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`\n❌  Missing env vars: ${missing.join(", ")}`);
    console.error("    Copy .env.example → .env and fill in your keys.\n");
    process.exit(1);
  }
}

function isLastDayOfMonth() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.getUTCMonth() !== now.getUTCMonth();
}

// ── Subscriber loading with validation ──────────────────────────
function loadAllSubscribers() {
  let raw;
  try {
    raw = readFileSync(new URL("./subscribers.json", import.meta.url), "utf-8");
  } catch (err) {
    console.warn("⚠️  Could not read subscribers.json:", err.message);
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("⚠️  subscribers.json is not valid JSON:", err.message);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn("⚠️  subscribers.json must be a JSON array");
    return [];
  }

  const valid = [];
  parsed.forEach((entry, i) => {
    if (typeof entry === "string") {
      if (entry.includes("@")) {
        valid.push({ email: entry });
      } else {
        console.warn(`  [skip] subscribers[${i}]: invalid email string "${entry}"`);
      }
      return;
    }

    if (!entry || typeof entry !== "object") {
      console.warn(`  [skip] subscribers[${i}]: not an object`);
      return;
    }

    if (!entry.email || typeof entry.email !== "string" || !entry.email.includes("@")) {
      console.warn(`  [skip] subscribers[${i}]: missing or invalid email`);
      return;
    }

    valid.push({ email: entry.email });
  });

  return valid;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorStatus(err) {
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.response?.status === "number") return err.response.status;
  if (typeof err?.raw_status_code === "number") return err.raw_status_code;
  if (typeof err?.body?.raw_status_code === "number") return err.body.raw_status_code;

  if (typeof err?.body === "string") {
    try {
      const parsed = JSON.parse(err.body);
      if (typeof parsed?.raw_status_code === "number") return parsed.raw_status_code;
    } catch { /* ignore parse failure */ }
  }

  const msg = err?.message || "";
  const match = msg.match(/Status\s+(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

function isRetryableDailyError(err) {
  const status = getErrorStatus(err);
  const message = err?.message || "";
  return (
    err?.code === "NO_EMAIL_SENT" ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    err?.code === "ECONNRESET" ||
    err?.code === "ETIMEDOUT" ||
    /rate limit/i.test(message) ||
    /fetch failed/i.test(message)
  );
}

function getEnvInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const RETRY_JITTER_MIN_MULTIPLIER = 0.7;
const RETRY_JITTER_RANGE_MULTIPLIER = 0.6;
const MAX_BACKOFF_EXPONENT = 10;
const UNLIMITED_RETRIES = 0;
const DEFAULT_DAILY_MAX_RETRIES = 3;
const DEFAULT_DAILY_MAX_ATTEMPTS = DEFAULT_DAILY_MAX_RETRIES + 1;
const AI_CALLS_PER_RUN_PIPELINE = 1;
const AI_CALLS_PER_APPEND_DAILY_TOOL = 1;
const AI_CALLS_CURRENT_TOTAL = AI_CALLS_PER_RUN_PIPELINE + AI_CALLS_PER_APPEND_DAILY_TOOL;
const AI_CALLS_PREVIOUS_TOTAL = 5;

// ── Send emails with per-subscriber error handling ──────────────
async function sendToSubscribers(resend, subscribers, subject, html, text) {
  console.log(`\n📧  Sending to ${subscribers.length} subscriber(s) via Resend...`);

  let successCount = 0;
  let failCount = 0;

  for (const sub of subscribers) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to:   [sub.email],
        subject,
        html,
        text,
      });

      if (error) {
        console.error(`   ❌  Failed for ${sub.email}: ${error.message || JSON.stringify(error)}`);
        failCount++;
      } else {
        console.log(`   ✅  Sent to ${sub.email} (ID: ${data?.id})`);
        successCount++;
      }
    } catch (err) {
      console.error(`   ❌  Exception sending to ${sub.email}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n📊  Results: ${successCount} sent, ${failCount} failed`);
  return { successCount, failCount };
}

// ── Daily pipeline ──────────────────────────────────────────────
async function runDaily(resend, subscribers) {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  console.log(`📅  Date: ${date}\n`);

  console.log("1/3  Collecting raw data from feeds...");
  const seen = loadSeen();
  const [allNews, rawFunding, allTools, toolPool] = await Promise.all([
    collectNews(),
    collectFunding(),
    collectTools(),
    collectToolPool().catch(err => { console.warn("  [warn] tool pool failed:", err.message); return []; }),
  ]);
  const rawNews = filterUnseen(seen, allNews);
  // mix real builder projects (GitHub, Hugging Face) in with Product Hunt / Show HN so the list is not one source
  const mixedTools = [...allTools.filter(t => !/producthunt/i.test(t.source || t.url || "")).slice(0, 15), ...toolPool.slice(0, 20), ...allTools.filter(t => /producthunt/i.test(t.source || t.url || "")).slice(0, 8)];
  const rawTools = filterUnseen(seen, mixedTools);
  console.log(`     Got ${allNews.length} news (${rawNews.length} unseen), ${rawFunding.length} funding, ${allTools.length} tools (${rawTools.length} unseen), ${toolPool.length} pool\n`);

  if (rawNews.length < 3) {
    const err = new Error(`Only ${rawNews.length} news item(s) fetched; feeds are down or rate-limited`);
    err.code = "ECONNRESET";
    throw err;
  }

  console.log("2/3  AI: running batched pipeline (1 Mistral call)...");
  const { news, tools: toolsBase, funding, signal } = await runPipeline(rawNews, rawFunding, rawTools);
  const aiIntegration = {
    version: "batched-v2",
    mistralCalls: {
      current: AI_CALLS_CURRENT_TOTAL,
      previous: AI_CALLS_PREVIOUS_TOTAL,
      runPipeline: AI_CALLS_PER_RUN_PIPELINE,
      appendDailyTool: AI_CALLS_PER_APPEND_DAILY_TOOL,
    },
  };
  console.log(`     Integration active: ${aiIntegration.version} (${aiIntegration.mistralCalls.previous} → ${aiIntegration.mistralCalls.current} Mistral calls)`);
  logMonitor({
    mode: "daily",
    status: "info",
    event: "ai_pipeline_integration",
    ...aiIntegration,
  });

  console.log("3/3  AI: funding and daily useful tool...");
  const fundingPick = await pickFunding(rawFunding, allNews, seen, isSeen);
  const toolsNoDup = { items: (toolsBase?.items || []) };
  const poolFresh = toolPool.filter(p => !toolsNoDup.items.some(t => t.url === p.url));
  const tools = await appendDailyTool(toolsNoDup, poolFresh, seen, isSeen);
  const fundingFinal = { items: fundingPick.items };

  const payload = { news, tools, funding: fundingFinal, signal, date };
  const html = buildEmailHTML(payload);
  const text = buildEmailText(payload);
  const subject = `EvrythingAI — ${date}`;
  if (process.env.TEST_RECIPIENT) { mkdirSync("out", { recursive: true }); writeFileSync("out/issue.html", html); }

  const { successCount, failCount } = await sendToSubscribers(resend, subscribers, subject, html, text);

  logMonitor({ mode: "daily", status: successCount > 0 ? "success" : "failure", subscribers: subscribers.length, sent: successCount, failed: failCount, feedCounts: { news: rawNews.length, funding: rawFunding.length, tools: rawTools.length } });

  if (successCount === 0) {
    console.log("\n💡  Common fixes:");
    console.log("    • FROM_EMAIL domain must be verified in Resend dashboard");
    console.log("    • Free tier: can only send to account owner email");
    const err = new Error("No emails were sent");
    err.code = "NO_EMAIL_SENT";
    throw err;
  }

  // Remember what went out so tomorrow's issue is different
  for (const n of news?.items || []) remember(seen, n.url, n.headline);
  for (const t of tools?.items || []) remember(seen, t.url, t.name);
  for (const f of fundingFinal.items) remember(seen, f._key, f.company);
  saveSeen(seen);

  // Preview
  console.log("\n── CONTENT PREVIEW ─────────────────────────────────────\n");
  console.log("📰  TOP NEWS:");
  (news?.items || []).forEach((item, i) => console.log(`    ${i+1}. ${item.headline}`));
  console.log("\n🔧  TOOLS & MODELS:");
  (tools?.items || []).forEach((item, i) => console.log(`    ${i+1}. ${item.name} — ${item.description}`));
  console.log("\n💰  FUNDING:");
  (fundingFinal?.items || []).forEach(item => console.log(`    • ${item.company}${item.amount ? ` (${item.amount})` : ""}`));
  console.log("\n📡  SIGNAL:");
  const sLabels = ["💰", "🔨", "⚠️"];
  (signal?.bullets || []).forEach((b, i) => console.log(`    ${sLabels[i] || "•"} ${b}`));
  console.log("\n────────────────────────────────────────────────────────\n");
}

// ── Monthly wrap pipeline ───────────────────────────────────────
async function runMonthly(resend, subscribers) {
  const forceMonthly = process.argv.includes("--force") || process.env.FORCE_MONTHLY === "true";
  if (!isLastDayOfMonth() && !forceMonthly) {
    console.log("📅  Not the last day of the month. Exiting cleanly.\n");
    process.exit(0);
  }

  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  console.log(`📅  Monthly Wrap: ${monthLabel}`);
  console.log(`📅  Date: ${date}\n`);

  console.log("1/2  Collecting raw data from feeds...");
  const [rawNews, rawFunding, rawTools] = await Promise.all([
    collectNews(),
    collectFunding(),
    collectTools(),
  ]);
  console.log(`     Got ${rawNews.length} news, ${rawFunding.length} funding, ${rawTools.length} tools\n`);

  console.log("2/2  AI: generating monthly wrap...");
  const wrap = await generateMonthlyWrap(rawNews, rawFunding, rawTools);

  const payload = { wrap, monthLabel, date };
  const html = buildMonthlyHTML(payload);
  const text = buildMonthlyText(payload);
  const subject = `EvrythingAI — ${monthLabel} Monthly Wrap`;

  const { successCount, failCount } = await sendToSubscribers(resend, subscribers, subject, html, text);

  logMonitor({ mode: "monthly", status: successCount > 0 ? "success" : "failure", subscribers: subscribers.length, sent: successCount, failed: failCount, feedCounts: { news: rawNews.length, funding: rawFunding.length, tools: rawTools.length } });

  if (successCount === 0) {
    console.log("\n💡  No emails sent. Check Resend configuration.");
    process.exit(1);
  }

  // Preview
  console.log("\n── MONTHLY WRAP PREVIEW ────────────────────────────────\n");
  console.log("📝  REVIEW:");
  console.log(`    ${wrap?.review || "—"}`);
  console.log("\n💰  TOP FUNDED:");
  (wrap?.topFunded || []).forEach(item => console.log(`    • ${item.company} — ${item.amount}`));
  console.log("\n🔧  BREAKOUT TOOLS:");
  (wrap?.breakoutTools || []).forEach(item => console.log(`    • ${item.name} — ${item.description}`));
  console.log("\n📡  SIGNAL:");
  const mLabels = ["💰", "🔨", "👀", "⚠️", "🔮"];
  (wrap?.signal || []).forEach((b, i) => console.log(`    ${mLabels[i] || "•"} ${b}`));
  console.log("\n────────────────────────────────────────────────────────\n");
}

// ── Main ────────────────────────────────────────────────────────
async function run() {
  const isMonthly = process.argv.includes("--monthly");
  const mode = isMonthly ? "MONTHLY WRAP" : "DAILY";

  console.log("\n╔══════════════════════════════════╗");
  console.log(`║    EvrythingAI Pipeline [${mode}]${mode === "DAILY" ? "  " : ""}║`);
  console.log("╚══════════════════════════════════╝\n");

  validateEnv();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const subscribers = loadAllSubscribers();

  if (subscribers.length === 0) {
    console.error("❌  No valid subscribers found in subscribers.json");
    process.exit(1);
  }

  console.log(`📋  Subscribers: ${subscribers.length}`);
  console.log(`📬  Sending to all subscriber(s):`);
  subscribers.forEach(s => console.log(`    • ${s.email}`));
  console.log("");

  if (isMonthly) {
    await runMonthly(resend, subscribers);
  } else {
    const maxAttempts = getEnvInt("DAILY_RETRY_MAX_ATTEMPTS", DEFAULT_DAILY_MAX_ATTEMPTS);
    const baseDelayMs = Math.max(1000, getEnvInt("DAILY_RETRY_BASE_MS", 15000));
    const maxDelayMs = Math.max(baseDelayMs, getEnvInt("DAILY_RETRY_MAX_DELAY_MS", 300000));

    let attempt = 1;
    while (true) {
      try {
        if (attempt > 1) {
          console.log(`\n🔁  Daily pipeline retry attempt ${attempt}${maxAttempts > 0 ? `/${maxAttempts}` : ""}`);
        }
        await runDaily(resend, subscribers);
        break;
      } catch (err) {
        const retryable = isRetryableDailyError(err);
        const canRetry = retryable && (maxAttempts <= UNLIMITED_RETRIES || attempt < maxAttempts);
        if (!canRetry) throw err;

        const exponent = Math.min(attempt - 1, MAX_BACKOFF_EXPONENT);
        const exponentialMs = Math.min(baseDelayMs * Math.pow(2, exponent), maxDelayMs);
        const jitteredMs = Math.round(
          exponentialMs * (RETRY_JITTER_MIN_MULTIPLIER + Math.random() * RETRY_JITTER_RANGE_MULTIPLIER)
        );
        const delayMs = Math.min(jitteredMs, maxDelayMs);
        const status = getErrorStatus(err);
        console.warn(`\n⚠️  Daily run failed (status=${status ?? "unknown"}, message=${err?.message || "unknown"}). Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        attempt++;
      }
    }
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error("\n💥  Fatal error:", err.message);
  if (err.stack) console.error(err.stack);
  logMonitor({ mode: "unknown", status: "crash", error: err.message });
  process.exit(1);
});
