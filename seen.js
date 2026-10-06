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
    for (const [k, t] of Object.entries(data)) if (t > cutoff) keep[k] = t;
    return keep;
  } catch {
    return {};
  }
}

export function isSeen(seen, ...keys) {
  return keys.some(k => k && seen[norm(k)]);
}

export function filterUnseen(seen, items, keyFn = i => i.url) {
  return items.filter(i => !isSeen(seen, keyFn(i), i.title));
}

export function remember(seen, ...keys) {
  for (const k of keys) if (k) seen[norm(k)] = Date.now();
}

export function saveSeen(seen) {
  try {
    mkdirSync(new URL("./.seen/", import.meta.url), { recursive: true });
    writeFileSync(FILE, JSON.stringify(seen));
  } catch (err) {
    console.warn("  [warn] could not save seen record:", err.message);
  }
}
