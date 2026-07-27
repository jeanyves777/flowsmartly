/**
 * Voice Studio — ON-CAMERA EXPLAINER, bottom-layer graphic TEMPLATE.
 *
 * Pure HTML/CSS builder for one designed 9:16 beat frame (navy-neon, branded —
 * the GCS "What is Agentic AI?" look). No side effects, no runtime deps beyond a
 * type import, so it can be unit-tested / previewed on its own; the headless-Chrome
 * rasterizer lives in explainer-graphic.ts. [[voice-studio]]
 */
import type { ExplainerGraphic } from "./types";

export interface ExplainerGraphicBrand {
  name?: string;        // wordmark, e.g. "GCS"
  tagline?: string;     // small line under the wordmark
  accent?: string;      // primary neon, hex — default electric blue
  accent2?: string;     // secondary neon for the logo tile gradient
  logoDataUri?: string; // inlined logo (data: URI). Falls back to a monogram tile.
}

export interface RenderExplainerOptions {
  width?: number;             // default 720 (9:16)
  height?: number;            // default 1280
  /** Fraction of height reserved at the TOP for the presenter overlay. */
  presenterPct?: number;      // default 0.44
  brand?: ExplainerGraphicBrand;
  deviceScaleFactor?: number; // default 2 (retina)
}

/** Minimal stroke-icon set, keyed by the drafter's `item.icon`. Falls back to a dot. */
const ICONS: Record<string, string> = {
  goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  plan: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 3.5h6v2.2H9zM9 10h6M9 14h6M9 18h4"/>',
  tools: '<path d="M14.5 6.5a3.6 3.6 0 0 0-4.7 4.5L4 16.8 7.2 20l5.8-5.8a3.6 3.6 0 0 0 4.5-4.7l-2.3 2.3-2.2-.5-.5-2.2z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/>',
  action: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.2l2.4 2.4 4.8-5.4"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.2l2.4 2.4 4.8-5.4"/>',
  idea: '<path d="M9 16h6M9.5 19h5M12 3a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.2-1.1 2H9.5c0-.8-.4-1.5-1.1-2A6 6 0 0 1 12 3z"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V15a3 3 0 0 0 4 2.8V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V15a3 3 0 0 1-4 2.8V4z"/>',
  data: '<path d="M4 19V9m5 10V5m5 14v-7m5 7V8"/>',
  chart: '<path d="M4 19V9m5 10V5m5 14v-7m5 7V8"/>',
  time: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  money: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.3 9.3c-.5-.7-1.4-1-2.3-1-1.4 0-2.3.8-2.3 1.8 0 2.4 4.6 1.2 4.6 3.6 0 1-.9 1.9-2.3 1.9-1 0-1.9-.4-2.4-1.1"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9l-4 4v-4H6.5A2.5 2.5 0 0 1 4 12.5z"/>',
  rocket: '<path d="M12 3c3 1.5 5 4.5 5 8 0 2-.6 3.4-1.4 4.6H8.4C7.6 14.4 7 13 7 11c0-3.5 2-6.5 5-8z"/><path d="M8.4 15.6 6 18m9.6-2.4L18 18M10.5 20l1.5-2 1.5 2"/><circle cx="12" cy="10" r="1.6"/>',
  bolt: '<path d="M13 3 5 13h5l-1 8 8-11h-5z"/>',
  shield: '<path d="M12 3l7 3v5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4.5"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
};

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function icon(key: string | undefined, accent: string): string {
  const paths = (key && ICONS[key.toLowerCase()]) || '<circle cx="12" cy="12" r="3.4"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/** Emphasize the last clause after an em-dash / colon in the accent color. */
function captionHtml(caption: string, accent: string): string {
  const m = caption.match(/^(.*?[—:-])\s*(.+)$/);
  if (m) return `${esc(m[1])} <span style="color:${accent}">${esc(m[2])}</span>`;
  return esc(caption);
}

function bodyForKind(g: ExplainerGraphic, accent: string): string {
  const items = g.items || [];
  switch (g.kind) {
    case "iconflow": {
      const tiles = items.slice(0, 4).map((it) => `
        <div class="node">
          <div class="ic">${icon(it.icon, accent)}</div>
          <div class="nm">${esc(it.label)}</div>
          ${it.sub ? `<div class="sub">${esc(it.sub)}</div>` : ""}
        </div>`).join('<div class="wire"></div>');
      return `<div class="flow">${tiles}</div>`;
    }
    case "keypoints": {
      const rows = items.slice(0, 5).map((it) => `
        <div class="kp">
          <div class="kpic">${icon(it.icon || "check", accent)}</div>
          <div class="kptext"><b>${esc(it.label)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ""}</div>
        </div>`).join("");
      return `<div class="keypoints">${rows}</div>`;
    }
    case "stat": {
      const s = g.stat || { value: items[0]?.label || "—" };
      return `<div class="stat"><div class="statval">${esc(s.value)}</div>${s.label ? `<div class="statlbl">${esc(s.label)}</div>` : ""}</div>`;
    }
    case "quote": {
      const q = g.caption || items[0]?.label || "";
      return `<div class="quote"><span class="mark">“</span>${esc(q)}<span class="mark">”</span></div>`;
    }
    case "diagram":
    default: {
      if (items.length <= 3) {
        const tiles = items.slice(0, 3).map((it) => `
          <div class="node"><div class="ic">${icon(it.icon, accent)}</div><div class="nm">${esc(it.label)}</div></div>`)
          .join('<div class="wire"></div>');
        return `<div class="flow">${tiles}</div>`;
      }
      const rows = items.slice(0, 5).map((it) => `
        <div class="kp"><div class="kpic">${icon(it.icon || "check", accent)}</div><div class="kptext"><b>${esc(it.label)}</b></div></div>`).join("");
      return `<div class="keypoints">${rows}</div>`;
    }
  }
}

export function buildExplainerHtml(g: ExplainerGraphic, opts: RenderExplainerOptions = {}): string {
  const w = opts.width ?? 720;
  const h = opts.height ?? 1280;
  const presenterPct = Math.min(0.6, Math.max(0.3, opts.presenterPct ?? 0.44));
  const topPct = Math.round(presenterPct * 100);
  const b = opts.brand || {};
  const accent = b.accent || "#3b9dff";
  const accent2 = b.accent2 || "#0a3faa";
  const brandName = (b.name || "").trim();
  const tagline = (b.tagline || "").trim();
  const headline = (g.headline || "").trim();
  const caption = (g.caption || "").trim();

  const logo = b.logoDataUri
    ? `<img class="logoimg" src="${b.logoDataUri}" alt="" />`
    : brandName
      ? `<span class="gg">${esc(brandName.slice(0, 1))}</span><span class="wm">${esc(brandName)}${tagline ? `<small>${esc(tagline)}</small>` : ""}</span>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${w}px;height:${h}px}
    body{
      font-family:"Arial Black","Segoe UI",system-ui,Arial,sans-serif;
      color:#fff; position:relative; overflow:hidden;
      background:radial-gradient(120% 55% at 50% 0%, #12224e 0%, #0b1330 45%, #060b1c 100%);
    }
    .grid{position:absolute;inset:0;opacity:.35;
      background-image:radial-gradient(rgba(120,170,255,.18) 1px, transparent 1.4px);
      background-size:26px 26px;}
    .glowR{position:absolute;right:-60px;top:6%;width:120px;height:60%;
      background:radial-gradient(closest-side, ${accent}44, transparent);filter:blur(8px);}
    .presenter{position:absolute;left:0;right:0;top:0;height:${topPct}%;
      background:radial-gradient(90% 120% at 50% -10%, rgba(150,190,255,.16), transparent 60%);
      border-bottom:2px solid ${accent};box-shadow:0 6px 26px -8px ${accent}88;}
    .brand{position:absolute;left:26px;top:24px;display:flex;align-items:center;gap:12px;z-index:5}
    .gg{display:grid;place-items:center;width:44px;height:44px;border-radius:11px;font-size:22px;
      background:linear-gradient(135deg, ${accent}, ${accent2});box-shadow:0 0 22px -4px ${accent}aa;}
    .wm{font-size:26px;letter-spacing:.02em;line-height:1}
    .wm small{display:block;font-family:"Segoe UI",Arial,sans-serif;font-weight:700;font-size:9px;letter-spacing:.22em;color:#9dc3ff;margin-top:3px}
    .logoimg{height:52px;width:auto;filter:drop-shadow(0 0 16px ${accent}66)}
    .title{position:absolute;left:50%;top:${topPct}%;transform:translate(-50%,-50%);z-index:6;
      white-space:nowrap;font-size:30px;letter-spacing:.02em;padding:12px 26px;border-radius:14px;
      border:2px solid ${accent};background:#08122b;box-shadow:0 0 26px -6px ${accent}aa;text-transform:uppercase}
    .body{position:absolute;left:0;right:0;top:${topPct}%;bottom:0;padding:120px 40px 150px;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
    .flow{display:flex;align-items:flex-start;justify-content:center;gap:10px;width:100%}
    .node{display:flex;flex-direction:column;align-items:center;gap:12px;flex:1;max-width:150px}
    .ic{width:110px;height:110px;border-radius:24px;display:grid;place-items:center;
      border:2.5px solid ${accent};background:rgba(10,25,60,.65);box-shadow:0 0 26px -6px ${accent}88, inset 0 0 20px -8px ${accent}55}
    .ic svg{width:58px;height:58px}
    .nm{font-size:24px;letter-spacing:.06em}
    .sub{font-family:"Segoe UI",Arial,sans-serif;font-weight:600;font-size:14px;color:#a9c6ff;text-align:center}
    .wire{flex:0 0 26px;height:3px;margin-top:54px;border-radius:3px;
      background:linear-gradient(90deg, transparent, ${accent}, transparent);box-shadow:0 0 10px ${accent}}
    .keypoints{display:flex;flex-direction:column;gap:26px;width:100%;max-width:560px}
    .kp{display:flex;align-items:center;gap:22px}
    .kpic{flex:0 0 78px;width:78px;height:78px;border-radius:18px;display:grid;place-items:center;
      border:2.5px solid ${accent};background:rgba(10,25,60,.65);box-shadow:0 0 20px -6px ${accent}88}
    .kpic svg{width:42px;height:42px}
    .kptext b{display:block;font-size:30px;letter-spacing:.01em}
    .kptext span{display:block;font-family:"Segoe UI",Arial,sans-serif;font-weight:600;font-size:18px;color:#a9c6ff;margin-top:4px}
    .stat{text-align:center}
    .statval{font-size:150px;line-height:.9;color:${accent};text-shadow:0 0 40px ${accent}77}
    .statlbl{font-size:30px;margin-top:18px;letter-spacing:.02em}
    .quote{font-size:40px;line-height:1.25;text-align:center;max-width:600px;font-style:italic}
    .quote .mark{color:${accent};font-size:64px;line-height:0;vertical-align:-.25em}
    .caption{position:absolute;left:0;right:0;bottom:70px;text-align:center;padding:0 44px;z-index:6;
      font-size:31px;line-height:1.25;text-shadow:0 2px 12px rgba(0,0,0,.7)}
  </style></head><body>
    <div class="grid"></div><div class="glowR"></div>
    <div class="presenter"></div>
    ${logo ? `<div class="brand">${logo}</div>` : ""}
    ${headline ? `<div class="title">${esc(headline)}</div>` : ""}
    <div class="body">${bodyForKind(g, accent)}</div>
    ${caption ? `<div class="caption">${captionHtml(caption, accent)}</div>` : ""}
  </body></html>`;
}
