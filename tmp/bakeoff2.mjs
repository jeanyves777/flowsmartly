// Round 2 — art-directed recipe: FULL-BLEED anti-card + rich multi-section layout.
// Goal: match DESIGN_ESAMPLE quality across xAI / Gemini Nano Banana / gpt-image-1.
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const ROOT = "d:/Flowsmartly/flowsmartly";
const OUT = path.join(ROOT, "design", "bakeoff");
fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const XAI = env.XAI_API_KEY, OPENAI = env.OPENAI_API_KEY, GEMINI = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;

// ── The BRIEF (rich, like example #6 "Powered by FlowSmartly") ──
const BRIEF = `Design a premium SOCIAL MEDIA MARKETING flyer for "FlowSmartly", an all-in-one AI growth platform (SaaS). Vertical/square social post.
HEADER: the brand name "FlowSmartly" as a clean logo lockup, top-left; a small pill tag "AI-POWERED GROWTH WORKSPACE" beside it.
HERO: a realistic modern app-dashboard mockup on a laptop + phone, showing analytics charts, a content calendar, and social scheduling — floating with a soft glow.
HEADLINE (big, bold): "Create, Sell, and Grow with AI".
SUBHEAD: "Run content, commerce, local listings, customer messages, and reporting from one focused workspace."
FEATURE ROW: 4 labeled feature chips with small line-icons: "AI Studio", "Social Calendar", "Email & SMS", "Analytics".
CTA: a bright rounded call-to-action button "Try for free" with a small arrow, and tiny reassurance text "No credit card required".
FOOTER: a styled brand-colored footer bar with the website "flowsmartly.com".
Brand palette: deep indigo/blue, electric blue, and a warm orange accent. Clean, modern, trustworthy tech aesthetic.`;

// ── ART DIRECTION wrapper — the reusable quality/anti-card recipe ──
const ARTDIR = `
RENDER RULES (follow exactly):
• FULL-BLEED, EDGE-TO-EDGE: the artwork MUST fill the ENTIRE canvas from corner to corner. NO outer frame, NO border, NO padding/margin, NO rounded-card container, NO drop shadow around the design, NO paper/poster/phone/browser mockup bezel, and it must NOT sit on top of any second background or backdrop. The design itself IS the whole image, bleeding off all four edges.
• AGENCY QUALITY: senior graphic-designer, award-winning marketing flyer. Strong visual hierarchy, generous but intentional use of space, balanced grid, layered depth (subtle gradients, soft glows, geometric accents), professional iconography.
• TYPOGRAPHY: crisp, modern, PERFECTLY SPELLED. Use the EXACT words given above — do not misspell, duplicate, garble, or invent text. Clear headline → subhead → body → footer hierarchy.
• ONE brand mark only: render the brand name lockup a SINGLE time in the header; do NOT repeat the logo/wordmark anywhere else.
• Photoreal where photos/mockups are called for; clean vector style for icons/cards.
• High resolution, sharp, no blur, no watermark, no stock-photo watermark, no lorem ipsum.`;

const PROMPT = `${BRIEF}\n${ARTDIR}`;

const save = (name, b64, ext) => { fs.writeFileSync(path.join(OUT, `${name}.${ext}`), Buffer.from(b64, "base64")); console.log("  saved", `${name}.${ext}`); };

async function xai(name) {
  const t = Date.now();
  const r = await fetch("https://api.x.ai/v1/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI}` }, body: JSON.stringify({ model: "grok-imagine-image-quality", prompt: PROMPT, n: 1, aspect_ratio: "1:1", response_format: "b64_json" }) });
  if (!r.ok) throw new Error(`xai ${r.status}: ${(await r.text()).slice(0, 200)}`);
  save(name, (await r.json()).data[0].b64_json, "jpg"); console.log(`  xai ${((Date.now()-t)/1000).toFixed(1)}s`);
}
async function openai(name, model = "gpt-image-1") {
  const t = Date.now();
  const r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` }, body: JSON.stringify({ model, prompt: PROMPT, n: 1, size: "1024x1024", quality: "high" }) });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
  save(name, (await r.json()).data[0].b64_json, "png"); console.log(`  openai(${model}) ${((Date.now()-t)/1000).toFixed(1)}s`);
}
const genai = new GoogleGenAI({ apiKey: GEMINI });
async function nano(name) {
  const t = Date.now();
  const res = await genai.models.generateContent({ model: "gemini-2.5-flash-image", contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\n[Output a single 1:1 image.]` }] }], config: { responseModalities: ["TEXT", "IMAGE"] } });
  const img = (res.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!img) throw new Error("nano: no image"); save(name, img.inlineData.data, "png"); console.log(`  nano ${((Date.now()-t)/1000).toFixed(1)}s`);
}
const run = async (l, fn) => { console.log(l); try { await fn(); } catch (e) { console.log("  FAIL:", e.message); } };

await run("[R2] xai", () => xai("R2-xai"));
await run("[R2] nano-banana", () => nano("R2-nanobanana"));
await run("[R2] gpt-image-1", () => openai("R2-gptimage1", "gpt-image-1"));
console.log("DONE");
