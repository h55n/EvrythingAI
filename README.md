# EvrythingAI

Automated daily AI & tech newsletter. Fully cloud-hosted, zero PC dependency, 100% free.

**Pipeline:** RSS feeds → Mistral AI curates + summarizes → Signal generated → HTML email via Resend → your inbox every morning at 6am local time.

**Sections in every email:**
- **Top 3 News** — Most important AI/tech stories from the last 24h
- **Tools & Models** — Top 3 new AI tools and LLMs from ProductHunt + HN
- **Funding & Deals** — Significant rounds/acquisitions with deal details
- **Signal** — 3 bullet points: money movement, what to build, what to avoid

---

## Free Stack (zero cost, zero server)

| Service | Role | Free Tier |
|---|---|---|
| GitHub Actions | Runs pipeline hourly (timezone filter) | 2,000 min/month (you use ~60) |
| Mistral AI | Summarization + Signal generation | Free tier available |
| Resend | Sends the HTML email | 3,000 emails/month, 100/day |

Once set up, your PC is completely irrelevant. GitHub's servers run the job automatically.

---

## Color Palette

| Name | HEX | Use |
|---|---|---|
| Apricot | `#FCD9BE` | Page background, cards |
| Chartreuse | `#D6F74C` | Primary accent, CTAs, section labels |
| Vista Blue | `#8C9EFF` | Links, hover states, secondary accent |
| Tomato | `#F06038` | Signal section, highlights, warnings |
| Ink | `#1A1A1A` | All body text |

---

## Setup — 10 minutes, one time

### Step 1 — Get your free API keys

**Mistral (free, no credit card):**
1. Go to https://console.mistral.ai
2. Sign up free
3. API Keys → Create new key
4. Copy it

**Resend (free, no credit card):**
1. Go to https://resend.com
2. Sign up free
3. API Keys → Create new key
4. Copy it

> **Important:** On Resend's free tier (no verified domain), you can only send to the email you signed up with. Verify a domain at resend.com/domains to send to anyone.

---

### Step 2 — Done locally

```bash
cp .env.example .env
# fill in your keys in .env
npm install
npm start           # runs with --force (sends to all subscribers regardless of timezone)
```

---

## Cloud Deployment

### Step 1 — Push to GitHub

```bash
cd evrythingai
git init
git add .
git commit -m "init EvrythingAI"
```

Go to https://github.com/new → create a new repo (can be private) → then:

```bash
git remote add origin https://github.com/YOURNAME/evrythingai.git
git branch -M main
git push -u origin main
```

### Step 2 — Add secrets to GitHub

Go to your repo on GitHub:
**Settings → Secrets and variables → Actions → New repository secret**

Add these 3 secrets:

| Secret name | Value |
|---|---|
| `MISTRAL_API_KEY` | your Mistral key |
| `RESEND_API_KEY` | your Resend key |
| `FROM_EMAIL` | `EvrythingAI <onboarding@resend.dev>` |

> `onboarding@resend.dev` is Resend's official test sender — works immediately with no domain needed.

### Step 3 — Done

The workflow file at `.github/workflows/newsletter.yml` runs **every hour**.

**How timezone delivery works:**
1. GitHub Actions triggers the pipeline every hour on the hour
2. `index.js` loads `subscribers.json` and checks each subscriber's local time
3. Only subscribers whose local time is **6:00am–6:59am** receive the newsletter in that run
4. All other subscribers are skipped (they'll get theirs when it's 6am in *their* timezone)
5. If no subscribers are due, the pipeline exits cleanly with no API calls

**Example:** A subscriber in `Asia/Kolkata` (UTC+5:30) gets their email when the cron fires at 00:30 UTC. A subscriber in `America/New_York` (UTC-4) gets theirs when the cron fires at 10:00 UTC.

> **Important:** `subscribers.json` must be committed to the repo — GitHub Actions reads it from the checkout.

### Trigger manually anytime

GitHub repo → **Actions** tab → **EvrythingAI Daily Newsletter** → **Run workflow** → **Run workflow**

> Manual triggers also respect timezone filtering. Use `node index.js --force` locally to bypass.

### Check logs / debug

GitHub repo → **Actions** tab → click any run → click the **send** job → see full terminal output including which subscribers were skipped/sent, what news was picked, and the Resend email ID.

---

## Files

```
evrythingai/
├── .github/
│   └── workflows/
│       └── newsletter.yml   ← GitHub Actions hourly cron
├── index.js                 ← Main pipeline (timezone-aware)
├── sources.js               ← RSS feed collectors
├── ai.js                    ← Mistral AI summarization + Signal
├── email.js                 ← HTML + plaintext email builder
├── subscribers.json         ← Subscriber list with timezones
├── addsubscriber.js         ← CLI to add subscribers
├── package.json
├── .env.example             ← Copy to .env for local testing
├── .gitignore               ← Keeps .env out of git (important!)
└── README.md
```

---

## How the pipeline works

```
GitHub Actions cron (every hour)
         ↓
index.js — loads subscribers, filters by 6am local time
         ↓ (if any subscribers are due)
RSS feeds (6 news + 2 funding + 2 tool sources)
         ↓
sources.js — fetches last 48h items, dedupes by URL
         ↓
ai.js — Mistral picks best 3 news, 3 tools/models, 2-3 funding deals
         ↓
ai.js — Mistral generates 3-bullet Signal from combined pattern
         ↓
email.js — builds table-based HTML email (works in all clients)
         ↓
index.js — sends via Resend to eligible subscribers
```

---

## Sources

| Section | Feeds |
|---|---|
| Top 3 News | TechCrunch AI, TechCrunch, Hacker News (100+ pts), VentureBeat AI, The Verge, MIT Tech Review |
| Tools & Models | ProductHunt, Hacker News Show (50+ pts) |
| Funding & Deals | TechCrunch Startups, Crunchbase News |
| Signal | 3 bullet points synthesized from all sections by Mistral |

---

## Managing Subscribers

Subscribers are stored in `subscribers.json` — a JSON array of objects with email and timezone.

**Add a subscriber via CLI:**

```bash
node addsubscriber.js hello@example.com "America/New_York"
```

Timezone is optional — defaults to `Asia/Kolkata`:

```bash
node addsubscriber.js hello@example.com
# → adds with timezone Asia/Kolkata
```

**Update a subscriber's timezone:**

```bash
node addsubscriber.js hello@example.com "Europe/London"
# → updates timezone if email already exists
```

**Manually edit subscribers.json:**

```json
[
  { "email": "user1@example.com", "timezone": "Asia/Kolkata" },
  { "email": "user2@example.com", "timezone": "America/New_York" },
  { "email": "user3@example.com", "timezone": "Europe/London" }
]
```

### Supported Timezones

| Timezone | UTC Offset | 6am delivery (UTC) |
|---|---|---|
| `Asia/Kolkata` | UTC+5:30 | 00:30 UTC |
| `Asia/Dubai` | UTC+4 | 02:00 UTC |
| `Asia/Singapore` | UTC+8 | 22:00 UTC |
| `Australia/Sydney` | UTC+10/+11 | 19:00/20:00 UTC |
| `Europe/London` | UTC+0/+1 | 05:00/06:00 UTC |
| `Europe/Paris` | UTC+1/+2 | 04:00/05:00 UTC |
| `America/New_York` | UTC-5/-4 | 10:00/11:00 UTC |
| `America/Chicago` | UTC-6/-5 | 11:00/12:00 UTC |
| `America/Los_Angeles` | UTC-8/-7 | 13:00/14:00 UTC |

> Any valid IANA timezone works (Node.js uses `Intl.DateTimeFormat`). The table above lists recommended ones.

> **Remember:** After adding subscribers, commit and push `subscribers.json` so GitHub Actions can read it.

---

## Troubleshooting

**Email not arriving?**
→ Check Actions tab — did the run succeed? Look at the logs.
→ Check spam folder.
→ Make sure the subscriber's email matches the Resend account email (free tier).

**"You can only send to your own email" error**
→ Resend free tier restriction. Verify a domain at resend.com/domains to unlock sending to anyone.

**Mistral API errors**
→ Verify your MISTRAL_API_KEY secret is correct in GitHub Secrets (no extra spaces).

**Run shows "No subscribers due for delivery"**
→ Normal! The hourly cron only sends to subscribers whose local time is 6am. Check the logs to see which timezones were evaluated.

**Run shows as skipped**
→ GitHub sometimes skips scheduled Actions on repos with no recent activity. Trigger manually once to reactivate, or push a small commit.

---

## Phase 2 — Scale up

1. Verify your own domain at resend.com/domains (free with any domain)
2. Update `FROM_EMAIL` secret to `EvrythingAI <hello@yourdomain.com>`
3. Add subscriber emails with timezones to `subscribers.json`
4. Consider Resend Audiences for large lists (1000+ subscribers)

---

## Cost

| Item | Cost |
|---|---|
| GitHub Actions | Free (well within limits) |
| Mistral API | Free tier |
| Resend | Free (3,000 emails/month) |
| **Total** | **$0/month** |
