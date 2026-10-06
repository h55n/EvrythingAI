// ai.js — Mistral summarization + signal generation
import { Mistral } from "@mistralai/mistralai";

let client;
function getClient() {
  if (!client) client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  return client;
}

const MAX_RETRIES = 5;
const RATE_LIMIT_MAX_RETRIES = 4;
const RETRY_BASE_MS = 3000;
const RATE_LIMIT_RETRY_BASE_MS = 5000;
const RETRY_JITTER_MAX_MS = 1000;
const RETRY_MAX_DELAY_MS = 15000;
const RATE_LIMIT_RETRY_MAX_DELAY_MS = 60000;
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
    } catch { /* ignore */ }
  }

  const msg = err?.message || "";
  const match = msg.match(/Status\s+(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

function getRetryAfterMs(err) {
  const retryAfter =
    err?.headers?.["retry-after"] ??
    err?.response?.headers?.["retry-after"] ??
    err?.response?.headers?.get?.("retry-after");

  if (!retryAfter) return undefined;

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

async function chatWithModel(prompt, model, maxTokens) {
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

const PLACEHOLDER = /^(x|a|b|c|n\/a|tbd|todo|lorem ipsum.*|\.\.\.|—|-)$/i;

function goodText(v, min) {
  return typeof v === "string" && v.trim().length >= min && !PLACEHOLDER.test(v.trim());
}

const NON_LATIN = /[\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

export function looksIncomplete(t) {
  const s = String(t || "").trim();
  if (!s) return true;
  if (NON_LATIN.test(s)) return true;
  if (/\b(a|an|the|of|with|for)\s+[\u2010-\u2015-]/i.test(s) || /(^|\s)[\u2010-\u2015-]\w/.test(s)) return true; // gap where a number was
  if (/\b(on|for|a|an|the|and|or|with|to|of|in|that|which|by|from)$/i.test(s.replace(/[.!?]+$/, ""))) return true; // trailing stopword
  if ((s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length) return true;
  if (/\s{2,}|\.\.\.$|…$/.test(s)) return true;
  return false;
}

function validatePipelineResult(r) {
  if (!r || typeof r !== "object") return "not a JSON object";
  const news = r.news?.items;
  if (!Array.isArray(news) || news.length < 3) return "fewer than 3 news items";
  for (const n of news) {
    if (!goodText(n.headline, 10) || !goodText(n.summary, 30) || !/^https?:\/\//.test(n.url || "")) return "news item incomplete";
  }
  const tools = r.tools?.items;
  if (!Array.isArray(tools) || tools.length < 1) return "no tools";
  for (const t of tools) {
    if (!goodText(t.name, 2) || !goodText(t.description, 15) || !goodText(t.useCase, 15)) return "tool item incomplete";
  }
  for (const n of news) if (looksIncomplete(n.summary) || looksIncomplete(n.headline)) return "news text looks truncated";
  for (const t of tools) if (looksIncomplete(t.description) || looksIncomplete(t.useCase)) return "tool text looks truncated";
  const bullets = r.signal?.bullets;
  if (!Array.isArray(bullets) || bullets.length < 3 || !bullets.every(b => goodText(b, 30))) return "signal incomplete";
  if (r.funding?.items && !Array.isArray(r.funding.items)) return "funding malformed";
  r.funding = { items: (r.funding?.items || []).filter(f => goodText(f.company, 2) && goodText(f.description, 15)) };
  return null;
}

const MODEL_CHAIN = [process.env.MISTRAL_MODEL, "mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"].filter(Boolean);

function isModelNotAllowed(err) {
  const status = getErrorStatus(err);
  const text = `${err?.message || ""} ${typeof err?.body === "string" ? err.body : ""}`;
  return (status === 403 || status === 404) && /tier_not_allowed|not available in your subscription|model.*not found|invalid model/i.test(text);
}

const GEMINI_CHAIN = [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(Boolean);

async function geminiOnce(prompt, model, maxTokens) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens + 2000 },
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    const err = new Error(`Gemini ${model} HTTP ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
  if (!text) throw new Error(`Gemini ${model} returned no text (finish: ${data.candidates?.[0]?.finishReason})`);
  return text;
}

async function chatGemini(prompt, maxTokens) {
  let lastErr;
  for (const m of [...new Set(GEMINI_CHAIN)]) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await geminiOnce(prompt, m, maxTokens);
      } catch (err) {
        lastErr = err;
        const retry = err.status === 429 || err.status >= 500 || err.name === "TimeoutError";
        console.warn(`  [gemini] ${m} attempt ${attempt} failed: ${String(err.message).slice(0, 160)}`);
        if (err.status === 404 || err.status === 403 || err.status === 400) break;
        if (!retry) break;
        await new Promise(r => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw lastErr;
}

const GROQ_CHAIN = [process.env.GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean);

async function groqOnce(prompt, model, maxTokens) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.4, max_tokens: maxTokens + 1500, ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}) }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const err = new Error(`Groq ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    err.retryAfter = Number(res.headers.get("retry-after")) || 0;
    throw err;
  }
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error(`Groq ${model} returned no text`);
  return text;
}

async function chatGroq(prompt, maxTokens) {
  let lastErr;
  for (const m of [...new Set(GROQ_CHAIN)]) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await groqOnce(prompt, m, maxTokens);
      } catch (err) {
        lastErr = err;
        console.warn(`  [groq] ${m} attempt ${attempt} failed: ${String(err.message).slice(0, 200)}`);
        if (err.status === 429 && attempt < 3 && err.retryAfter && err.retryAfter <= 60) {
          await new Promise(r => setTimeout(r, err.retryAfter * 1000 + 500));
          continue;
        }
        if (err.status >= 500 || err.name === "TimeoutError") { await new Promise(r => setTimeout(r, 4000 * attempt)); continue; }
        break;
      }
    }
  }
  throw lastErr;
}

async function chat(prompt, model = "mistral-large-latest", maxTokens = 1500) {
  if (process.env.GROQ_API_KEY) return chatGroq(prompt, maxTokens);
  if (process.env.GEMINI_API_KEY) return chatGemini(prompt, maxTokens);
  const chain = [...new Set([...(model && model !== "mistral-large-latest" ? [model] : []), ...MODEL_CHAIN])];
  let lastErr;
  for (const m of chain) {
    try {
      return await chatWithModel(prompt, m, maxTokens);
    } catch (err) {
      lastErr = err;
      if (!isModelNotAllowed(err)) throw err;
      console.warn(`  [model] ${m} not available on this plan, trying the next one`);
    }
  }
  throw lastErr;
}


// ── Claim guards: every number in a generated line must come from the source text ──
const NUM_RE = /\$?\d[\d.,]*\s?(%|x\b|k\b|m\b|b\b|t\b|million|billion|trillion|thousand|tokens?|params?|parameters)?/gi;
const EXTREME_RE = /\b(trillion|quadrillion)\b/i;

function numTokens(text) {
  return (String(text).match(NUM_RE) || []).map(t => t.replace(/[\s,$]/g, "").toLowerCase()).filter(t => /\d{2,}|[%xkmbt]|million|billion|trillion/.test(t));
}

function isGrounded(text, sourceText) {
  const src = String(sourceText).replace(/[\s,$]/g, "").toLowerCase();
  return numTokens(text).every(t => src.includes(t));
}

export function guardClaims(text, source) {
  if (!text) return text;
  const src = source ? `${source.title} ${source.summary}` : "";
  if (EXTREME_RE.test(text)) return source ? source.title : null;
  if (isGrounded(text, src)) return text;
  console.warn(`  [guard] dropped unsupported figure in: ${String(text).slice(0, 70)}`);
  return source ? (source.summary.split(/(?<=[.!?])\s/)[0] || source.title) : null;
}

// ── Daily pipeline — single batched call ────────────────────────
// Replaces pickTopNews + pickToolDrop (new tools only) + pickFunding + generateSignal
// Reduces 4 sequential Mistral calls to 1, eliminating RPM rate-limit failures.

export async function runPipeline(rawNews, rawFunding, rawTools) {
  console.log(`  AI: running batched pipeline (news=${rawNews.length}, funding=${rawFunding.length}, tools=${rawTools.length})...`);

  const prompt = `You are a senior AI/tech analyst. Process the feed data below and return all four sections in a single JSON response.

── NEWS ITEMS (${rawNews.length} total, showing top 40):
${rawNews.slice(0, 40).map((i, n) => `[${n}] ${i.title} (${i.source})\nURL: ${i.url}\n${i.summary}`).join("\n\n")}

── TOOL/PRODUCT ITEMS (${rawTools.length} total):
${rawTools.slice(0, 30).map((i, n) => `[${n}] ${i.title} (${i.source})\nURL: ${i.url}\n${i.summary}`).join("\n\n")}

── FUNDING/STARTUP ITEMS (${rawFunding.length} total, showing top 40):
(funding handled separately)

Return ONLY valid JSON with exactly these four keys — no markdown, no backticks:

{
  "news": {
    "items": [
      {"headline":"concise rewritten headline","summary":"2 sentence summary of why this matters","source":"Publication name","url":"https://..."}
    ]
  },
  "tools": {
    "items": [
      {"name":"Tool or model name","description":"One sentence — what it does","useCase":"One sentence — best use case for builders","url":"https://...","type":"new"}
    ]
  },
  "funding": {
    "items": [
      {"company":"Company name","amount":"e.g. $50M or unknown","stage":"e.g. Series B","investors":"Lead investor","description":"One line on what the company does"}
    ]
  },
  "signal": {
    "bullets": ["money movement bullet","what to build bullet","what to avoid bullet"]
  }
}

Rules:
- news.items: exactly 3 items — most important AI/tech stories
- tools.items: exactly 3 items — most interesting NEW AI tools or LLMs, each with type:"new"
- funding.items: return [] (funding is handled separately)
- signal.bullets: exactly 3 items — (1) where capital is flowing, (2) what builders should pursue, (3) risk or crowded space to avoid
- url: copy the exact URL line of the item you used; never shorten it, never write "...", never invent one.
- Grounding: every fact and number must come from the item's own text above. Do not add capabilities, numbers, dates or claims that are not stated. If an item's text is too thin to describe, skip it and pick another.
- signal bullets: refer only to companies and trends visible in the items above; no invented counts or round names.
- Be specific. Reference actual companies/products. No filler.`;

  try {
    const raw = await chat(prompt, "mistral-large-latest", 3000);
    const result = safeJSON(raw, null);
    const known = new Set([...rawNews, ...rawTools].map(i => i.url));
    const badUrl = [...(result?.news?.items || []), ...(result?.tools?.items || [])].find(i => !known.has(i.url));
    const placeholder = JSON.stringify(result || {}).match(/\.\.\.|\u2026|details? (are |is )?(not|un)available|not (provided|available|specified)|no (details|information)/i);
    const problem = badUrl ? "item url is not a source url" : placeholder ? "placeholder text in output" : validatePipelineResult(result);
    if (problem) {
      const err = new Error(`AI output rejected: ${problem}`);
      err.code = "ECONNRESET";
      throw err;
    }

    const bySrc = new Map([...rawNews, ...rawTools].map(i => [i.url, i]));
    for (const n of result.news.items) {
      const g = guardClaims(n.summary, bySrc.get(n.url));
      n.summary = g || n.headline;
    }
    result.tools.items = result.tools.items.filter(t => {
      const src = bySrc.get(t.url);
      const d = guardClaims(t.description, src);
      const u = guardClaims(t.useCase, src);
      if (!d || !u) { console.warn(`  [guard] dropped tool with unsupported figures: ${t.name}`); return false; }
      t.description = d; t.useCase = u;
      return true;
    });
    if (result.tools.items.length < 1) throw Object.assign(new Error("AI output rejected: no grounded tools"), { code: "ECONNRESET" });
    for (const b of result.signal.bullets) if (EXTREME_RE.test(b)) throw Object.assign(new Error("AI output rejected: extreme claim in signal"), { code: "ECONNRESET" });

    // Ensure type:"new" on all tool items
    if (result.tools?.items) {
      result.tools.items = result.tools.items.map(item => ({ ...item, type: item.type || "new" }));
    }

    return result;
  } catch (err) {
    console.warn("  ⚠️  Batched pipeline failed:", err.message);
    throw err;
  }
}

// ── Funding & deals — own call, own sources, never empty ───────
const DEAL_RE = /\b(raises?|raised|raising|funding|series [a-e]|seed round|seed|valuation|acquires?|acquired|acquisition|invests?|backed|led by|\$\s?\d+(\.\d+)?\s?(m|b|million|billion))\b/i;

export async function pickFunding(rawFunding, rawNews, seen = {}, isSeenFn = () => false) {
  const AGG_RE = /\b(global|quarter|Q[1-4]|report|index|ranking|statistics|trends?|billion in funding|so far this year|weekly|monthly|recap|roundup)\b/i;
  const pool = [...rawFunding, ...rawNews].filter(i => DEAL_RE.test(`${i.title} ${i.summary}`) && !AGG_RE.test(i.title) && !isSeenFn(seen, i.url, i.title)).slice(0, 25);
  if (pool.length === 0) return { items: [], pool };
  console.log(`  AI: picking funding and deals from ${pool.length} candidates...`);
  const prompt = `Below are recent headlines that mention funding rounds or deals. Pick up to 3 that are each about ONE named company that RAISED a stated amount of money or was acquired, relevant to AI and tech builders and investors. Skip market summaries, quarterly or global statistics, rankings and reports. Use only facts stated in the text. "amount" is the money RAISED, never a valuation. If the text gives only a valuation, offers or talks (not a completed raise), skip that item. If the stage or investor is not stated, write "undisclosed". Investors must be copied in full from the text.

${pool.map((i, n) => `[${n}] ${i.title} (${i.source})\n${i.summary}`).join("\n\n")}

Return ONLY valid JSON, no backticks:
{"items":[{"index":0,"company":"Company name","amount":"e.g. $50M or undisclosed","stage":"e.g. Series B or undisclosed","investors":"lead investor or undisclosed","description":"One line on what the company does and why the deal matters"}]}`;
  try {
    const raw = await chat(prompt, "mistral-large-latest", 1200);
    const parsed = safeJSON(raw, null);
    const items = (parsed?.items || [])
      .filter(f => goodText(f.company, 2) && goodText(f.description, 15))
      .slice(0, 3)
      .filter(f => pool[f.index])
      .map(f => {
        const src = pool[f.index];
        const text = `${src.title} ${src.summary}`;
        const named = text.toLowerCase().includes(String(f.company).toLowerCase().split(/\s+/)[0]);
        const amountOk = !f.amount || /undisclosed|unknown/i.test(f.amount) || isGrounded(f.amount, text);
        const amt = String(f.amount || "");
        const amtNum = amt.replace(/[^0-9a-z.$€£]/gi, "").toLowerCase();
        const valuationOnly = /valuation|valued at|worth/i.test(text) && !/\b(rais(e|es|ed|ing)|secur(e|es|ed)|closes?|closed|lands?|bags?|funding round|series [a-e]|seed)\b/i.test(text);
        const talks = /\b(offers?|in talks|talks to|sources say|reportedly|fielding|considering)\b/i.test(src.title);
        const inv = String(f.investors || "").trim();
        const invOk = inv && !looksIncomplete(inv) && text.toLowerCase().includes(inv.toLowerCase().split(/[,&]| and /)[0].trim().slice(0, 14));
        const clean = v => (/^(undisclosed|unknown|n\/a|none)$/i.test(String(v || "").trim()) ? "" : v);
        return { ...f, named, valuationOnly, talks, stage: clean(f.stage), investors: invOk ? clean(f.investors) : "", amount: amountOk ? f.amount : "undisclosed", description: guardClaims(f.description, src), url: src.url, _key: src.url };
      })
      
      .filter(f => !looksIncomplete(f.description))
      .filter(f => !f.valuationOnly && !f.talks)
      .filter(f => f.named && ((f.amount && !/undisclosed|unknown/i.test(f.amount)) || (f.stage && !/undisclosed|unknown/i.test(f.stage))));
    const fresh = items.filter(f => { const c = String(f.company).toLowerCase().trim(); const first = c.split(/\s+/)[0]; return !isSeenFn(seen, "co:" + c) && !isSeenFn(seen, c) && !(first.length > 3 && (isSeenFn(seen, "co:" + first) || isSeenFn(seen, first))); });
    if (fresh.length) return { items: fresh, pool };
    console.warn("  ⚠️  Funding pick unusable, using headline fallback");
  } catch (err) {
    console.warn("  ⚠️  Funding pick failed, using headline fallback:", err.message);
  }
  // No grounded raise found: leave the section short rather than guess
  return { items: [], pool };
}

// ── Daily useful tool — chosen from a real pool, never skipped ─
export async function pickDailyToolFromPool(pool, seen = {}, isSeenFn = () => false) {
  const fresh = pool.filter(i => !isSeenFn(seen, i.url, i.title) && !NON_LATIN.test(`${i.title} ${i.summary}`)).slice(0, 20);
  if (fresh.length === 0) return null;
  console.log(`  AI: choosing the daily useful tool from ${fresh.length} candidates...`);
  const prompt = `Pick the ONE project or model from this list that is most practically useful for AI builders or founders to try today. Use only what the list says about it.

${fresh.map((i, n) => `[${n}] ${i.title} (${i.source})\n${i.summary}`).join("\n\n")}

Return ONLY valid JSON, no backticks:
{"index":0,"name":"short readable name","tagline":"One sentence on what it does","category":"one or two words","why":"One sentence on why builders should try it"}`;
  let pick = null;
  try {
    const parsed = safeJSON(await chat(prompt, "mistral-large-latest", 600), null);
    const src = fresh[parsed?.index];
    if (src && goodText(parsed.tagline, 15) && goodText(parsed.why, 15) && !looksIncomplete(parsed.tagline) && !looksIncomplete(parsed.why)) {
      pick = { name: goodText(parsed.name, 2) ? parsed.name : src.title, description: parsed.tagline, useCase: parsed.why, category: parsed.category || "", url: src.url, type: "daily", _key: src.url };
    }
  } catch (err) {
    console.warn("  ⚠️  Daily tool pick failed, using the top candidate:", err.message);
  }
  if (!pick) {
    const src = fresh[0];
    pick = { name: src.title.split("/").pop(), description: src.summary.replace(/\s*\(.*$/, "") || src.title, useCase: "Worth a look for builders following this space.", category: src.source, url: src.url, type: "daily", _key: src.url };
  }
  return pick;
}

export async function appendDailyTool(toolsResult, pool = [], seen = {}, isSeenFn = () => false) {
  const daily = await pickDailyToolFromPool(pool, seen, isSeenFn);
  if (!daily) {
    console.warn("  ⚠️  No fresh candidates for the daily tool today");
    return toolsResult;
  }
  return { items: [...(toolsResult?.items || []), daily] };
}

// ── Monthly Wrap (unchanged) ─────────────────────────────────────

export async function generateMonthlyWrap(rawNews, rawFunding, rawTools) {
  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  console.log(`  AI: generating monthly wrap for ${monthName}...`);

  const prompt = `You are a senior AI industry analyst writing a comprehensive monthly wrap-up for ${monthName}. Below is a sample of recent headlines and data from this month's RSS feeds.

NEWS HEADLINES (sample):
${rawNews.slice(0, 50).map((i, n) => `[${n}] ${i.title} (${i.source})`).join("\n")}

FUNDING/STARTUPS (sample):
${rawFunding.slice(0, 30).map((i, n) => `[${n}] ${i.title}`).join("\n")}

TOOLS/PRODUCTS (sample):
${rawTools.slice(0, 20).map((i, n) => `[${n}] ${i.title} (${i.source})`).join("\n")}

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
      "An incumbent will make a major AI acquisition next month.",
    ],
  });
}


// ── Signal built from the final items only, so it cannot drift from the sources ─
const DEAL_WORDS = /\b(acqui\w*|buyout|merger|merge[sd]?|ipo|go(es|ing)? public|takeover|bankrupt\w*|layoffs?|lawsuit|sued?)\b/gi;
export async function generateFinalSignal(news, tools, funding, fallback) {
  const lines = [
    ...(news?.items || []).map(n => `NEWS: ${n.headline}. ${n.summary || ""}`),
    ...(tools?.items || []).map(t => `TOOL: ${t.name}: ${t.description || ""}`),
    ...(funding?.items || []).map(f => `FUNDING: ${f.company} raised ${f.amount}. ${f.description || ""}`),
  ];
  const source = lines.join("\n");
  const prompt = `Write the "signal" for today's AI newsletter using ONLY the items below.

${source}

Return ONLY valid JSON, no backticks: {"bullets":["...","...","..."]}
Exactly 3 bullets: (1) ${(funding?.items || []).length ? "where capital is flowing, based only on the FUNDING items" : "where developer attention is going today, based on the NEWS and TOOL items; do not mention capital, investment or funding"}, (2) what builders should pursue, (3) a risk or crowded space to avoid.
Rules: each bullet is one full sentence of at least 12 words. Name only companies and products listed above. Use only figures listed above. Do not turn offers, talks or valuations into raises, and never say acquisition, merger or IPO unless an item above says it.`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = safeJSON(await chat(prompt, "mistral-large-latest", 700), null);
      const b = r?.bullets;
      if (!Array.isArray(b) || b.length !== 3) continue;
      if (!b.every(x => goodText(x, 30) && !looksIncomplete(x) && !EXTREME_RE.test(x))) continue;
      if (!b.every(x => isGrounded(x, source))) continue;
      const srcLow = source.toLowerCase();
      const badDeal = b.some(x => (x.match(DEAL_WORDS) || []).some(w => !srcLow.includes(w.toLowerCase().slice(0, 5))));
      if (badDeal) continue;
      return { bullets: b };
    } catch (err) {
      console.warn("  ⚠️  Final signal attempt failed:", err.message);
    }
  }
  console.warn("  ⚠️  Final signal fell back to the pipeline signal");
  return fallback;
}
