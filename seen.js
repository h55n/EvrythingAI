// seen.js - small record of items already sent, so sections do not repeat day to day
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const FILE = new URL("./.seen/seen.json", import.meta.url);
const KEEP_DAYS = 14;

function norm(v) {
  return String(v || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "").trim();
}

export function loadSeen() {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf-8"));
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    const keep = {};
    for (const [k, t] of Object.entries(data)) {
      if (t <= cutoff) continue;
      keep[k] = t;
      if (!k.startsWith("t:") && !k.startsWith("co:") && !/[./]/.test(k) && k.includes(" ")) keep["t:" + [...words(k)].join(" ")] = t;
    }
    return keep;
  } catch {
    return {};
  }
}

const STOP = new Set("the a an and or of to in on for with from by at is are as its it new this that how why what after over into than their his her says say launches launch unveils rolls out adds raises raised".split(" "));
function words(v) {
  return new Set(String(v || "").toLowerCase().replace(/[^a-z0-9$ ]+/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
}
function similar(a, b) {
  if (a.size < 3 || b.size < 3) return false;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / Math.min(a.size, b.size) >= 0.5;
}

// seen by exact key, or by a headline about the same story from another outlet
export function isSeen(seen, ...keys) {
  if (keys.some(k => k && seen[norm(k)])) return true;
  const tk = Object.keys(seen).filter(k => k.startsWith("t:"));
  if (!tk.length) return false;
  const ws = keys.filter(k => k && !/^https?:/i.test(k) && !k.startsWith("co:")).map(words);
  return ws.some(w => tk.some(k => similar(w, new Set(k.slice(2).split(" ")))));
}

export function filterUnseen(seen, items, keyFn = i => i.url) {
  return items.filter(i => !isSeen(seen, keyFn(i), i.title));
}

export function remember(seen, ...keys) {
  for (const k of keys) {
    if (!k) continue;
    seen[norm(k)] = Date.now();
    if (!/^https?:/i.test(k) && !String(k).startsWith("co:")) seen["t:" + [...words(k)].join(" ")] = Date.now();
  }
}

export function saveSeen(seen) {
  try {
    mkdirSync(new URL("./.seen/", import.meta.url), { recursive: true });
    writeFileSync(FILE, JSON.stringify(seen));
  } catch (err) {
    console.warn("  [warn] could not save seen record:", err.message);
  }
}
