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
];

const FUNDING_FEEDS = [
  { name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/" },
  { name: "Crunchbase News",     url: "https://news.crunchbase.com/feed/" },
];

const TOOL_FEEDS = [
  { name: "ProductHunt",   url: "https://www.producthunt.com/feed" },
  { name: "Hacker News Show", url: "https://hnrss.org/show?points=50" },
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
