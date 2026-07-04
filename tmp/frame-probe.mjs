// Root-cause probe: what FRAMING language makes grok-imagine add the outer
// frame/matte? Hold the content constant, vary only the wrapper. xAI @2K.
import fs from "node:fs";
import path from "node:path";
const ROOT = "d:/Flowsmartly/flowsmartly";
const OUT = path.join(ROOT, "design", "bakeoff");
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const XAI = env.XAI_API_KEY;

// Constant CONTENT (no framing words).
const BODY = `Content to lay out:
- Header: brand name "FlowSmartly" as a clean wordmark, top-left; a small pill tag "AI-POWERED GROWTH WORKSPACE" top-right.
- Hero: a realistic app-dashboard mockup on a laptop + phone (analytics charts, content calendar), floating with a soft glow, center-left.
- Headline (large, bold): "Create, Sell, and Grow with AI".
- Subhead: "Run content, commerce, local listings, customer messages, and reporting from one focused workspace."
- Feature row: 4 glassmorphism chips with line-icons: "AI Studio", "Social Calendar", "Email & SMS", "Analytics".
- CTA: a bright rounded "Try for free" button + tiny "No credit card required".
- Footer: a brand-colored bar spanning the full width with "flowsmartly.com".
Brand palette: deep indigo/blue, electric blue, warm orange accent. Premium SaaS aesthetic, crisp typography, correct spelling.`;

const NEG = "No border, no frame, no matte, no passe-partout, no vignette, no rounded outer corners, no drop shadow around the whole image, no inner card, no darker surround. The background reaches and touches all four edges of the image.";

const CANVAS = `You are painting a graphic that fills the ENTIRE square image canvas, edge to edge. The IMAGE ITSELF IS the finished artwork — it is NOT a photograph of a printed flyer, poster, card, postcard, or sheet of paper, and it is NOT a design placed on top of any surface, wall, desk, table, mat, or secondary background. There is exactly ONE layer. The background gradient bleeds off all four edges; the corner pixels are part of the design.`;

const variants = [
  // W0 — control: object-priming word "flyer" (the current failure mode)
  { name: "F0-flyer", prompt: `Design a premium social media marketing flyer, square 1:1.\n\n${BODY}` },
  // W1 — same object word BUT add strong border negatives
  { name: "F1-flyer-neg", prompt: `Design a premium social media marketing flyer, square 1:1.\n\n${BODY}\n\nComposition: fill the ENTIRE square image edge to edge. ${NEG}` },
  // W2 — remove object words, "canvas IS artwork" framing + negatives
  { name: "F2-canvas-neg", prompt: `${CANVAS}\n\n${BODY}\n\n${NEG}` },
  // W3 — "website hero section that fills the whole viewport" analogy + negatives
  { name: "F3-hero-neg", prompt: `Create a single full-bleed hero graphic, like a website hero section that fills the entire browser viewport with no page margins. Square 1:1. ${CANVAS}\n\n${BODY}\n\n${NEG}` },
];

async function xai(name, prompt) {
  const t = Date.now();
  const r = await fetch("https://api.x.ai/v1/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI}` }, body: JSON.stringify({ model: "grok-imagine-image-quality", prompt, n: 1, aspect_ratio: "1:1", response_format: "b64_json", resolution: "2k" }) });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  fs.writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from((await r.json()).data[0].b64_json, "base64"));
  console.log(`  ${name} ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
for (const v of variants) { console.log(v.name); try { await xai(v.name, v.prompt); } catch (e) { console.log("  FAIL", e.message); } }
console.log("DONE");
