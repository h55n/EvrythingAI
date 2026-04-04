// sources.js — RSS + web data collection
import Parser from "rss-parser";

const parser = new Parser({ timeout: 10000 });

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

async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
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
        summary: (item.contentSnippet || item.content || "").slice(0, 300).trim(),
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
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

export async function collectTools() {
  console.log("  Fetching tool feeds...");
  const results = await Promise.allSettled(TOOL_FEEDS.map(fetchFeed));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}
