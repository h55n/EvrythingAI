// email.js — HTML email templates (table-based, inline CSS)
// ─────────────────────────────────────────────────────────────────
// MINIMAL WARM PALETTE:
//   --espresso:     #5A2916  (logo "AI", strong accents)
//   --eau-trouble:  #B79B68  (section labels, dividers, borders)
//   --terre-cuite:  #A5503A  (Signal bg, funding amounts, highlights)
//   --bleu-porce:   #88B8CE  (links, tool category badge, source tags)
//   --nuage:        #F2F0F0  (page bg, card fills — light mode)
//   --miel:         #F1C766  (badges, CTA elements)
//   --ink:          #1C1C1C  (all body text — light mode)
//   --cream:        #FAF8F5  (outer wrapper — light mode)
//
// DARK MODE (via @media prefers-color-scheme):
//   --dark-bg:      #18102B  (Haiti — outer wrapper)
//   --dark-card:    #1E1530  (card fills)
//   --dark-text:    #F2F0F0  (body text)
//   Eau Trouble, Terre Cuite, Bleu Porcelaine, Miel stay the same.
//
// FONTS: Playfair Display (display/headers), DM Mono (labels), Lora (body)
// ─────────────────────────────────────────────────────────────────


// ── Escaping: feed and AI text must never break or inject into the HTML ──
function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeUrl(v) {
  const u = String(v ?? "").trim();
  return /^https?:\/\//i.test(u) ? esc(u) : "#";
}

function sanitize(value, key = "") {
  if (typeof value === "string") return key === "url" ? safeUrl(value) : esc(value);
  if (Array.isArray(value)) return value.map(v => sanitize(v, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, k)]));
  }
  return value;
}

// ── Shared helpers ──────────────────────────────────────────────
const FONTS_LINK = '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&family=Lora:wght@400;500;700&display=swap" rel="stylesheet">';

const DARK_MODE_STYLES = `
  <style>
    @media (prefers-color-scheme: dark) {
      .wrapper { background-color: #18102B !important; }
      .card { background-color: #1E1530 !important; }
      .header-bg { background-color: #1E1530 !important; }
      .body-text { color: #F2F0F0 !important; }
      .headline-text { color: #F2F0F0 !important; }
      .muted-text { color: #B79B68 !important; }
      .logo-main { color: #F2F0F0 !important; }
      .divider { border-color: rgba(183,155,104,0.3) !important; }
      .card-border { border-color: #B79B68 !important; }
      .tool-name { color: #F2F0F0 !important; }
      .company-name { color: #F2F0F0 !important; }
    }
  </style>`;

function sectionLabel(text) {
  return `
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;">
                    <span class="muted-text" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#B79B68;">▸ ${text}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function spacer(px = 32) {
  return `<tr><td style="padding-top:${px}px;"></td></tr>`;
}

function headerBlock(subtitle, date) {
  return `
          <tr>
            <td class="header-bg" style="padding:28px 32px 20px 32px;background-color:#FAF8F5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span class="logo-main" style="font-family:'Playfair Display','Georgia',serif;font-size:28px;font-weight:400;letter-spacing:1px;color:#1C1C1C;">Evrything</span><span style="font-family:'Playfair Display','Georgia',serif;font-size:28px;font-weight:700;letter-spacing:1px;color:#A5503A;">AI</span>
                    ${subtitle ? `<span class="muted-text" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#B79B68;letter-spacing:2px;text-transform:uppercase;display:block;margin-top:6px;">${subtitle}</span>` : ""}
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span class="muted-text" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#B79B68;letter-spacing:2px;text-transform:uppercase;">${date}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:2px;background-color:#B79B68;"></td></tr>`;
}

function footerBlock(date) {
  return `
          <tr>
            <td style="padding:36px 32px 20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="divider" style="border-top:1px solid rgba(183,155,104,0.35);padding-top:20px;">
                    <p class="muted-text" style="font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#B79B68;text-align:center;letter-spacing:2px;margin:0;text-transform:uppercase;">EvrythingAI &nbsp;·&nbsp; Built by Hssn &nbsp;·&nbsp; AI-curated daily brief &nbsp;·&nbsp; ${date}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// ── Daily Email ─────────────────────────────────────────────────

const HERO_URL = `https://raw.githubusercontent.com/h55n/EvrythingAI/${process.env.GITHUB_REF_NAME || "main"}/assets/hero-daisies.jpg`;
const P = {
  olive: "#A8AA35", oliveDeep: "#8E9029", forest: "#2E3A1C", cream: "#FBF6E9", paper: "#F3EDD8",
  ink: "#26301A", muted: "#6B6F2A", stitch: "#FBF6E9", gold: "#E9C45B",
};
const SERIF = "'Cormorant Garamond','Playfair Display',Georgia,'Times New Roman',serif";
const BODY = "Georgia,'Lora','Times New Roman',serif";
const MONO = "'DM Mono','Courier New',monospace";

function stitchRow(color = P.stitch, n = 22) {
  return `<div style="font-family:${MONO};font-size:11px;letter-spacing:5px;line-height:1;color:${color};opacity:0.85;text-align:left;white-space:nowrap;overflow:hidden;max-width:100%;">${"✕ ".repeat(n)}</div>`;
}

function sectionHead(label) {
  return `
    <tr><td style="padding:34px 0 14px 0;">
      <div style="font-family:${MONO};font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:${P.cream};">${label}</div>
      <div style="padding-top:8px;">${stitchRow(P.cream, 14)}</div>
    </td></tr>`;
}

function card(inner, bg = P.cream) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};"><tr><td class="pad" style="padding:22px 26px;">${inner}</td></tr></table>`;
}

function tag(text, bg = P.olive, fg = P.forest) {
  return `<span style="font-family:${MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;background:${bg};color:${fg};padding:3px 8px;display:inline-block;">${text}</span>`;
}

function linkOut(url, label) {
  return `<a href="${url}" style="font-family:${MONO};font-size:11px;letter-spacing:1px;color:${P.forest};text-decoration:underline;">${label}</a>`;
}

export function buildEmailHTML(input) {
  const { news, tools, funding, signal, date } = sanitize(input);

  const newsItems = news?.items || [];
  const newsHTML = newsItems.map((item, i) => `
    <div style="padding:${i === 0 ? "0" : "18px"} 0 ${i === newsItems.length - 1 ? "0" : "18px"} 0;${i < newsItems.length - 1 ? `border-bottom:1px solid ${P.olive};` : ""}">
      <a href="${item.url || "#"}" style="font-family:${SERIF};font-size:24px;font-weight:700;line-height:1.2;color:${P.forest};text-decoration:none;display:block;margin:0 0 8px 0;">${item.headline || ""}</a>
      <p style="font-family:${BODY};font-size:15px;line-height:1.65;color:${P.ink};margin:0 0 12px 0;">${item.summary || ""}</p>
      ${item.source ? tag(item.source) : ""}&nbsp; ${linkOut(item.url || "#", "Read →")}
    </div>`).join("");

  const toolItems = tools?.items || [];
  const newTools = toolItems.filter(t => t.type !== "daily");
  const daily = toolItems.find(t => t.type === "daily");

  const toolHTML = newTools.map((item, i) => `
    <tr><td style="padding:0 0 ${i < newTools.length - 1 ? 12 : 0}px 0;">${card(`
      <div style="font-family:${SERIF};font-size:21px;font-weight:700;color:${P.forest};line-height:1.25;">${item.name || ""}${item.category ? `&nbsp; ${tag(item.category)}` : ""}</div>
      ${item.description ? `<p style="font-family:${BODY};font-size:14px;line-height:1.6;color:${P.ink};margin:8px 0 0 0;">${item.description}</p>` : ""}
      ${item.useCase ? `<p style="font-family:${BODY};font-size:13px;font-style:italic;line-height:1.55;color:${P.muted};margin:6px 0 0 0;">Use case: ${item.useCase}</p>` : ""}
      <div style="padding-top:10px;">${linkOut(item.url || "#", "Try it →")}</div>`)}
    </td></tr>`).join("");

  const dailyHTML = daily ? `
    ${sectionHead("Daily useful tool")}
    <tr><td>${card(`
      <div style="font-family:${SERIF};font-size:23px;font-weight:700;color:${P.forest};line-height:1.25;">${daily.name || ""}${daily.category ? `&nbsp; ${tag(daily.category, P.gold)}` : ""}</div>
      ${daily.description ? `<p style="font-family:${BODY};font-size:14px;line-height:1.6;color:${P.ink};margin:8px 0 0 0;">${daily.description}</p>` : ""}
      ${daily.useCase ? `<p style="font-family:${BODY};font-size:13px;font-style:italic;line-height:1.55;color:${P.muted};margin:6px 0 0 0;">Why: ${daily.useCase}</p>` : ""}
      <div style="padding-top:10px;">${linkOut(daily.url || "#", "Try it →")}</div>`, P.paper)}
    </td></tr>` : "";

  const fundItems = funding?.items || [];
  const fundHTML = fundItems.length ? `
    ${sectionHead("Funding &amp; deals")}
    <tr><td>${card(fundItems.map((f, i) => `
      <div style="padding:${i === 0 ? "0" : "14px"} 0 ${i === fundItems.length - 1 ? "0" : "14px"} 0;${i < fundItems.length - 1 ? `border-bottom:1px solid ${P.olive};` : ""}">
        <div style="font-family:${SERIF};font-size:20px;font-weight:700;color:${P.forest};">${f.company || ""}${f.amount ? `&nbsp; ${tag(f.amount, P.gold)}` : ""}${f.stage ? `&nbsp; ${tag(f.stage, P.paper, P.muted)}` : ""}</div>
        ${f.description ? `<p style="font-family:${BODY};font-size:14px;line-height:1.6;color:${P.ink};margin:6px 0 0 0;">${f.description}</p>` : ""}
        ${f.investors ? `<div style="font-family:${MONO};font-size:10px;letter-spacing:1px;color:${P.muted};padding-top:6px;">Lead: ${f.investors}</div>` : ""}
      </div>`).join(""))}
    </td></tr>` : "";

  const bullets = signal?.bullets || [];
  const bulletLabels = ["Money", "Build", "Avoid"];
  const signalHTML = bullets.length ? `
    ${sectionHead("Signal")}
    <tr><td style="background-color:${P.forest};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:24px 26px;">
      <div style="font-family:${SERIF};font-size:22px;font-style:italic;color:${P.cream};padding-bottom:12px;">Today's pattern</div>
      ${bullets.map((b, i) => `
        <div style="padding:0 0 ${i < bullets.length - 1 ? 14 : 0}px 0;">
          <div style="font-family:${MONO};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${P.gold};padding-bottom:3px;">${bulletLabels[i] || "Note"}</div>
          <div style="font-family:${BODY};font-size:15px;line-height:1.6;color:${P.cream};">${b}</div>
        </div>`).join("")}
    </td></tr></table></td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>EvrythingAI — ${date}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width: 480px) {
    .pad { padding: 18px 18px !important; }
    .masthead { font-size: 40px !important; }
    .gutter { padding-left: 14px !important; padding-right: 14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${P.olive};font-family:${BODY};color:${P.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.olive};">
    <tr><td align="center" class="gutter" style="padding:0 20px 40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;table-layout:fixed;">
        <tr><td style="padding:0;"><img src="${HERO_URL}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
        <tr><td style="padding:28px 0 6px 0;">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${P.cream};">${date}</div>
          <div class="masthead" style="font-family:${SERIF};font-size:52px;line-height:1.02;font-weight:500;color:${P.cream};padding-top:10px;">Evrything<em style="font-style:italic;">AI</em></div>
          <div style="font-family:${SERIF};font-size:22px;line-height:1.3;color:${P.cream};padding-top:8px;">The day in AI, <em>quietly</em> sorted.</div>
        </td></tr>
        ${sectionHead("Top news")}
        <tr><td>${card(newsHTML)}</td></tr>
        ${newTools.length ? sectionHead("Tools &amp; models") + toolHTML : ""}
        ${dailyHTML}
        ${fundHTML}
        ${signalHTML}
        <tr><td style="padding:36px 0 0 0;">
          ${stitchRow(P.cream, 22)}
          <div style="font-family:${MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${P.cream};padding-top:12px;line-height:1.8;">EvrythingAI &middot; built by h55n &middot; ${date}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildEmailText({ news, tools, funding, signal, date }) {
  const lines = [
    `EVRYTHINGAI — ${date}`,
    "=".repeat(50),
    "",
    "▸ TOP NEWS",
    "-".repeat(30),
  ];
  (news?.items || []).forEach((item, i) => {
    lines.push(`${i + 1}. ${item.headline}`);
    lines.push(`   ${item.summary}`);
    lines.push(`   Source: ${item.source} | ${item.url}`);
    lines.push("");
  });
  lines.push("▸ TOOLS & MODELS", "-".repeat(30));
  const newToolsTxt = (tools?.items || []).filter(i => i.type !== 'daily');
  const dailyToolTxt = (tools?.items || []).find(i => i.type === 'daily');
  newToolsTxt.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`);
    lines.push(`   ${item.description}`);
    if (item.useCase) lines.push(`   Use case: ${item.useCase}`);
    if (item.url) lines.push(`   ${item.url}`);
    lines.push("");
  });
  if (dailyToolTxt) {
    lines.push("▸ DAILY USEFUL TOOL [DAILY PICK]", "-".repeat(30));
    lines.push(`${dailyToolTxt.name}${dailyToolTxt.category ? ` [${dailyToolTxt.category}]` : ''}`);
    lines.push(`   ${dailyToolTxt.description}`);
    if (dailyToolTxt.useCase) lines.push(`   Why: ${dailyToolTxt.useCase}`);
    if (dailyToolTxt.url) lines.push(`   ${dailyToolTxt.url}`);
    lines.push("");
  }
  lines.push("▸ FUNDING & DEALS", "-".repeat(30));
  (funding?.items || []).forEach(item => {
    lines.push(`${item.company}${item.amount ? ` — ${item.amount}` : ""}${item.stage ? ` (${item.stage})` : ""}`);
    lines.push(`  ${item.description}`);
    if (item.investors) lines.push(`  Lead: ${item.investors}`);
    lines.push("");
  });
  lines.push("▸ SIGNAL", "-".repeat(30));
  const bullets = signal?.bullets || [];
  const labels = ["💰 ", "🔨 ", "⚠️ "];
  bullets.forEach((b, i) => {
    lines.push(`${labels[i] || "• "}${b}`);
  });
  lines.push("", "=".repeat(50));
  lines.push("EvrythingAI · Built by Hssn · AI-curated daily brief");
  return lines.join("\n");
}

// ── Monthly Wrap Email ──────────────────────────────────────────

export function buildMonthlyHTML(input) {
  const { wrap, monthLabel, date } = sanitize(input);
  const topFundedHTML = (wrap?.topFunded || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 16px 0;${i < (wrap.topFunded.length - 1) ? "border-bottom:1px solid rgba(183,155,104,0.2);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span class="company-name" style="font-family:'Playfair Display','Georgia',serif;font-size:16px;font-weight:700;color:#1C1C1C;letter-spacing:0.3px;">${item.company || ""}</span>
              ${item.amount ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:12px;color:#1C1C1C;font-weight:700;background:#F1C766;padding:2px 9px;margin-left:10px;display:inline-block;border-radius:2px;">${item.amount}</span>` : ""}
            </td>
          </tr>
          <tr><td style="padding-top:5px;"><span class="body-text" style="font-family:'Lora','Georgia',serif;font-size:12px;color:#1C1C1C;line-height:1.65;opacity:0.85;">${item.description || ""}</span></td></tr>
        </table>
      </td>
    </tr>
    ${i < (wrap.topFunded.length - 1) ? '<tr><td style="padding-top:10px;"></td></tr>' : ''}`).join("");

  const breakoutHTML = (wrap?.breakoutTools || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 ${i < (wrap.breakoutTools.length - 1) ? '16' : '0'}px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card card-border" style="border:1px solid #B79B68;background:#F2F0F0;">
          <tr>
            <td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span class="tool-name" style="font-family:'Playfair Display','Georgia',serif;font-size:17px;font-weight:700;color:#1C1C1C;letter-spacing:0.3px;">${item.name || "—"}</span>
                    ${item.category ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;color:#FFFFFF;letter-spacing:2px;text-transform:uppercase;background:#88B8CE;padding:3px 9px;margin-left:10px;display:inline-block;border-radius:2px;">${item.category}</span>` : ""}
                  </td>
                </tr>
                <tr><td style="padding-top:6px;"><span class="body-text" style="font-family:'Lora','Georgia',serif;font-size:13px;color:#1C1C1C;line-height:1.65;">${item.description || ""}</span></td></tr>
                <tr><td style="padding-top:5px;"><span class="muted-text" style="font-family:'Lora','Georgia',serif;font-size:12px;color:#B79B68;font-style:italic;line-height:1.5;">Why: ${item.why || ""}</span></td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  const signalLabels = ["💰", "🔨", "👀", "⚠️", "🔮"];
  const signalBullets = (wrap?.signal || []).map((bullet, i) => `
      <tr>
        <td style="padding:${i > 0 ? '12' : '0'}px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="28" style="vertical-align:top;padding-top:2px;font-size:14px;">${signalLabels[i] || "▸"}</td>
              <td style="vertical-align:top;">
                <p style="font-family:'Lora','Georgia',serif;font-size:13px;line-height:1.8;color:#FFFFFF;margin:0;font-weight:400;">${bullet}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>EvrythingAI — ${monthLabel} Monthly Wrap</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  ${FONTS_LINK}
  ${DARK_MODE_STYLES}
</head>
<body class="wrapper" style="margin:0;padding:0;background-color:#FAF8F5;font-family:'Lora','Georgia',serif;color:#1C1C1C;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrapper" style="background-color:#FAF8F5;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;table-layout:fixed;">

          ${headerBlock("MONTHLY WRAP", monthLabel)}
          ${spacer()}

          <!-- MONTH IN REVIEW -->
          ${sectionLabel("MONTH IN REVIEW")}
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="background-color:#F2F0F0;padding:22px 26px;">
                <tr><td>
                  <p class="body-text" style="font-family:'Lora','Georgia',serif;font-size:14px;color:#1C1C1C;line-height:1.85;margin:0;">${wrap?.review || ""}</p>
                </td></tr>
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- TOP FUNDED COMPANIES -->
          ${sectionLabel("TOP FUNDED COMPANIES")}
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="background-color:#F2F0F0;padding:22px 26px;">
                ${topFundedHTML || '<tr><td><span class="muted-text" style="font-family:\'Lora\',\'Georgia\',serif;font-size:13px;color:#B79B68;font-style:italic;">No data available.</span></td></tr>'}
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- BREAKOUT TOOLS -->
          ${sectionLabel("BREAKOUT TOOLS")}
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${breakoutHTML}
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- MOST USEFUL TOOLS OF THE MONTH -->
          ${sectionLabel("MOST USEFUL TOOLS OF THE MONTH")}
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${(wrap?.usefulTools || []).map((item, i) => `
                <tr>
                  <td style="padding:0 0 ${i < (wrap.usefulTools.length - 1) ? '14' : '0'}px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="border-left:4px solid #F1C766;background:#F2F0F0;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <span class="tool-name" style="font-family:'Playfair Display','Georgia',serif;font-size:16px;font-weight:700;color:#1C1C1C;letter-spacing:0.3px;">${item.name || "—"}</span>
                                <span style="font-family:'DM Mono','Courier New',monospace;font-size:8px;font-weight:500;color:#5A2916;letter-spacing:2px;text-transform:uppercase;background:#F1C766;padding:2px 8px;margin-left:8px;display:inline-block;border-radius:2px;">DAILY PICK</span>
                                ${item.category ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;color:#FFFFFF;letter-spacing:2px;text-transform:uppercase;background:#88B8CE;padding:2px 8px;margin-left:6px;display:inline-block;border-radius:2px;">${item.category}</span>` : ""}
                              </td>
                            </tr>
                            <tr><td style="padding-top:5px;"><span class="body-text" style="font-family:'Lora','Georgia',serif;font-size:12px;color:#1C1C1C;line-height:1.6;">${item.description || item.tagline || ""}</span></td></tr>
                            <tr><td style="padding-top:4px;"><span class="muted-text" style="font-family:'Lora','Georgia',serif;font-size:11px;color:#B79B68;font-style:italic;line-height:1.5;">Why: ${item.why || ""}</span></td></tr>
                            ${item.url ? `<tr><td style="padding-top:10px;"><a href="${item.url}" style="font-family:'DM Mono','Courier New',monospace;font-size:11px;color:#88B8CE;text-decoration:none;font-weight:500;">Try it →</a></td></tr>` : ""}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("") || '<tr><td><span class="muted-text" style="font-family:\'Lora\',\'Georgia\',serif;font-size:13px;color:#B79B68;font-style:italic;">No daily picks available this month.</span></td></tr>'}
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- WHAT'S COMING -->
          ${sectionLabel("WHAT'S COMING")}
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="background-color:#F2F0F0;border-left:3px solid #B79B68;">
                <tr>
                  <td style="padding:22px 26px;">
                    <p class="body-text" style="font-family:'Lora','Georgia',serif;font-size:14px;color:#1C1C1C;line-height:1.85;margin:0;">${wrap?.whatsNext || ""}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- MONTHLY SIGNAL -->
          ${sectionLabel("MONTHLY SIGNAL")}
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#A5503A;">
                <tr>
                  <td style="padding:26px 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td><span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.55);letter-spacing:3px;text-transform:uppercase;">◈ FORWARD SIGNAL — NEXT MONTH</span></td></tr>
                      <tr>
                        <td style="padding-top:16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            ${signalBullets}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${footerBlock(date)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildMonthlyText({ wrap, monthLabel, date }) {
  const lines = [
    `EVRYTHINGAI — ${monthLabel} MONTHLY WRAP`,
    "=".repeat(50),
    "",
    "▸ MONTH IN REVIEW",
    "-".repeat(30),
    wrap?.review || "",
    "",
    "▸ TOP FUNDED COMPANIES",
    "-".repeat(30),
  ];
  (wrap?.topFunded || []).forEach(item => {
    lines.push(`${item.company}${item.amount ? ` — ${item.amount}` : ""}`);
    lines.push(`  ${item.description}`);
    lines.push("");
  });
  lines.push("▸ BREAKOUT TOOLS", "-".repeat(30));
  (wrap?.breakoutTools || []).forEach(item => {
    lines.push(`${item.name}`);
    lines.push(`  ${item.description}`);
    if (item.why) lines.push(`  Why: ${item.why}`);
    lines.push("");
  });
  lines.push("▸ MOST USEFUL TOOLS OF THE MONTH", "-".repeat(30));
  (wrap?.usefulTools || []).forEach(item => {
    lines.push(`${item.name}${item.category ? ` [${item.category}]` : ''}`);
    lines.push(`  ${item.description || item.tagline || ''}`);
    lines.push(`  Why: ${item.why || ''}`);
    lines.push("");
  });
  lines.push("▸ WHAT'S COMING", "-".repeat(30));
  lines.push(wrap?.whatsNext || "");
  lines.push("");
  lines.push("▸ MONTHLY SIGNAL", "-".repeat(30));
  const labels = ["💰 ", "🔨 ", "👀 ", "⚠️ ", "🔮 "];
  (wrap?.signal || []).forEach((b, i) => {
    lines.push(`${labels[i] || "• "}${b}`);
  });
  lines.push("", "=".repeat(50));
  lines.push("EvrythingAI · Built by Hssn · Monthly Wrap");
  return lines.join("\n");
}
