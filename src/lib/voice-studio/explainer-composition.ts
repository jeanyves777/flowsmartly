/**
 * Voice Studio — ON-CAMERA EXPLAINER, HyperFrames-style composition builder.
 *
 * Produces a self-contained HTML composition (vendored GSAP + a PAUSED master timeline on
 * `window.__timelines.main`) that renderHtmlToVideo seeks frame-by-frame. Everything visual is a
 * CSS VARIABLE — colour, font, radius, glow — so the LOOK is a swappable token set (a "style"),
 * NOT hardcoded. The user picks a style; the Brand Kit tints the same tokens. This is the richer,
 * animated replacement for the flat explainer-template.ts. [[hyperframes-oncam-graphics]]
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { ExplainerGraphic, ExplainerStyleId } from "./types";

// ── vendored GSAP (read once, inlined into every composition so there is NO CDN dependency) ──
let GSAP_SRC = "";
function gsapSrc(): string {
  if (!GSAP_SRC) GSAP_SRC = readFileSync(join(process.cwd(), "src/lib/voice-studio/vendor/gsap.min.js"), "utf8");
  return GSAP_SRC;
}

export interface CompositionBrand { accent?: string; accent2?: string; }
export interface CompositionOptions {
  width?: number;
  height?: number;
  holdSec?: number;
  presenterPct?: number;
  style?: ExplainerStyleId;
  brand?: CompositionBrand;
}

// ── style presets: each is only a token set (validated against real renders) ──
const PRESETS: Record<ExplainerStyleId, { fonts: string; vars: Record<string, string> }> = {
  neon: {
    fonts: "Space+Grotesk:wght@500;700&family=Inter:wght@400;600",
    vars: {
      "--bg": "radial-gradient(120% 60% at 50% 0%, #16234f 0%, #0b1330 46%, #05080f 100%)", "--ink": "#ffffff", "--muted": "#a9c6ff",
      "--accent": "#22d3ee", "--accent2": "#7c5cff", "--grid-op": ".35", "--grid-dot": "rgba(120,170,255,.16)",
      "--plate": "radial-gradient(90% 120% at 50% -10%,rgba(150,190,255,.12),transparent 60%)", "--plate-glow": "0 8px 50px -10px #22d3ee88",
      "--seam": "linear-gradient(90deg,transparent,var(--accent2),var(--accent),transparent)",
      "--font-head": "'Space Grotesk'", "--font-body": "'Inter'", "--head-weight": "700", "--head-ls": "-.01em", "--head-style": "normal", "--hl-glow": "0 0 40px #22d3ee66",
      "--kicker-ls": ".28em", "--kicker-tt": "uppercase", "--kicker-col": "var(--accent)", "--kicker-border": "1.5px solid rgba(34,211,238,.4)", "--kicker-bg": "rgba(8,18,43,.6)",
      "--radius": "22px", "--card-bg": "rgba(14,22,48,.72)", "--card-border": "1.5px solid rgba(124,140,220,.25)", "--card-glow": "0 20px 50px -20px rgba(0,0,0,.7), inset 0 0 30px -18px #7c5cff88", "--card-blur": "blur(3px)",
      "--ic-bg": "linear-gradient(160deg,#1c2547,#141b34)", "--ic-border": "2px solid var(--accent2)", "--ic-glow": "0 0 30px -8px #7c5cffaa",
      "--bar": "linear-gradient(180deg,var(--accent2),var(--accent))", "--caption-col": "#eaf0ff", "--caption-glow": "0 2px 16px rgba(0,0,0,.7)",
    },
  },
  editorial: {
    fonts: "Libre+Baskerville:wght@400;700&family=Libre+Franklin:wght@400;600",
    vars: {
      "--bg": "#f4f1ea", "--ink": "#1c1b26", "--muted": "#6c6a78", "--accent": "#b4472e", "--accent2": "#b4472e", "--grid-op": "0", "--grid-dot": "transparent",
      "--plate": "linear-gradient(180deg,#efe9dc,#f4f1ea)", "--plate-glow": "none", "--seam": "linear-gradient(90deg,transparent,#c9b79a,var(--accent),#c9b79a,transparent)",
      "--font-head": "'Libre Baskerville'", "--font-body": "'Libre Franklin'", "--head-weight": "700", "--head-ls": "0", "--head-style": "normal", "--hl-glow": "none",
      "--kicker-ls": ".18em", "--kicker-tt": "uppercase", "--kicker-col": "var(--accent)", "--kicker-border": "1px solid #d8c9b0", "--kicker-bg": "transparent",
      "--radius": "6px", "--card-bg": "#ffffff", "--card-border": "1px solid #e4dccb", "--card-glow": "0 12px 30px -18px rgba(60,40,20,.25)", "--card-blur": "none",
      "--ic-bg": "#faf7f0", "--ic-border": "1px solid #e4dccb", "--ic-glow": "none",
      "--bar": "linear-gradient(180deg,var(--accent),#d98b58)", "--caption-col": "#3a3730", "--caption-glow": "none",
    },
  },
  minimal: {
    fonts: "Inter:wght@400;600;800",
    vars: {
      "--bg": "#0e0e11", "--ink": "#f5f5f7", "--muted": "#8a8a93", "--accent": "#6ee7b7", "--accent2": "#6ee7b7", "--grid-op": "0", "--grid-dot": "transparent",
      "--plate": "#131317", "--plate-glow": "none", "--seam": "linear-gradient(90deg,transparent,#2a2a30,var(--accent),#2a2a30,transparent)",
      "--font-head": "'Inter'", "--font-body": "'Inter'", "--head-weight": "800", "--head-ls": "-.02em", "--head-style": "normal", "--hl-glow": "none",
      "--kicker-ls": ".1em", "--kicker-tt": "uppercase", "--kicker-col": "var(--accent)", "--kicker-border": "1px solid #26262c", "--kicker-bg": "transparent",
      "--radius": "14px", "--card-bg": "#16161a", "--card-border": "1px solid #24242b", "--card-glow": "none", "--card-blur": "none",
      "--ic-bg": "#1d1d22", "--ic-border": "1px solid #2c2c34", "--ic-glow": "none",
      "--bar": "linear-gradient(180deg,var(--accent),#34d399)", "--caption-col": "#c9c9d2", "--caption-glow": "none",
    },
  },
  bold: {
    fonts: "Space+Grotesk:wght@700&family=Inter:wght@600;800",
    vars: {
      "--bg": "linear-gradient(150deg,#3a0ca3 0%,#7209b7 45%,#f72585 100%)", "--ink": "#ffffff", "--muted": "#ffd6ef", "--accent": "#ffdd00", "--accent2": "#ffdd00", "--grid-op": ".14", "--grid-dot": "rgba(255,255,255,.5)",
      "--plate": "linear-gradient(180deg,rgba(0,0,0,.18),transparent)", "--plate-glow": "none", "--seam": "linear-gradient(90deg,transparent,var(--accent),#fff,var(--accent),transparent)",
      "--font-head": "'Space Grotesk'", "--font-body": "'Inter'", "--head-weight": "700", "--head-ls": "-.02em", "--head-style": "normal", "--hl-glow": "0 0 30px rgba(255,221,0,.55)",
      "--kicker-ls": ".16em", "--kicker-tt": "uppercase", "--kicker-col": "#111", "--kicker-border": "none", "--kicker-bg": "var(--accent)",
      "--radius": "28px", "--card-bg": "rgba(10,4,24,.42)", "--card-border": "2px solid rgba(255,255,255,.28)", "--card-glow": "0 24px 60px -22px rgba(0,0,0,.6)", "--card-blur": "blur(6px)",
      "--ic-bg": "rgba(255,255,255,.16)", "--ic-border": "2px solid rgba(255,255,255,.4)", "--ic-glow": "none",
      "--bar": "linear-gradient(180deg,var(--accent),#ff9e00)", "--caption-col": "#ffffff", "--caption-glow": "0 2px 16px rgba(0,0,0,.4)",
    },
  },
};

const EMOJI: Record<string, string> = { goal: "🎯", target: "🎯", plan: "🗺️", tools: "🛠️", gear: "⚙️", action: "⚡", check: "✅", idea: "💡", brain: "🧠", data: "📊", chart: "📈", time: "⏱️", clock: "⏱️", money: "💰", chat: "💬", rocket: "🚀", bolt: "⚡", shield: "🛡️", user: "👤" };
const KIND_FALLBACK: Record<string, string> = { title: "✨", iconflow: "🔀", keypoints: "📌", stat: "📈", quote: "💬", diagram: "🧩" };

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const icon = (key?: string) => EMOJI[(key || "").toLowerCase()] || "•";
const subjectEmoji = (g: ExplainerGraphic) => (g.subject || KIND_FALLBACK[g.kind] || "✨").trim();

/** Emphasise the clause after an em-dash/colon in the accent colour. */
function headHtml(text: string): string {
  const m = text.match(/^(.*?[—:-])\s*(.+)$/);
  if (m) return `${esc(m[1])} <span class="hl">${esc(m[2])}</span>`;
  const words = text.split(" ");
  if (words.length > 2) { const i = Math.floor(words.length / 2); words[i] = `<span class="hl">${esc(words[i])}</span>`; return words.map((w, k) => (k === i ? w : esc(w))).join(" "); }
  return esc(text);
}

/** Body markup + the GSAP tween lines for a beat kind. Revealable nodes carry class `rv`. */
function bodyForKind(g: ExplainerGraphic): { html: string; tweens: string } {
  const items = g.items || [];
  const hero = `<div class="hero">${esc(subjectEmoji(g))}</div>`;
  switch (g.kind) {
    case "stat": {
      const s = g.stat || { value: items[0]?.label || "—" };
      return {
        html: `<div class="stat"><div class="statval rv">${esc(s.value)}</div>${s.label ? `<div class="statlbl rv">${esc(s.label)}</div>` : ""}</div>`,
        tweens: `tl.to(".rv",{opacity:1,scale:1,duration:.55,ease:"back.out(1.5)",stagger:.14},.5).from(".rv",{scale:.6,y:20},.5);`,
      };
    }
    case "iconflow": {
      const chips = items.slice(0, 4).map((it) => `<div class="chip rv"><div class="ic">${esc(icon(it.icon))}</div><div class="cl">${esc(it.label)}</div></div>`).join('<div class="wire rv"></div>');
      return { html: `<div class="flow">${chips}</div>`, tweens: `tl.to(".rv",{opacity:1,duration:.5,ease:"power3.out",stagger:.18},.5).from(".chip.rv",{y:34,scale:.9},.5).from(".wire.rv",{scaleX:0},.5);` };
    }
    case "quote": {
      const q = g.caption || items[0]?.label || "";
      return { html: `${hero}<div class="quote rv">“${esc(q)}”</div>`, tweens: `tl.to(".rv",{opacity:1,y:0,duration:.55,ease:"power3.out",stagger:.14},.5).from(".rv",{y:24},.5);` };
    }
    case "title":
      return { html: hero, tweens: `tl.from(".hero",{opacity:0,scale:.5,rotation:-8,duration:.8,ease:"back.out(1.6)"},.15);` };
    case "keypoints":
    case "diagram":
    default: {
      const rows = items.slice(0, 4).map((it) => `<div class="kp rv"><div class="ic">${esc(icon(it.icon || "check"))}</div><div class="tx"><b>${esc(it.label)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ""}</div></div>`).join("");
      const backHero = `<div class="hero back">${esc(subjectEmoji(g))}</div>`;
      return { html: backHero + `<div class="cards">${rows}</div>`, tweens: `tl.to(".kp",{opacity:1,duration:.5,ease:"power3.out",stagger:.2},.45).from(".kp",{y:40,scale:.97},.45).from(".kp .ic",{scale:.3,rotation:-10,duration:.5,ease:"back.out(2)",stagger:.2},.5);` };
    }
  }
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:var(--w);height:var(--h);overflow:hidden;color:var(--ink);font-family:var(--font-body),system-ui,sans-serif}
#root{position:relative;width:var(--w);height:var(--h);background:var(--bg)}
.grid{position:absolute;inset:0;opacity:var(--grid-op);background-image:radial-gradient(var(--grid-dot) 1.4px,transparent 1.6px);background-size:40px 40px;-webkit-mask-image:radial-gradient(120% 90% at 50% 55%,#000 55%,transparent 92%)}
.plate{position:absolute;left:0;right:0;top:0;height:var(--plate-h);background:var(--plate);border-bottom:3px solid var(--accent);box-shadow:var(--plate-glow)}
.seam{position:absolute;left:0;right:0;top:var(--plate-h);height:3px;transform:translateY(-1.5px);background:var(--seam)}
.kickerWrap{position:absolute;left:0;right:0;top:calc(var(--plate-h) + 52px);display:flex;justify-content:center}
.kicker{font-family:var(--font-head);font-size:26px;font-weight:700;letter-spacing:var(--kicker-ls);text-transform:var(--kicker-tt);color:var(--kicker-col);padding:10px 24px;border:var(--kicker-border);border-radius:999px;background:var(--kicker-bg)}
.headWrap{position:absolute;left:70px;right:70px;top:calc(var(--plate-h) + 112px);text-align:center}
.head{font-family:var(--font-head);font-size:58px;font-weight:var(--head-weight);line-height:1.07;letter-spacing:var(--head-ls);font-style:var(--head-style)}
.head .hl{color:var(--accent);text-shadow:var(--hl-glow)}
.body{position:absolute;left:70px;right:70px;top:calc(var(--plate-h) + 200px);bottom:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;z-index:1}
.hero{font-size:150px;line-height:1;filter:drop-shadow(0 16px 24px rgba(0,0,0,.5))}
.hero.back{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);font-size:320px;opacity:.12;z-index:-1;filter:drop-shadow(0 0 44px var(--accent2))}
.cards{display:flex;flex-direction:column;gap:24px;width:100%}
.kp{display:flex;align-items:center;gap:24px;padding:26px 28px;border-radius:var(--radius);background:var(--card-bg);border:var(--card-border);box-shadow:var(--card-glow);backdrop-filter:var(--card-blur);opacity:0}
.kp .ic{flex:none;width:88px;height:88px;border-radius:calc(var(--radius) - 4px);display:grid;place-items:center;font-size:44px;background:var(--ic-bg);border:var(--ic-border);box-shadow:var(--ic-glow)}
.kp .tx b{display:block;font-family:var(--font-head);font-size:38px;font-weight:700;letter-spacing:-.01em}
.kp .tx span{display:block;font-size:23px;color:var(--muted);margin-top:4px}
.flow{display:flex;align-items:center;justify-content:center;gap:14px;width:100%}
.chip{display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0}
.chip .ic{width:130px;height:130px;border-radius:var(--radius);display:grid;place-items:center;font-size:60px;background:var(--card-bg);border:var(--card-border);box-shadow:var(--card-glow)}
.chip .cl{font-family:var(--font-head);font-size:26px;font-weight:700;letter-spacing:.02em}
.wire{flex:0 0 30px;height:4px;border-radius:4px;background:var(--accent);opacity:0;transform-origin:left center;box-shadow:0 0 12px var(--accent)}
.stat{text-align:center}
.statval{font-family:var(--font-head);font-size:150px;font-weight:700;line-height:.95;color:var(--accent);text-shadow:var(--hl-glow);opacity:0}
.statlbl{font-size:34px;margin-top:14px;color:var(--muted);opacity:0}
.quote{font-family:var(--font-head);font-size:44px;line-height:1.3;text-align:center;max-width:840px;font-style:italic;opacity:0}
.caption{position:absolute;left:0;right:0;bottom:100px;text-align:center;padding:0 80px;font-size:38px;font-weight:600;line-height:1.3;color:var(--caption-col);text-shadow:var(--caption-glow);opacity:0}`;

// Floating glassy graphics over a TRANSPARENT bg — composited onto the full-frame presenter.
const OVERLAY_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:var(--w);height:var(--h);overflow:hidden;background:transparent;color:#fff;font-family:var(--font-body),system-ui,sans-serif}
#root{position:relative;width:var(--w);height:var(--h);background:transparent}
.glass{background:var(--card-bg);border:var(--card-border);box-shadow:var(--card-glow);backdrop-filter:var(--card-blur)}
.stat{position:absolute;right:44px;top:150px;width:360px;padding:30px 32px;border-radius:26px;opacity:0}
.stat .big{font-family:var(--font-head);font-size:100px;font-weight:700;line-height:1;color:var(--accent);text-shadow:var(--hl-glow)}
.stat .lbl{font-family:var(--font-body);font-size:28px;font-weight:600;color:var(--muted);margin-top:6px}
.pill{position:absolute;left:44px;display:flex;align-items:center;gap:16px;padding:20px 26px;border-radius:999px;opacity:0;
  font-family:var(--font-head);font-size:30px;font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.pill .d{flex:none;width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:28px;background:var(--ic-bg);border:var(--ic-border)}
.lower{position:absolute;left:44px;right:44px;bottom:230px;display:flex;align-items:center;gap:26px;padding:32px 36px;border-radius:28px;opacity:0}
.lower .ic{flex:none;width:96px;height:96px;border-radius:22px;display:grid;place-items:center;font-size:48px;background:var(--ic-bg);border:var(--ic-border);box-shadow:var(--ic-glow)}
.lower .tx b{display:block;font-family:var(--font-head);font-size:48px;font-weight:700;letter-spacing:-.01em;line-height:1.1;text-shadow:0 2px 14px rgba(0,0,0,.55)}
.lower .tx .hl{color:var(--accent)}`;

/**
 * OVERLAY layout: floating glassy graphics over a TRANSPARENT background, rendered with alpha and
 * composited onto the full-frame presenter. Same token presets as the split layout (Brand Kit
 * tints --accent), so the look matches the chosen style. [[hyperframes-oncam-graphics]]
 */
export function buildOverlayComposition(g: ExplainerGraphic, opts: CompositionOptions = {}): string {
  const w = opts.width ?? 1080;
  const h = opts.height ?? 1920;
  const styleId: ExplainerStyleId = opts.style && PRESETS[opts.style] ? opts.style : "neon";
  const preset = PRESETS[styleId];
  const hold = Math.max(1, opts.holdSec ?? 4);
  const vars: Record<string, string> = { ...preset.vars, "--w": `${w}px`, "--h": `${h}px` };
  if (opts.brand?.accent && /^#([0-9a-f]{3,8})$/i.test(opts.brand.accent)) vars["--accent"] = opts.brand.accent;
  if (opts.brand?.accent2 && /^#([0-9a-f]{3,8})$/i.test(opts.brand.accent2)) vars["--accent2"] = opts.brand.accent2;
  const rootVars = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";");

  const caption = (g.caption || g.headline || "").trim();
  const items = (g.items || []).slice(0, 3);
  const isStat = g.kind === "stat" && !!g.stat;

  const statCard = isStat
    ? `<div class="stat glass"><div class="big">${esc(g.stat!.value)}</div>${g.stat!.label ? `<div class="lbl">${esc(g.stat!.label)}</div>` : ""}</div>` : "";
  const pills = isStat ? "" : items.map((it, i) =>
    `<div class="pill glass" style="top:${34 + i * 10}%"><div class="d">${esc(icon(it.icon))}</div><span>${esc(it.label)}</span></div>`).join("");
  const lower = caption
    ? `<div class="lower glass"><div class="ic">${esc(subjectEmoji(g))}</div><div class="tx"><b>${headHtml(caption)}</b></div></div>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=${w}, height=${h}"/>
<link href="https://fonts.googleapis.com/css2?family=${preset.fonts}&display=block" rel="stylesheet"/>
<script>${gsapSrc()}</script>
<style>:root{${rootVars}}${OVERLAY_CSS}</style></head>
<body><div id="root">${statCard}${pills}${lower}</div>
  <script>
    window.__timelines = window.__timelines || {};
    var tl = gsap.timeline({ paused: true });
    ${isStat ? `tl.to(".stat",{opacity:1,duration:.5,ease:"back.out(1.5)"},.25).from(".stat",{y:-26,scale:.85},.25).to(".stat",{y:-14,duration:2.2,ease:"sine.inOut",yoyo:true,repeat:1},1.1);` : ""}
    ${pills ? `tl.to(".pill",{opacity:1,duration:.45,ease:"power3.out",stagger:.2},.4).from(".pill",{x:-44},.4);` : ""}
    ${lower ? `tl.to(".lower",{opacity:1,duration:.55,ease:"power3.out"},.9).from(".lower",{y:44},.9);` : ""}
    tl.set({}, {}, ${hold});
    window.__timelines["main"] = tl;
  </script>
</body></html>`;
}

/** Build a self-contained, GSAP-timed HTML composition for one beat, in the chosen style. */
export function buildExplainerComposition(g: ExplainerGraphic, opts: CompositionOptions = {}): string {
  const w = opts.width ?? 1080;
  const h = opts.height ?? 1920;
  const platePct = Math.round((opts.presenterPct ?? 0.44) * 100);
  const styleId: ExplainerStyleId = opts.style && PRESETS[opts.style] ? opts.style : "neon";
  const preset = PRESETS[styleId];
  const hold = Math.max(1, opts.holdSec ?? 4);

  // Brand Kit tints the SAME tokens — the style defines structure/motion, the brand colours it.
  const vars: Record<string, string> = { ...preset.vars, "--w": `${w}px`, "--h": `${h}px`, "--plate-h": `${platePct}%` };
  if (opts.brand?.accent && /^#([0-9a-f]{3,8})$/i.test(opts.brand.accent)) vars["--accent"] = opts.brand.accent;
  if (opts.brand?.accent2 && /^#([0-9a-f]{3,8})$/i.test(opts.brand.accent2)) vars["--accent2"] = opts.brand.accent2;

  const rootVars = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";");
  const headline = (g.headline || "").trim();
  const caption = (g.caption || "").trim();
  const body = bodyForKind(g);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=${w}, height=${h}"/>
<link href="https://fonts.googleapis.com/css2?family=${preset.fonts}&display=block" rel="stylesheet"/>
<script>${gsapSrc()}</script>
<style>:root{${rootVars}}${CSS}</style></head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-width="${w}" data-height="${h}" data-duration="${hold}">
    <div class="grid"></div><div class="plate"></div><div class="seam"></div>
    ${headline ? `<div class="kickerWrap"><div class="kicker">${esc(headline)}</div></div>` : ""}
    ${caption && g.kind !== "quote" ? `<div class="headWrap"><div class="head">${headHtml(caption)}</div></div>` : ""}
    <div class="body">${body.html}</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    var tl = gsap.timeline({ paused: true });
    ${headline ? `tl.from(".kicker",{opacity:0,y:-14,duration:.4,ease:"power2.out"},0);` : ""}
    ${caption && g.kind !== "quote" ? `tl.from(".head",{opacity:0,y:20,duration:.55,ease:"power3.out"},.15);` : ""}
    ${body.tweens}
    tl.set({}, {}, ${hold});
    window.__timelines["main"] = tl;
  </script>
</body></html>`;
}
