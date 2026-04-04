// email.js — HTML email templates (table-based, inline CSS)
// HAITI PALETTE:
//   Background:     #18102B  (Haiti — dark purple-black)
//   Card fills:     #1E1530  (slightly lighter Haiti)
//   Primary accent: #834DFB  (Electric Violet — section labels, borders)
//   Highlight:      #F0E100  (Turbo yellow — amounts, badges)
//   Soft surface:   #F5F3FF  (Blue Chalk — tool card bg)
//   Body text:      #F0EAF8  (light lavender-white)
//   Muted text:     #9B8AB0  (dimmed sources, footer)
//   Signal bg:      #834DFB  (Electric Violet)
//   Signal text:    #FFFFFF
// Fonts: Bebas Neue (headers), DM Mono (labels), DM Sans (body)

// ── Shared helpers ──────────────────────────────────────────────
const FONTS_LINK = '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">';

function sectionLabel(text) {
  return `
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#834DFB;padding:5px 14px;border-radius:3px;">
                    <span style="font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#FFFFFF;">▸ ${text}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function spacer(px = 28) {
  return `<tr><td style="padding-top:${px}px;"></td></tr>`;
}

function headerBlock(title, subtitle, date) {
  return `
          <tr>
            <td style="padding:24px 28px;background-color:#18102B;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:28px;font-weight:700;letter-spacing:2px;color:#F0EAF8;">EVRYTHING</span><span style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:28px;font-weight:700;letter-spacing:2px;color:#834DFB;">AI</span>
                    ${subtitle ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#834DFB;letter-spacing:2px;text-transform:uppercase;display:block;margin-top:4px;">${subtitle}</span>` : ""}
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#9B8AB0;letter-spacing:2px;text-transform:uppercase;">${date}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;background-color:#834DFB;"></td></tr>`;
}

function footerBlock(date) {
  return `
          <tr>
            <td style="padding:32px 28px 16px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid rgba(131,77,251,0.25);padding-top:18px;">
                    <p style="font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9B8AB0;text-align:center;letter-spacing:2px;margin:0;text-transform:uppercase;">EvrythingAI &nbsp;·&nbsp; Built by Hssn &nbsp;·&nbsp; AI-generated daily brief &nbsp;·&nbsp; ${date}</p>
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
      <td style="padding:0 0 18px 0;${i < (news.items.length - 1) ? "border-bottom:1px solid rgba(131,77,251,0.15);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <a href="${item.url || "#"}" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:18px;font-weight:700;color:#F0EAF8;text-decoration:none;display:block;margin-bottom:6px;line-height:1.3;letter-spacing:0.5px;">${item.headline || ""}</a>
              <p style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:13px;color:#F0EAF8;line-height:1.7;margin:0 0 8px 0;opacity:0.8;">${item.summary || ""}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#834DFB;padding:3px 10px;border-radius:2px;">
                    <span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:700;color:#FFFFFF;letter-spacing:2px;text-transform:uppercase;">${item.source || ""}</span>
                  </td>
                  <td style="padding-left:10px;">
                    <a href="${item.url || "#"}" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#834DFB;text-decoration:none;">Read →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${i < (news.items.length - 1) ? '<tr><td style="padding-top:16px;"></td></tr>' : ''}`).join("");

  const toolsItems = tools?.items || [];
  const toolsHTML = toolsItems.map((item, i) => `
    <tr>
      <td style="padding:0 0 ${i < toolsItems.length - 1 ? '14' : '0'}px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #834DFB;background:#F5F3FF;">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td><span style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:18px;font-weight:700;color:#18102B;letter-spacing:0.5px;">${item.name || "—"}</span></td></tr>
                <tr><td style="padding-top:4px;"><span style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:13px;color:#18102B;line-height:1.6;opacity:0.85;">${item.description || ""}</span></td></tr>
                <tr><td style="padding-top:4px;"><span style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:12px;color:#9B8AB0;font-style:italic;line-height:1.5;">Use case: ${item.useCase || ""}</span></td></tr>
                <tr><td style="padding-top:10px;">${item.url ? `<a href="${item.url}" style="font-family:'DM Mono','Courier New',monospace;font-size:11px;color:#834DFB;text-decoration:none;font-weight:500;">Try it →</a>` : ""}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  const fundingHTML = (funding?.items || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 14px 0;${i < (funding.items.length - 1) ? "border-bottom:1px solid rgba(131,77,251,0.15);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:16px;font-weight:700;color:#F0EAF8;letter-spacing:0.3px;">${item.company || ""}</span>
              ${item.amount ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:12px;color:#18102B;font-weight:700;background:#F0E100;padding:2px 8px;margin-left:10px;display:inline-block;border-radius:2px;">${item.amount}${item.stage ? ` · ${item.stage}` : ""}</span>` : ""}
            </td>
          </tr>
          <tr><td style="padding-top:4px;"><span style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:12px;color:#F0EAF8;line-height:1.6;opacity:0.75;">${item.description || ""}</span></td></tr>
          ${item.investors ? `<tr><td style="padding-top:3px;"><span style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#9B8AB0;letter-spacing:0.5px;">Lead: ${item.investors}</span></td></tr>` : ""}
        </table>
      </td>
    </tr>
    ${i < (funding.items.length - 1) ? '<tr><td style="padding-top:12px;"></td></tr>' : ''}`).join("");

  const bullets = signal?.bullets || [];
  const signalBulletsHTML = bullets.map((bullet, i) => {
    const labels = ["💰", "🔨", "⚠️"];
    return `
      <tr>
        <td style="padding:${i > 0 ? '10' : '0'}px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="28" style="vertical-align:top;padding-top:2px;font-size:14px;">${labels[i] || "▸"}</td>
              <td style="vertical-align:top;">
                <p style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.75;color:#FFFFFF;margin:0;font-weight:500;">${bullet}</p>
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
  <title>EvrythingAI — ${date}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  ${FONTS_LINK}
</head>
<body style="margin:0;padding:0;background-color:#18102B;font-family:'DM Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F0EAF8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#18102B;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          ${headerBlock("", "", date)}
          ${spacer()}
          ${sectionLabel("TOP 3 NEWS")}

          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1E1530;padding:20px 24px;">
                ${newsHTML}
              </table>
            </td>
          </tr>

          ${spacer()}
          ${sectionLabel("TOOLS &amp; MODELS")}

          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${toolsHTML}
              </table>
            </td>
          </tr>

          ${spacer()}
          ${sectionLabel("FUNDING &amp; DEALS")}

          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1E1530;padding:20px 24px;">
                ${funding?.items?.length > 0 ? fundingHTML : '<tr><td><span style="font-family:\'DM Sans\',\'Segoe UI\',Roboto,sans-serif;font-size:13px;color:#9B8AB0;font-style:italic;">No significant funding news found today.</span></td></tr>'}
              </table>
            </td>
          </tr>

          ${spacer()}
          ${sectionLabel("SIGNAL")}

          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#834DFB;">
                <tr>
                  <td style="padding:24px 26px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td><span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.6);letter-spacing:3px;text-transform:uppercase;">◈ TODAY'S PATTERN</span></td></tr>
                      <tr>
                        <td style="padding-top:14px;">
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
    "▸ TOP 3 NEWS",
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
  lines.push("EvrythingAI · Built by Hssn · AI-generated daily brief");
  return lines.join("\n");
}

// ── Monthly Wrap Email ──────────────────────────────────────────

export function buildMonthlyHTML({ wrap, monthLabel, date }) {
  const topFundedHTML = (wrap?.topFunded || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 14px 0;${i < (wrap.topFunded.length - 1) ? "border-bottom:1px solid rgba(131,77,251,0.15);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:16px;font-weight:700;color:#F0EAF8;letter-spacing:0.3px;">${item.company || ""}</span>
              ${item.amount ? `<span style="font-family:'DM Mono','Courier New',monospace;font-size:12px;color:#18102B;font-weight:700;background:#F0E100;padding:2px 8px;margin-left:10px;display:inline-block;border-radius:2px;">${item.amount}</span>` : ""}
            </td>
          </tr>
          <tr><td style="padding-top:4px;"><span style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:12px;color:#F0EAF8;line-height:1.6;opacity:0.75;">${item.description || ""}</span></td></tr>
        </table>
      </td>
    </tr>
    ${i < (wrap.topFunded.length - 1) ? '<tr><td style="padding-top:10px;"></td></tr>' : ''}`).join("");

  const breakoutHTML = (wrap?.breakoutTools || []).map((item, i) => `
    <tr>
      <td style="padding:0 0 ${i < (wrap.breakoutTools.length - 1) ? '14' : '0'}px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #834DFB;background:#F5F3FF;">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td><span style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:18px;font-weight:700;color:#18102B;letter-spacing:0.5px;">${item.name || "—"}</span></td></tr>
                <tr><td style="padding-top:4px;"><span style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:13px;color:#18102B;line-height:1.6;opacity:0.85;">${item.description || ""}</span></td></tr>
                <tr><td style="padding-top:4px;"><span style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:12px;color:#834DFB;font-style:italic;line-height:1.5;">Why: ${item.why || ""}</span></td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  const signalLabels = ["💰", "🔨", "👀", "⚠️", "🔮"];
  const signalBullets = (wrap?.signal || []).map((bullet, i) => `
      <tr>
        <td style="padding:${i > 0 ? '10' : '0'}px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="28" style="vertical-align:top;padding-top:2px;font-size:14px;">${signalLabels[i] || "▸"}</td>
              <td style="vertical-align:top;">
                <p style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.75;color:#FFFFFF;margin:0;font-weight:500;">${bullet}</p>
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
  <title>EvrythingAI — ${monthLabel} Monthly Wrap</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  ${FONTS_LINK}
</head>
<body style="margin:0;padding:0;background-color:#18102B;font-family:'DM Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F0EAF8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#18102B;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

          ${headerBlock("", "MONTHLY WRAP", monthLabel)}
          ${spacer()}

          <!-- MONTH IN REVIEW -->
          ${sectionLabel("MONTH IN REVIEW")}
          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1E1530;padding:20px 24px;">
                <tr><td>
                  <p style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:14px;color:#F0EAF8;line-height:1.8;margin:0;">${wrap?.review || ""}</p>
                </td></tr>
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- TOP FUNDED COMPANIES -->
          ${sectionLabel("TOP FUNDED COMPANIES")}
          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1E1530;padding:20px 24px;">
                ${topFundedHTML || '<tr><td><span style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#9B8AB0;font-style:italic;">No data available.</span></td></tr>'}
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- BREAKOUT TOOLS -->
          ${sectionLabel("BREAKOUT TOOLS")}
          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${breakoutHTML}
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- WHAT'S COMING -->
          ${sectionLabel("WHAT'S COMING")}
          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1E1530;border-left:3px solid #834DFB;">
                <tr>
                  <td style="padding:22px 24px;">
                    <p style="font-family:'DM Sans','Segoe UI',Roboto,sans-serif;font-size:14px;color:#F0EAF8;line-height:1.8;margin:0;">${wrap?.whatsNext || ""}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${spacer()}

          <!-- MONTHLY SIGNAL -->
          ${sectionLabel("MONTHLY SIGNAL")}
          <tr>
            <td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#834DFB;">
                <tr>
                  <td style="padding:24px 26px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td><span style="font-family:'DM Mono','Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.6);letter-spacing:3px;text-transform:uppercase;">◈ FORWARD SIGNAL — NEXT MONTH</span></td></tr>
                      <tr>
                        <td style="padding-top:14px;">
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
