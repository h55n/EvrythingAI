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

export function buildEmailHTML({ news, tools, funding, signal, date }) {
  const newsHTML = (news?.items || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 20px 0;${i < (news.items.length - 1) ? "border-bottom:1px solid rgba(183,155,104,0.2);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <a href="${item.url || "#"}" class="headline-text" style="font-family:'Playfair Display','Georgia',serif;font-size:18px;font-weight:700;color:#5A2916;text-decoration:none;display:block;margin-bottom:8px;line-height:1.35;">${item.headline || ""}</a>
              <p class="body-text" style="font-family:'Lora','Georgia',serif;font-size:14px;color:#1C1C1C;line-height:1.75;margin:0 0 10px 0;">${item.summary || ""}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:3px 10px;border-radius:2px;border:1px solid #88B8CE;">
                    <span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;color:#88B8CE;letter-spacing:2px;text-transform:uppercase;">${item.source || ""}</span>
                  </td>
                  <td style="padding-left:12px;">
                    <a href="${item.url || "#"}" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#88B8CE;text-decoration:none;">Read →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${i < (news.items.length - 1) ? '<tr><td style="padding-top:18px;"></td></tr>' : ''}`).join("");

  const toolsItems = tools?.items || [];
  const toolsHTML = toolsItems.map((item, i) => `
    <tr>
      <td style="padding:0 0 ${i < toolsItems.length - 1 ? '16' : '0'}px 0;">
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
                <tr><td style="padding-top:5px;"><span class="muted-text" style="font-family:'Lora','Georgia',serif;font-size:12px;color:#B79B68;font-style:italic;line-height:1.5;">Use case: ${item.useCase || ""}</span></td></tr>
                <tr><td style="padding-top:12px;">${item.url ? `<a href="${item.url}" style="font-family:'DM Mono','Courier New',monospace;font-size:11px;color:#88B8CE;text-decoration:none;font-weight:500;">Try it →</a>` : ""}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  const fundingHTML = (funding?.items || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 16px 0;${i < (funding.items.length - 1) ? "border-bottom:1px solid rgba(183,155,104,0.2);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span class="company-name" style="font-family:'Playfair Display','Georgia',serif;font-size:16px;font-weight:700;color:#1C1C1C;letter-spacing:0.3px;">${item.company || ""}</span>
              ${item.amount ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:12px;color:#1C1C1C;font-weight:700;background:#F1C766;padding:2px 9px;margin-left:10px;display:inline-block;border-radius:2px;">${item.amount}${item.stage ? ` · ${item.stage}` : ""}</span>` : ""}
            </td>
          </tr>
          <tr><td style="padding-top:5px;"><span class="body-text" style="font-family:'Lora','Georgia',serif;font-size:12px;color:#1C1C1C;line-height:1.65;opacity:0.85;">${item.description || ""}</span></td></tr>
          ${item.investors ? `<tr><td style="padding-top:4px;"><span class="muted-text" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#B79B68;letter-spacing:0.5px;">Lead: ${item.investors}</span></td></tr>` : ""}
        </table>
      </td>
    </tr>
    ${i < (funding.items.length - 1) ? '<tr><td style="padding-top:12px;"></td></tr>' : ''}`).join("");

  const bullets = signal?.bullets || [];
  const signalBulletsHTML = bullets.map((bullet, i) => {
    const labels = ["💰", "🔨", "⚠️"];
    return `
      <tr>
        <td style="padding:${i > 0 ? '12' : '0'}px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="28" style="vertical-align:top;padding-top:2px;font-size:14px;">${labels[i] || "▸"}</td>
              <td style="vertical-align:top;">
                <p style="font-family:'Lora','Georgia',serif;font-size:13px;line-height:1.8;color:#FFFFFF;margin:0;font-weight:400;">${bullet}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>EvrythingAI — ${date}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  ${FONTS_LINK}
  ${DARK_MODE_STYLES}
</head>
<body class="wrapper" style="margin:0;padding:0;background-color:#FAF8F5;font-family:'Lora','Georgia',serif;color:#1C1C1C;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrapper" style="background-color:#FAF8F5;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          ${headerBlock("", date)}
          ${spacer()}
          ${sectionLabel("TOP NEWS")}

          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="background-color:#F2F0F0;padding:22px 26px;">
                ${newsHTML}
              </table>
            </td>
          </tr>

          ${spacer()}
          ${sectionLabel("TOOLS &amp; MODELS")}

          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${toolsHTML}
              </table>
            </td>
          </tr>

          ${spacer()}
          ${sectionLabel("FUNDING &amp; DEALS")}

          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="background-color:#F2F0F0;padding:22px 26px;">
                ${funding?.items?.length > 0 ? fundingHTML : '<tr><td><span class="muted-text" style="font-family:\'Lora\',\'Georgia\',serif;font-size:13px;color:#B79B68;font-style:italic;">No significant funding news found today.</span></td></tr>'}
              </table>
            </td>
          </tr>

          ${spacer()}
          ${sectionLabel("SIGNAL")}

          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#A5503A;">
                <tr>
                  <td style="padding:26px 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td><span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.55);letter-spacing:3px;text-transform:uppercase;">◈ TODAY'S PATTERN</span></td></tr>
                      <tr>
                        <td style="padding-top:16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            ${signalBulletsHTML}
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
  (tools?.items || []).forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`);
    lines.push(`   ${item.description}`);
    lines.push(`   Use case: ${item.useCase}`);
    if (item.url) lines.push(`   ${item.url}`);
    lines.push("");
  });
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

export function buildMonthlyHTML({ wrap, monthLabel, date }) {
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
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

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
    lines.push(`  Why: ${item.why}`);
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
