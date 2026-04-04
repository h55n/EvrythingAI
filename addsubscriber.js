#!/usr/bin/env node
// addsubscriber.js — CLI to add a subscriber to subscribers.json
// Usage: node addsubscriber.js email@example.com "America/New_York"
//        (timezone is optional, defaults to Asia/Kolkata)

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const SUPPORTED_TIMEZONES = [
  "Asia/Kolkata", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
];

// Basic email regex: must have text@text.text
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUBS_PATH = join(__dirname, "subscribers.json");

const email = process.argv[2];
const timezone = process.argv[3] || DEFAULT_TIMEZONE;

// ── Validate email ──────────────────────────────────────────────
if (!email) {
  console.error('Usage: node addsubscriber.js email@example.com "America/New_York"');
  console.error("       Timezone is optional, defaults to Asia/Kolkata\n");
  console.error("Supported timezones:");
  SUPPORTED_TIMEZONES.forEach(tz => console.error(`  • ${tz}`));
  process.exit(1);
}

if (!EMAIL_REGEX.test(email)) {
  console.error(`❌  Invalid email format: "${email}"`);
  console.error("    Must be a valid email like user@example.com");
  process.exit(1);
}

// ── Validate timezone ───────────────────────────────────────────
try {
  new Intl.DateTimeFormat("en-US", { timeZone: timezone });
} catch {
  console.error(`❌  Invalid timezone: "${timezone}"\n`);
  console.error("Supported timezones:");
  SUPPORTED_TIMEZONES.forEach(tz => console.error(`  • ${tz}`));
  process.exit(1);
}

// ── Load existing list ──────────────────────────────────────────
let subscribers = [];
try {
  const raw = readFileSync(SUBS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.warn("⚠️  subscribers.json was not an array — resetting");
    subscribers = [];
  } else {
    subscribers = parsed.map(entry => {
      if (typeof entry === "string") return { email: entry, timezone: DEFAULT_TIMEZONE };
      if (entry && typeof entry === "object" && entry.email) return entry;
      return null;
    }).filter(Boolean);
  }
} catch {
  subscribers = [];
}

// ── Check for duplicates ────────────────────────────────────────
const existing = subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
if (existing) {
  if (existing.timezone !== timezone) {
    existing.timezone = timezone;
    writeFileSync(SUBS_PATH, JSON.stringify(subscribers, null, 2) + "\n", "utf-8");
    console.log(`🔄  ${email} already subscribed — updated timezone to ${timezone}`);
  } else {
    console.log(`⚠️  ${email} is already subscribed (${timezone}).`);
  }
  process.exit(0);
}

// ── Append and save ─────────────────────────────────────────────
subscribers.push({ email, timezone });
writeFileSync(SUBS_PATH, JSON.stringify(subscribers, null, 2) + "\n", "utf-8");

console.log(`✅  Added ${email} (${timezone}) to subscribers.json`);
console.log(`📬  Total subscribers: ${subscribers.length}`);
