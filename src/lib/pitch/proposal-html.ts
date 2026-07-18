import type { ServiceProposalContent } from "./proposal-agent";
import { getProposalTheme, visibleOnWhite, textOnColor } from "./proposal-detail-helpers";

/**
 * renderProposalHtml — emit the proposal as a self-contained, print-ready HTML
 * document that MIRRORS the Pitch Studio renderers (pitch-document.tsx deck /
 * visual-document.tsx) exactly: same theme (getProposalTheme), same
 * visible-on-white brand colours, the same section labels (content.headings
 * overrides), the same content + order, and the same business-type images. This
 * is what the send/PDF route feeds to Puppeteer's page.pdf so the DOWNLOADED /
 * EMAILED PDF looks identical to what the user edited — no separate hand-built
 * jsPDF layout drifting from the on-screen design. The logo renders as a normal
 * <img>, so a transparent PNG never lands on a black background.
 *
 * `variant`: "deck" (clean, text-forward) or "visual" (image-rich). Defaults to
 * whatever the user last chose in the Studio (content.studioDocType) else deck.
 */

interface RenderOpts {
  logoDataUri?: string | null;
  brandName?: string | null;
  variant?: "deck" | "visual";
}

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nl2br = (s: string): string => esc(s).replace(/\n/g, "<br/>");
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function renderProposalHtml(content: ServiceProposalContent, opts: RenderOpts = {}): string {
  const c = content;
  const theme = getProposalTheme(c);
  const primaryInk = visibleOnWhite(theme.primary);
  const secondaryInk = visibleOnWhite(theme.secondary);
  const accentInk = visibleOnWhite(theme.accent);
  const ink = theme.ink || "#0f172a";
  const metricColors = [primaryInk, secondaryInk, accentInk, "#dc2626"];

  const variant: "deck" | "visual" = opts.variant || ((c as { studioDocType?: string }).studioDocType === "visual" ? "visual" : "deck");
  const isVisual = variant === "visual";
  const brandName = opts.brandName || c.preparedBy || (typeof c.brandSnapshot?.name === "string" ? c.brandSnapshot.name : "") || "Your brand";

  const headings = (c.headings || {}) as Record<string, string>;
  const h = (key: string, dflt: string) => esc(headings[key] ?? dflt);

  const str = (k: keyof ServiceProposalContent): string => (typeof c[k] === "string" ? (c[k] as string) : "");
  const deliverables = arr<{ title: string; description: string }>(c.deliverables);
  const commitments = arr<string>(c.commitments);
  const benefits = arr<string>(c.benefits);
  const proof = arr<{ metric: string; label: string; note: string }>(c.proofPoints);
  const timeline = arr<{ label: string; title: string; description: string }>(c.timeline);
  const terms = arr<string>(c.terms);
  const nextSteps = arr<string>(c.nextSteps);
  const contact = (c.contact || {}) as { name?: string; email?: string; phone?: string; website?: string; address?: string };
  const pricing = (c.pricing || {}) as { name?: string; amount?: number; originalAmount?: number; interval?: string; note?: string };
  const images = arr<{ kind: string; url: string; alt?: string }>(c.visualAssets?.images);
  const imgUrl = (kind: "cover" | "about" | "impact") => images.find((im) => im.kind === kind)?.url;

  const logo = opts.logoDataUri
    ? `<img src="${esc(opts.logoDataUri)}" alt="${esc(brandName)}" class="logo"/>`
    : `<div class="brandname">${esc(brandName)}</div>`;

  const kicker = (key: string, dflt: string) => `<div class="kick">${h(key, dflt)}</div>`;

  const sections: string[] = [];

  // ── COVER ──
  const cta = esc(headings["ctaLabel"] ?? "Get started →");
  sections.push(`
    <div class="cover ${isVisual ? "visual-cover" : ""}">
      <div class="cover-in">
        ${logo}
        <div class="prep">Prepared for ${esc(c.preparedFor || contact.name || "your team")}</div>
        <h1 class="title">${esc(str("title"))}</h1>
        ${str("subtitle") ? `<p class="subtitle">${nl2br(str("subtitle"))}</p>` : ""}
        <span class="prep-by">Prepared by ${esc(c.preparedBy || brandName)}</span>
      </div>
      ${isVisual && imgUrl("cover") ? `<div class="cover-img"><img src="${esc(imgUrl("cover"))}" alt="cover"/></div>` : ""}
    </div>`);

  // ── OVERVIEW ──
  sections.push(`
    <section class="sec">
      ${kicker("overview", "The opportunity")}
      <h2>${esc(str("serviceTitle") || "Overview")}</h2>
      ${str("executiveSummary") ? `<p class="body">${nl2br(str("executiveSummary"))}</p>` : ""}
      ${str("clientNeed") ? `<p class="body">${nl2br(str("clientNeed"))}</p>` : ""}
    </section>`);

  // ── ABOUT ──
  if (str("aboutBrand")) {
    sections.push(`
    <section class="sec">
      ${kicker("about", `About ${esc(brandName)}`)}
      <div class="${isVisual && imgUrl("about") ? "two about" : ""}">
        ${isVisual && imgUrl("about") ? `<div class="side-img"><img src="${esc(imgUrl("about"))}" alt="about"/></div>` : ""}
        <p class="body">${nl2br(str("aboutBrand"))}</p>
      </div>
    </section>`);
  }

  // ── DELIVERABLES ──
  if (deliverables.length) {
    sections.push(`
    <section class="sec">
      ${kicker("deliverables", "What you'll get")}
      <h2>${h("deliverablesTitle", "Deliverables")}</h2>
      <div class="cards">
        ${deliverables.map((d) => `
          <div class="card">
            <span class="chip"></span>
            <div class="card-title">${esc(d.title)}</div>
            <div class="card-desc">${nl2br(d.description)}</div>
          </div>`).join("")}
      </div>
    </section>`);
  }

  // ── COMMITMENTS / BENEFITS ──
  const bulletSec = (key: string, dflt: string, items: string[]) => `
    <section class="sec">
      ${kicker(key, dflt)}
      <ul class="bullets">
        ${items.map((it) => `<li><span class="dot"></span><span>${nl2br(it)}</span></li>`).join("")}
      </ul>
    </section>`;
  if (commitments.length) sections.push(bulletSec("commitments", "Our commitment", commitments));
  if (benefits.length) sections.push(bulletSec("benefits", "The impact", benefits));

  // ── PROOF ──
  if (proof.length || timeline.length) {
    sections.push(`
    <section class="sec">
      ${kicker("proof", "Proof")}
      <div class="${isVisual && imgUrl("impact") ? "two proof" : ""}">
        <div>
          <h2>${h("proofTitle", "Results we drive")}</h2>
          ${proof.length ? `<div class="rings">
            ${proof.map((p, i) => {
              const bg = metricColors[i % metricColors.length];
              const len = (p.metric || "").length;
              const fs = len > 7 ? 11 : len > 5 ? 13 : len > 3 ? 16 : 20;
              return `<div class="ring">
                <div class="ringc" style="background:${bg};color:${textOnColor(bg, ink)};font-size:${fs}px">${esc(p.metric)}</div>
                <small>${esc(p.label)}</small>
              </div>`;
            }).join("")}
          </div>` : ""}
          ${timeline.length ? `
            <h3 style="margin-top:22px">${h("timelineTitle", "Launch timeline")}</h3>
            <div class="tl">
              ${timeline.map((t) => `<div class="tlc"><div class="tll" style="color:${primaryInk}">${esc(t.label)}</div><div class="tlt">${esc(t.title)}</div>${t.description ? `<div class="tld">${nl2br(t.description)}</div>` : ""}</div>`).join("")}
            </div>` : ""}
        </div>
        ${isVisual && imgUrl("impact") ? `<div class="side-img"><img src="${esc(imgUrl("impact"))}" alt="impact"/></div>` : ""}
      </div>
    </section>`);
  }

  // ── PRICING ──
  if (pricing.name || typeof pricing.amount === "number") {
    const amt = typeof pricing.amount === "number" ? `$${pricing.amount.toLocaleString()}` : "";
    const orig = typeof pricing.originalAmount === "number" ? `<s>$${pricing.originalAmount.toLocaleString()}</s>` : "";
    sections.push(`
    <section class="sec">
      ${kicker("pricing", "Investment")}
      <div class="price" style="background:${secondaryInk}">
        <div>
          <div class="price-name">${esc(pricing.name || "Package")}</div>
          ${pricing.note ? `<div class="price-note">${esc(pricing.note)}</div>` : ""}
        </div>
        <div class="price-amt">${orig}${amt}${pricing.interval ? `<span class="price-int">/${esc(pricing.interval)}</span>` : ""}</div>
      </div>
    </section>`);
  }

  // ── TERMS + NEXT STEPS ──
  if (terms.length || nextSteps.length) {
    sections.push(`
    <section class="sec">
      ${kicker("whatsNext", "What happens next")}
      <div class="cols2">
        ${terms.length ? `<div><h3>${h("termsTitle", "Terms")}</h3><ul class="checks">${terms.map((t) => `<li><span class="ck">✓</span><span>${nl2br(t)}</span></li>`).join("")}</ul></div>` : ""}
        ${nextSteps.length ? `<div><h3>${h("nextStepsTitle", "Next steps")}</h3><ol class="steps">${nextSteps.map((s, i) => `<li><span class="num" style="background:${primaryInk}">${i + 1}</span><span>${nl2br(s)}</span></li>`).join("")}</ol></div>` : ""}
      </div>
    </section>`);
  }

  // ── CLOSING / CONTACT ──
  const contactLines = [contact.email, contact.phone, contact.address].filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("");
  sections.push(`
    <section class="sec">
      ${kicker("closing", "Let's get started")}
      <div class="two closing">
        <div>
          <h2>${h("closingTitle", "Ready to get started?")}</h2>
          <span class="pill" style="background:${primaryInk}">${cta}</span>
        </div>
        <div class="contact">
          <div class="cname">${esc(contact.name || brandName)}</div>
          ${contactLines}
          ${contact.website ? `<div style="color:${primaryInk};font-weight:600">${esc(contact.website)}</div>` : ""}
        </div>
      </div>
    </section>`);

  const css = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; }
    body { font-family: ${isVisual ? "-apple-system, Segoe UI, Roboto, Arial, sans-serif" : "Georgia, 'Times New Roman', serif"}; color:${ink}; background:#fff; }
    .doc { width: 794px; margin: 0 auto; background:#fff; }
    .logo { max-height: 34px; width:auto; object-fit:contain; }
    .brandname { font-family: Arial, sans-serif; font-size: 15px; font-weight: 800; letter-spacing:.04em; }
    .cover { position:relative; color:#fff; padding: 46px 54px 40px; background: linear-gradient(135deg, ${primaryInk}, ${secondaryInk}); display:flex; gap:28px; align-items:center; }
    .cover.visual-cover { color:${ink}; background:#fff; min-height: 320px; overflow:hidden; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
    .cover.visual-cover:before { content:""; position:absolute; inset:0; background-image: linear-gradient(105deg,transparent 0 18%, rgba(226,232,240,0.55) 18.2%, transparent 18.6% 34%, rgba(226,232,240,0.55) 34.2%, transparent 34.6% 100%); }
    .cover.visual-cover:after { content:""; position:absolute; right:-70px; top:-70px; width:220px; height:220px; border-radius:999px; background:${theme.accent}20; }
    .cover-in { flex:1; min-width:0; }
    .visual-cover .cover-in, .visual-cover .cover-img { position:relative; z-index:1; }
    .cover-img { flex:0 0 34%; }
    .visual-cover .cover-img { flex-basis: 38%; }
    .cover-img img { width:100%; border-radius:12px; background:rgba(255,255,255,.1); }
    .visual-cover .cover-img img { max-height:250px; object-fit:contain; background:transparent; }
    .prep { margin-top: 22px; font-family: Arial, sans-serif; font-size:11px; letter-spacing:.14em; text-transform:uppercase; opacity:.85; }
    .title { margin: 6px 0 0; font-size: 33px; font-weight: 700; line-height: 1.12; }
    .visual-cover .title { font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:42px; font-weight:900; letter-spacing:-.02em; max-width:500px; }
    .subtitle { margin: 10px 0 0; font-family: Arial, sans-serif; font-size: 14px; opacity:.92; }
    .visual-cover .subtitle { max-width:460px; color:#334155; font-size:18px; line-height:1.5; font-weight:700; opacity:1; }
    .prep-by { display:inline-block; margin-top: 22px; border-radius: 999px; padding: 7px 14px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; background:${theme.accent}; color:${textOnColor(theme.accent, ink)}; }
    .sec { padding: 26px 54px; border-top: 1px solid #eef0f3; break-inside: auto; page-break-inside: auto; }
    .kick { font-family: Arial, sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing:.14em; text-transform: uppercase; color:${primaryInk}; margin-bottom: 8px; }
    h2 { font-size: ${isVisual ? "28px" : "22px"}; font-weight: ${isVisual ? "900" : "700"}; margin: 0; }
    h3 { font-size: 16px; font-weight: ${isVisual ? "800" : "700"}; margin: 0 0 8px; }
    .body { font-size: 14px; line-height: 1.7; color:#26313f; margin: 8px 0 0; }
    .two { display:flex; gap:28px; align-items:flex-start; }
    .two.about { align-items:center; }
    .two.closing { align-items:center; }
    .side-img { flex:0 0 38%; }
    .side-img img { width:100%; border-radius:12px; }
    .two .body, .two > div { flex:1; min-width:0; }
    .cards { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .card { border:1px solid #e7eaee; border-radius: 12px; padding: 14px; break-inside: avoid; page-break-inside: avoid; }
    .chip { display:inline-block; height:26px; width:26px; border-radius:8px; background:${primaryInk}; }
    .card-title { margin-top: 8px; font-family: Arial, sans-serif; font-size: 13.5px; font-weight: 800; color:${secondaryInk}; }
    .card-desc { margin-top: 3px; font-size: 12.5px; color:#3a4757; line-height:1.5; }
    .bullets { list-style:none; padding:0; margin: 6px 0 0; }
    .bullets li { display:flex; gap:10px; align-items:flex-start; font-size: 14px; color:#26313f; margin-top: 9px; line-height:1.5; }
    .dot { margin-top:6px; height:9px; width:9px; border-radius:50%; flex:0 0 auto; background:${primaryInk}; }
    .rings { display:flex; flex-wrap:wrap; gap: 20px; margin-top: 14px; }
    .ring { width: 96px; text-align:center; }
    .ringc { height: 84px; width: 84px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto; font-family: Arial, sans-serif; font-weight: 800; padding: 6px; overflow:hidden; word-break:break-word; line-height:1.05; }
    .ring small { display:block; margin-top: 7px; font-family: Arial, sans-serif; font-size: 11px; color:#55606e; }
    .tl { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .tlc { border:1px solid #e7eaee; border-radius: 12px; padding: 10px; break-inside: avoid; page-break-inside: avoid; }
    .tll { font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; text-transform:uppercase; letter-spacing:.05em; }
    .tlt { margin-top: 3px; font-size: 13px; font-weight: 700; }
    .tld { margin-top: 3px; font-size: 12px; color:#55606e; }
    .price { display:flex; flex-wrap:wrap; align-items:center; gap: 14px; border-radius: 14px; padding: 16px 20px; color:#fff; font-family: Arial, sans-serif; }
    .price-name { font-size: 15px; font-weight: 800; }
    .price-note { font-size: 12px; opacity:.8; margin-top: 2px; }
    .price-amt { margin-left:auto; font-size: 26px; font-weight: 800; display:flex; align-items:baseline; gap:6px; }
    .price-amt s { font-size: 16px; font-weight: 600; opacity:.5; }
    .price-int { font-size: 13px; font-weight: 600; }
    .cols2 { display:grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 4px; }
    .checks, .steps { list-style:none; padding:0; margin: 8px 0 0; }
    .checks li { display:flex; gap:8px; align-items:flex-start; font-size: 13.5px; color:#26313f; margin-top: 8px; }
    .ck { color:#10b981; font-weight:800; }
    .steps li { display:flex; gap:10px; align-items:flex-start; font-size: 13.5px; color:#26313f; margin-top: 10px; }
    .num { height:24px; width:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family: Arial, sans-serif; font-size: 12px; font-weight:800; color:#fff; flex:0 0 auto; }
    .pill { display:inline-block; margin-top: 14px; border-radius: 999px; padding: 10px 22px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 800; color:#fff; }
    .contact { border:1px solid #e7eaee; background:#f8fafc; border-radius: 14px; padding: 16px; }
    .cname { font-size: 15px; font-weight: 800; }
    .contact div { font-size: 12.5px; color:#475569; margin-top: 4px; }
  `;

  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body><div class="doc">${sections.join("")}</div></body></html>`;
}

interface EmailRenderOpts {
  logoDataUri?: string | null;
  brandName?: string | null;
  recipientName?: string | null;
  businessName?: string | null;
  customMessage?: string | null;
  ctaUrl?: string | null;
  hasPdf?: boolean;
  pdfFilename?: string | null;
}

/**
 * renderProposalEmailHtml — the NEW branded pitch email, mirroring the Pitch
 * Studio "Cold pitch email" (EmailPreview): a gradient header band with the
 * brand + "Quick note for {name}", the subject, a short "Hey {name} 👋" note
 * built from the executive summary, up to 3 ✓ benefit bullets, a CTA, sign-off,
 * and the attached-PDF chip. Email-client-safe (tables + inline styles, gradient
 * with a solid fallback). Replaces the legacy audit-score email for service
 * proposals so the SENT email matches what the user sees in the Studio.
 */
export function renderProposalEmailHtml(content: ServiceProposalContent, opts: EmailRenderOpts = {}): string {
  const c = content;
  const theme = getProposalTheme(c);
  const primary = visibleOnWhite(theme.primary);
  const secondary = visibleOnWhite(theme.secondary);
  const ink = theme.ink || "#0f172a";
  const brandName = opts.brandName || c.preparedBy || (typeof c.brandSnapshot?.name === "string" ? c.brandSnapshot.name : "") || "Your brand";
  const to = esc(opts.recipientName || c.preparedFor || opts.businessName || "there");
  const subject = esc(c.subject || c.title || "A quick proposal for you");
  const summary = nl2br(c.executiveSummary || c.clientNeed || "");
  const bullets = arr<string>(c.commitments).length ? arr<string>(c.commitments).slice(0, 3) : arr<string>(c.benefits).slice(0, 3);
  const ctaUrl = esc(opts.ctaUrl || "https://flowsmartly.com");
  const grad = `linear-gradient(135deg, ${primary}, ${secondary})`;

  const logo = opts.logoDataUri
    ? `<img src="${esc(opts.logoDataUri)}" alt="${esc(brandName)}" height="24" style="height:24px;width:auto;display:block;border:0;"/>`
    : `<span style="font-size:15px;font-weight:800;letter-spacing:.3px;color:#ffffff;font-family:Arial,sans-serif;">${esc(brandName)}</span>`;

  const bulletsHtml = bullets.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">${bullets.map((b) => `
        <tr><td valign="top" width="26" style="padding:3px 0;"><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${primary};color:#ffffff;font-size:11px;font-weight:700;text-align:center;line-height:18px;">✓</span></td>
        <td style="padding:3px 0;font-size:14px;line-height:1.5;color:#1f2937;font-family:Arial,sans-serif;">${esc(b)}</td></tr>`).join("")}</table>`
    : "";

  const customBlock = opts.customMessage
    ? `<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px;padding:12px 14px;margin:12px 0 0;font-size:13px;color:#166534;font-family:Arial,sans-serif;">${nl2br(opts.customMessage)}</div>`
    : "";

  const pdfChip = opts.hasPdf
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;background:${primary}0d;border:1px solid ${primary}55;border-radius:12px;">
        <tr><td style="padding:10px 0 10px 12px;"><span style="display:inline-block;width:30px;height:30px;border-radius:8px;background:${primary};color:#fff;text-align:center;line-height:30px;font-size:15px;">📎</span></td>
        <td style="padding:10px 14px 10px 10px;font-family:Arial,sans-serif;"><div style="font-size:12.5px;font-weight:700;color:#111827;">${esc(opts.pdfFilename || "proposal.pdf")}</div><div style="font-size:11.5px;color:#6a7280;">The full branded proposal is attached.</div></td></tr>
      </table>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef1f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.12);">
        <tr><td style="background:${primary};background:${grad};padding:16px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td align="left" valign="middle">${logo}</td>
            <td align="right" valign="middle"><span style="display:inline-block;background:rgba(255,255,255,0.16);color:#ffffff;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:5px 10px;border-radius:999px;font-family:Arial,sans-serif;">Quick note for ${to}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:26px 28px;color:${esc(ink)};">
          <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#8a94a2;font-family:Arial,sans-serif;">Subject</div>
          <div style="font-size:18px;font-weight:800;line-height:1.25;color:#0f172a;margin:2px 0 0;font-family:Arial,sans-serif;">${subject}</div>
          <p style="font-size:15px;font-weight:700;margin:18px 0 0;color:#0f172a;font-family:Arial,sans-serif;">Hey ${to} 👋</p>
          ${customBlock}
          <p style="font-size:14.5px;line-height:1.6;color:#26313f;margin:8px 0 0;font-family:Arial,sans-serif;">${summary}</p>
          ${bulletsHtml}
          <div style="margin:22px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:${primary};background:${grad};color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:12px 26px;border-radius:999px;font-family:Arial,sans-serif;">Grab a 15-min call →</a></div>
          <p style="font-size:13.5px;color:#6a7280;margin:20px 0 0;font-family:Arial,sans-serif;">Talk soon,<br/><b style="color:${esc(ink)};">${esc(brandName)}</b></p>
          ${pdfChip}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
