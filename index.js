// index.js — EvrythingAI main pipeline
import "dotenv/config";
import { readFileSync, appendFileSync } from "fs";
import { Resend } from "resend";
import { collectNews, collectFunding, collectTools } from "./sources.js";
import { pickTopNews, pickToolDrop, pickFunding, generateSignal, generateMonthlyWrap } from "./ai.js";
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
  const required = ["MISTRAL_API_KEY", "RESEND_API_KEY", "FROM_EMAIL"];
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
    // Support old string format
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

const RETRY_JITTER_MIN_FACTOR = 0.7;
const RETRY_JITTER_RANGE_FACTOR = 0.6;
const MAX_BACKOFF_EXPONENT = 10;



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

  console.log("1/5  Collecting raw data from feeds...");
  const [rawNews, rawFunding, rawTools] = await Promise.all([
    collectNews(),
    collectFunding(),
    collectTools(),
  ]);
  console.log(`     Got ${rawNews.length} news, ${rawFunding.length} funding, ${rawTools.length} tools\n`);

  console.log("2/5  AI: selecting top news...");
  const news = await pickTopNews(rawNews);

  console.log("3/5  AI: selecting tools & models...");
  const tools = await pickToolDrop(rawTools);

  console.log("4/5  AI: extracting funding deals...");
  const funding = await pickFunding([...rawFunding, ...rawNews]);

  console.log("5/5  AI: generating investor/builder signal...");
  const signal = await generateSignal(news, tools, funding);

  const payload = { news, tools, funding, signal, date };
  const html = buildEmailHTML(payload);
  const text = buildEmailText(payload);
  const subject = `EvrythingAI — ${date}`;

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

  // Preview
  console.log("\n── CONTENT PREVIEW ─────────────────────────────────────\n");
  console.log("📰  TOP NEWS:");
  (news?.items || []).forEach((item, i) => console.log(`    ${i+1}. ${item.headline}`));
  console.log("\n🔧  TOOLS & MODELS:");
  (tools?.items || []).forEach((item, i) => console.log(`    ${i+1}. ${item.name} — ${item.description}`));
  console.log("\n💰  FUNDING:");
  (funding?.items || []).forEach(item => console.log(`    • ${item.company}${item.amount ? ` (${item.amount})` : ""}`));
  console.log("\n📡  SIGNAL:");
  const sLabels = ["💰", "🔨", "⚠️"];
  (signal?.bullets || []).forEach((b, i) => console.log(`    ${sLabels[i] || "•"} ${b}`));
  console.log("\n────────────────────────────────────────────────────────\n");
}

// ── Monthly wrap pipeline ───────────────────────────────────────
async function runMonthly(resend, subscribers) {
  // Guard: only run on the actual last day of the month
  // Can be bypassed with --force flag or FORCE_MONTHLY=true env var
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
    // 0 means unlimited retries for daily runs.
    const maxAttempts = getEnvInt("DAILY_RETRY_MAX_ATTEMPTS", 0);
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
        const canRetry = retryable && (maxAttempts <= 0 || attempt < maxAttempts);
        if (!canRetry) throw err;

        const exponent = Math.min(attempt - 1, MAX_BACKOFF_EXPONENT);
        const exponentialMs = Math.min(baseDelayMs * Math.pow(2, exponent), maxDelayMs);
        // Jitter range: min..(min+range), currently 70%..130%, to reduce synchronized retry spikes.
        const jitteredMs = Math.round(
          exponentialMs * (RETRY_JITTER_MIN_FACTOR + Math.random() * RETRY_JITTER_RANGE_FACTOR)
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

run().catch(err => {
  console.error("\n💥  Fatal error:", err.message);
  if (err.stack) console.error(err.stack);
  logMonitor({ mode: "unknown", status: "crash", error: err.message });
  process.exit(1);
});
