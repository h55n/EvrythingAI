// ai.js — Mistral summarization + signal generation
import { Mistral } from "@mistralai/mistralai";

let client;
function getClient() {
  if (!client) client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  return client;
}

const MAX_RETRIES = 5;
const RATE_LIMIT_MAX_RETRIES = 9;
const RETRY_BASE_MS = 3000;
const RATE_LIMIT_RETRY_BASE_MS = 5000;
const RETRY_JITTER_MAX_MS = 1000;
const RETRY_MAX_DELAY_MS = 15000;
const RATE_LIMIT_RETRY_MAX_DELAY_MS = 60000;
// Observed in Mistral 429 payloads as `{"code":"1300","type":"rate_limited",...}`.
const MISTRAL_RATE_LIMIT_CODE = "1300";

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

function getRetryAfterMs(err) {
  // SDK/network errors can expose headers either as plain objects or Fetch Headers instances.
  const retryAfter =
    err?.headers?.["retry-after"] ??
    err?.response?.headers?.["retry-after"] ??
    err?.response?.headers?.get?.("retry-after");

  if (!retryAfter) return undefined;

  // Header may be either delta-seconds or HTTP-date.
  const asNumber = Number.parseInt(String(retryAfter), 10);
  if (!Number.isNaN(asNumber) && String(asNumber) === String(retryAfter).trim() && asNumber > 0) {
    return asNumber * 1000;
  }

  const parsedDate = Date.parse(retryAfter);
  if (!Number.isNaN(parsedDate) && parsedDate > Date.now()) {
    return parsedDate - Date.now();
  }

  return undefined;
}

function isMistralRateLimitError(err) {
  const status = getErrorStatus(err);
  const message = err?.message || "";
  return (
    status === 429 ||
    err?.type === "rate_limited" ||
    err?.code === MISTRAL_RATE_LIMIT_CODE ||
    err?.body?.type === "rate_limited" ||
    /rate limit/i.test(message)
  );
}

async function chat(prompt, model = "mistral-large-latest", maxTokens = 1500) {
  let attempt = 1;
  while (true) {
    try {
      const res = await getClient().chat.complete({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        maxTokens,
      });
      return res.choices[0].message.content.trim();
    } catch (err) {
      const status = getErrorStatus(err);
      const message = err?.message || "";
      const isRateLimited = isMistralRateLimitError(err);
      const isRetryable =
        isRateLimited ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        message.includes("fetch failed");
      const maxAttempts = isRateLimited ? RATE_LIMIT_MAX_RETRIES : MAX_RETRIES;

      if (isRetryable && attempt < maxAttempts) {
        const retryAfterMs = getRetryAfterMs(err);
        const baseMs = isRateLimited ? RATE_LIMIT_RETRY_BASE_MS : RETRY_BASE_MS;
        const maxDelayMs = isRateLimited ? RATE_LIMIT_RETRY_MAX_DELAY_MS : RETRY_MAX_DELAY_MS;
        const exponentialMs = Math.min(baseMs * Math.pow(2, attempt - 1), maxDelayMs);
        const jitteredExponentialMs = Math.round(exponentialMs * (0.7 + Math.random() * 0.6));
        const jitterMs = Math.floor(Math.random() * RETRY_JITTER_MAX_MS);
        const delay = retryAfterMs ?? (isRateLimited ? jitteredExponentialMs : (exponentialMs + jitterMs));
        console.warn(`  [retry] Attempt ${attempt}/${maxAttempts} failed (status=${status ?? "unknown"}, message: ${message}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      } else {
        throw err;
      }
    }
  }
}

function safeJSON(raw, fallback) {
  try {
    const clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return fallback;
  }
}

export async function pickTopNews(rawItems) {
  console.log(`  AI: selecting top 3 from ${rawItems.length} news items...`);
  const prompt = `You are an AI/tech editor. Below are recent RSS headlines and snippets. Pick the 3 most important stories specifically about AI, machine learning, LLMs, or major tech industry moves (funding, acquisitions, product launches). Ignore generic tech news unless highly significant.

ITEMS:
${rawItems.slice(0, 40).map((i,n) => `[${n}] ${i.title} (${i.source})\n${i.summary}`).join("\n\n")}

Return ONLY valid JSON, no markdown, no backticks:
{"items":[{"headline":"concise rewritten headline","summary":"2 sentence summary of why this matters","source":"Publication name","url":"https://..."}]}`;

  const raw = await chat(prompt);
  return safeJSON(raw, { items: rawItems.slice(0,3).map(i => ({ headline: i.title, summary: i.summary, source: i.source, url: i.url })) });
}

async function pickDailyTool() {
  console.log("  AI: selecting daily useful tool...");
  const dayTag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for variety
  const prompt = `Today is ${dayTag}. Suggest one genuinely useful tool for AI builders, founders, or investors for daily use. It does not need to be newly launched — just highly practical and underused or worth highlighting today. Pick something different each day.
Categories: productivity, research, dev tools, APIs, automation, analytics, browser extensions, writing, data.
Return ONLY valid JSON, no backticks:
{"name":"Tool name","tagline":"One sentence what it does","category":"category here","url":"https://...","why":"One sentence why builders or investors should use this daily"}`;

  const raw = await chat(prompt, "mistral-large-latest", 500);
  return safeJSON(raw, {
    name: "Notion",
    tagline: "All-in-one workspace for notes, docs, and project management.",
    category: "productivity",
    url: "https://notion.so",
    why: "Centralizes scattered workflows into one searchable, shareable space."
  });
}

export async function pickToolDrop(rawItems) {
  console.log(`  AI: selecting top 3 tools/models from ${rawItems.length} items...`);
  const prompt = `You are a sharp AI tools and models curator. Below are recent items from ProductHunt and HN Show. Pick the 3 most interesting NEW AI tools or newly launched LLMs that builders or investors should know about. Prioritize newly launched LLMs and AI-powered tools.

ITEMS:
${rawItems.slice(0, 30).map((i,n) => `[${n}] ${i.title} (${i.source})\n${i.summary}`).join("\n\n")}

Return ONLY valid JSON, no markdown, no backticks:
{"items":[{"name":"Tool or model name","description":"One sentence — what it does","useCase":"One sentence — best use case for builders","url":"https://..."}]}

Return exactly 3 items.`;

  const raw = await chat(prompt);
  const result = safeJSON(raw, {
    items: rawItems.slice(0,3).map(i => ({
      name: i.title || "—",
      description: i.summary?.slice(0,120) || "",
      useCase: "Useful for AI builders.",
      url: i.url || "#",
    }))
  });
  if (!result.items) {
    result.items = [{
      name: rawItems[0]?.title || "—",
      description: rawItems[0]?.summary?.slice(0,120) || "",
      useCase: "Useful for AI builders.",
      url: rawItems[0]?.url || "#",
    }];
  }

  // Tag existing items as 'new'
  result.items = result.items.map(item => ({ ...item, type: 'new' }));

  // Fetch and append the daily useful tool as 4th item
  try {
    const daily = await pickDailyTool();
    result.items.push({
      name: daily.name || "—",
      description: daily.tagline || "",
      useCase: daily.why || "",
      category: daily.category || "",
      url: daily.url || "#",
      type: "daily",
    });
  } catch (err) {
    console.warn("  ⚠️  Daily tool pick failed, skipping:", err.message);
  }

  return result;
}

export async function pickFunding(rawItems) {
  console.log(`  AI: extracting funding deals from ${rawItems.length} items...`);
  const prompt = `You are an AI startup funding analyst. Below are recent news items. Extract up to 3 AI or tech startup funding rounds, acquisitions, or major partnerships announced recently. Only include items where funding/deal details are clearly mentioned.

ITEMS:
${rawItems.slice(0, 40).map((i,n) => `[${n}] ${i.title}\n${i.summary}`).join("\n\n")}

Return ONLY valid JSON, no markdown, no backticks:
{"items":[{"company":"Company name","amount":"e.g. $50M or unknown","stage":"e.g. Series B or Acquisition","investors":"Lead investor or acquirer","description":"One line on what the company does"}]}

If no clear funding news is found, return {"items":[]}`;

  const raw = await chat(prompt);
  return safeJSON(raw, { items: [] });
}

export async function generateSignal(news, tools, funding) {
  console.log("  AI: generating investor/builder signal...");
  const prompt = `You are a sharp analyst writing for both investors and builders in the AI space. Here is today's intelligence:

TOP NEWS:
${JSON.stringify(news?.items?.slice(0,3), null, 2)}

TOOLS & MODELS:
${JSON.stringify(tools?.items?.slice(0,3), null, 2)}

FUNDING & DEALS:
${JSON.stringify(funding?.items?.slice(0,3), null, 2)}

Write exactly 3 Signal bullet points:
- Bullet 1: Market/money movement — where is capital flowing and why
- Bullet 2: What to build — what opportunity builders should pursue given today's signals
- Bullet 3: What to avoid or watch — risks, crowded spaces, or cautionary signals

Be specific. Reference actual companies or trends from the data above. No generic statements. No filler. Each bullet should be one sharp sentence.

Return ONLY valid JSON, no markdown, no backticks:
{"bullets":["First bullet here","Second bullet here","Third bullet here"]}`;

  try {
    const raw = await chat(prompt);
    return safeJSON(raw, { bullets: [
      "Capital continues flowing into foundation model infrastructure while application-layer startups compete for narrowing margins.",
      "Builders should focus on vertical-specific AI workflows where domain expertise creates defensible moats.",
      "Watch for consolidation pressure on general-purpose AI tools as incumbents ship native integrations."
    ] });
  } catch (err) {
    if (isMistralRateLimitError(err)) {
      console.warn("  ⚠️  Signal fallback: Mistral rate-limited after retries. Continuing with fallback signal.");
      return { bullets: ["Signal unavailable due to rate limiting; see highlights above."] };
    }
    throw err;
  }
}

// ── Monthly Wrap ────────────────────────────────────────────────

export async function generateMonthlyWrap(rawNews, rawFunding, rawTools) {
  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  console.log(`  AI: generating monthly wrap for ${monthName}...`);

  const prompt = `You are a senior AI industry analyst writing a comprehensive monthly wrap-up for ${monthName}. Below is a sample of recent headlines and data from this month's RSS feeds.

NEWS HEADLINES (sample):
${rawNews.slice(0, 50).map((i,n) => `[${n}] ${i.title} (${i.source})`).join("\n")}

FUNDING/STARTUPS (sample):
${rawFunding.slice(0, 30).map((i,n) => `[${n}] ${i.title}`).join("\n")}

TOOLS/PRODUCTS (sample):
${rawTools.slice(0, 20).map((i,n) => `[${n}] ${i.title} (${i.source})`).join("\n")}

Generate a monthly wrap with these sections:

1. "review" — 3–4 sentence summary of what defined this month in AI/tech. Be specific about real events.

2. "topFunded" — Array of 3–5 companies that raised the biggest rounds or had the most significant deals this month. Each: {"company","amount","description"}

3. "breakoutTools" — Array of 3 tools or models that broke out this month (went viral, got massive adoption, or were truly novel). Each: {"name","description","why"}

4. "usefulTools" — Array of 3–5 genuinely useful tools for builders/founders/investors that are worth highlighting from this month. Not necessarily new — just highly practical. Each: {"name","description","category","url","why"}

5. "whatsNext" — 2–3 sentences on what to expect next month based on current trends.

6. "signal" — Array of exactly 5 forward-looking bullet points for next month:
   - Bullet 1: Where money will move
   - Bullet 2: What founders should build
   - Bullet 3: What technology shift to watch
   - Bullet 4: What risk to prepare for
   - Bullet 5: One bold prediction

Be specific. Reference real companies, real products, real trends. No generic statements.

Return ONLY valid JSON, no markdown, no backticks:
{"review":"...","topFunded":[{"company":"...","amount":"...","description":"..."}],"breakoutTools":[{"name":"...","description":"...","why":"..."}],"usefulTools":[{"name":"...","description":"...","category":"...","url":"https://...","why":"..."}],"whatsNext":"...","signal":["bullet1","bullet2","bullet3","bullet4","bullet5"]}`;

  const raw = await chat(prompt, "mistral-large-latest", 3000);
  return safeJSON(raw, {
    review: `${monthName} was defined by continued infrastructure investment and a wave of specialized AI tooling.`,
    topFunded: [{ company: "—", amount: "—", description: "Data unavailable" }],
    breakoutTools: [{ name: "—", description: "—", why: "Data unavailable" }],
    usefulTools: [{ name: "—", description: "—", category: "—", url: "#", why: "Data unavailable" }],
    whatsNext: "The current trajectory suggests continued momentum in AI infrastructure and vertical applications.",
    signal: [
      "Infrastructure plays continue attracting the largest rounds.",
      "Founders should target workflows with high switching costs.",
      "Watch for multimodal model capabilities expanding rapidly.",
      "Prepare for regulatory scrutiny increasing in key markets.",
      "An incumbent will make a major AI acquisition next month."
    ]
  });
}
