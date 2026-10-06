// sources.js — RSS + web data collection
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; EvrythingAI-Newsletter/1.0; +https://github.com/h55n/EvrythingAI)",
    Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
  },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const RETRY_DELAYS_MS = [3000, 8000, 15000];

function isRetryable(err) {
  const m = err?.message || "";
  return /Status code (429|5\d\d)/.test(m) || /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|timed out/i.test(m);
}

const FEEDS = [
  { name: "TechCrunch AI",   url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "TechCrunch",      url: "https://techcrunch.com/feed/" },
  { name: "Hacker News",     url: "https://hnrss.org/frontpage?points=100" },
  { name: "VentureBeat AI",  url: "https://venturebeat.com/category/ai/feed/" },
  { name: "The Verge Tech",  url: "https://www.theverge.com/rss/index.xml" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/" },
  { name: "Wired AI",        url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "OpenAI News",     url: "https://openai.com/news/rss.xml" },
  { name: "Google AI Blog",  url: "https://blog.google/technology/ai/rss/" },
];

const FUNDING_FEEDS = [
  { name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/" },
  { name: "Crunchbase News",     url: "https://news.crunchbase.com/feed/" },
  { name: "TechCrunch Venture",  url: "https://techcrunch.com/category/venture/feed/" },
  { name: "FinSMEs",             url: "https://www.finsmes.com/feed" },
  { name: "Tech.eu",             url: "https://tech.eu/feed/" },
  { name: "SiliconANGLE",        url: "https://siliconangle.com/category/ai/feed/" },
];

const TOOL_FEEDS = [
  { name: "ProductHunt",   url: "https://www.producthunt.com/feed" },
  { name: "Hacker News Show", url: "https://hnrss.org/show?points=50" },
  { name: "Hacker News Show (new)", url: "https://hnrss.org/show?points=20" },
  { name: "HN open-source AI", url: "https://hnrss.org/newest?q=LLM+OR+%22open+source%22+AI+tool&points=40" },
];

function cleanSummary(text) {
  return text
    .replace(/^(Article URL|Comments URL|Points|# Comments):.*$/gim, "")
    .replace(/^\s*Discussion \| Link\s*$/gim, "")
    .replace(/\s+/g, " ")
    .slice(0, 300)
    .trim();
}

async function parseWithRetry(feed) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await parser.parseURL(feed.url);
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err;
      const wait = RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 1000);
      console.warn(`  [retry] ${feed.name}: ${err.message} - retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

async function fetchFeed(feed) {
  try {
    const result = await parseWithRetry(feed);
    const cutoff = Date.now() - 48 * 60 * 60 * 1000; // last 48h
    return result.items
      .filter(item => {
        if (!item.pubDate && !item.isoDate) return true;
        const d = new Date(item.pubDate || item.isoDate).getTime();
        return isNaN(d) || d > cutoff;
      })
      .slice(0, 8)
      .map(item => ({
        title:   item.title?.trim() || "",
        summary: cleanSummary(item.contentSnippet || item.content || ""),
        url:     item.link || "",
        date:    item.pubDate || item.isoDate || "",
        source:  feed.name,
      }));
  } catch (err) {
    console.warn(`  [warn] Failed to fetch ${feed.name}: ${err.message}`);
    return [];
  }
}

export async function collectNews() {
  console.log("  Fetching news feeds...");
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  // dedupe by URL
  const seen = new Set();
  return items.filter(i => {
    if (!i.url || seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });
}

export async function collectFunding() {
  console.log("  Fetching funding feeds...");
  const results = await Promise.allSettled(FUNDING_FEEDS.map(fetchFeed));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  // dedupe by URL
  const seen = new Set();
  return items.filter(i => {
    if (!i.url || seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });
}

export async function collectTools() {
  console.log("  Fetching tool feeds...");
  const results = await Promise.allSettled(TOOL_FEEDS.map(fetchFeed));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  // dedupe by URL
  const seen = new Set();
  return items.filter(i => {
    if (!i.url || seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });
}

// ── API-based pools: GitHub trending-ish repos and Hugging Face trending models ──
async function getJSON(url, headers = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "EvrythingAI-Newsletter/1.0", Accept: "application/json", ...headers }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === 2) throw err;
    }
    await sleep(2000 * (attempt + 1));
  }
  throw new Error("request failed");
}

export async function collectToolPool() {
  console.log("  Fetching GitHub and Hugging Face pools...");
  const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const gh = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const ghq = q => getJSON(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} created:>${since} stars:>25`)}&sort=stars&order=desc&per_page=12`, gh);
  const [repos, models, repos2, repos3, spaces] = await Promise.allSettled([
    ghq("llm"),
    getJSON("https://huggingface.co/api/models?sort=trendingScore&limit=12"),
    ghq("mcp OR agent"),
    ghq("rag OR \"vector database\" OR \"ai coding\""),
    getJSON("https://huggingface.co/api/spaces?sort=trendingScore&limit=12"),
  ]);
  const out = [];
  for (const rr of [repos, repos2, repos3]) {
    if (rr.status === "fulfilled") {
      for (const r of rr.value.items || []) {
        if (!r.description || out.some(o => o.url === r.html_url)) continue;
        out.push({ title: r.full_name, summary: `${r.description} (${r.stargazers_count} stars, GitHub)`.slice(0, 300), url: r.html_url, date: r.created_at, source: "GitHub" });
      }
    } else console.warn("  [warn] GitHub pool failed:", rr.reason?.message);
  }
  if (spaces.status === "fulfilled") {
    for (const m of spaces.value || []) {
      out.push({ title: m.id, summary: `Trending Hugging Face Space${m.cardData?.title ? `: ${m.cardData.title}` : ""}, ${m.likes ?? 0} likes.`, url: `https://huggingface.co/spaces/${m.id}`, date: m.lastModified || "", source: "Hugging Face Spaces" });
    }
  } else console.warn("  [warn] HF spaces failed:", spaces.reason?.message);
  if (models.status === "fulfilled") {
    for (const m of models.value || []) {
      out.push({ title: m.id, summary: `Trending model on Hugging Face${m.pipeline_tag ? ` (${m.pipeline_tag})` : ""}, ${m.likes ?? 0} likes.`, url: `https://huggingface.co/${m.id}`, date: m.lastModified || "", source: "Hugging Face" });
    }
  } else console.warn("  [warn] Hugging Face pool failed:", models.reason?.message);
  return out;
}
