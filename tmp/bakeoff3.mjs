// Round 3 — push xAI (STANDARD winner) to gpt-image polish: 2K resolution +
// stronger premium art-direction. 3 variants to pick the best recipe.
import fs from "node:fs";
import path from "node:path";
const ROOT = "d:/Flowsmartly/flowsmartly";
const OUT = path.join(ROOT, "design", "bakeoff");
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const XAI = env.XAI_API_KEY;

const BRIEF = `Design a premium SOCIAL MEDIA MARKETING flyer for "FlowSmartly", an all-in-one AI growth platform (SaaS). Square social post.
HEADER: brand name "FlowSmartly" as a clean logo lockup, top-left; a small pill tag "AI-POWERED GROWTH WORKSPACE" beside it.
HERO: a realistic modern app-dashboard mockup on a laptop + phone showing analytics charts, a content calendar and social scheduling, floating with a soft glow.
HEADLINE (big, bold): "Create, Sell, and Grow with AI".
SUBHEAD: "Run content, commerce, local listings, customer messages, and reporting from one focused workspace."
FEATURE ROW: 4 labeled feature chips with small line-icons: "AI Studio", "Social Calendar", "Email & SMS", "Analytics".
CTA: a bright rounded button "Try for free" with a small arrow, and tiny reassurance text "No credit card required".
FOOTER: a styled brand-colored footer bar with the website "flowsmartly.com".
Brand palette: deep indigo/blue, electric blue, warm orange accent.`;

const BASE_RULES = `
RENDER RULES (follow exactly):
• FULL-BLEED, EDGE-TO-EDGE: fill the ENTIRE canvas corner to corner. NO outer frame, NO border, NO margin, NO rounded-card container, NO drop shadow around the whole design, NO paper/poster/device mockup bezel around the artwork, and it must NOT sit on any second background. The design IS the whole image, bleeding off all four edges.
• TYPOGRAPHY: ultra-crisp, vector-sharp, PERFECTLY SPELLED. Use the EXACT words above — never misspell, duplicate, garble or invent text. Kerned, grid-aligned, clear headline→subhead→body→footer hierarchy.
• ONE brand mark only in the header; never repeat the logo/wordmark.`;

const PREMIUM_POLISH = `
• PREMIUM FINISH (match the polish of Stripe, Linear, Vercel and Notion marketing): layered depth with subtle glassmorphism cards (thin 1px light strokes, gentle inner glow), refined gradients, tasteful geometric accents and connective lines, realistic high-fidelity device UI mockups with legible micro-charts, cinematic soft key-lighting and soft ambient shadows, immaculate spacing on a strict grid, rich but restrained color, poster-grade 4K sharpness. Award-winning senior art-director quality. No blur, no noise, no watermark, no lorem ipsum.`;

const variants = [
  { name: "R3-xai-v1-base2k", prompt: `${BRIEF}\n${BASE_RULES}` },
  { name: "R3-xai-v2-premium2k", prompt: `${BRIEF}\n${BASE_RULES}\n${PREMIUM_POLISH}` },
  { name: "R3-xai-v3-premium2k", prompt: `${BRIEF}\n${BASE_RULES}\n${PREMIUM_POLISH}\n• Editorial hero composition: the device mockups sit upper-right at a slight angle catching a warm rim light; the headline anchors the left; feature chips form one clean row above a crisp CTA; the footer is a solid brand bar. Think enterprise SaaS launch ad.` },
];

async function xai(name, prompt) {
  const t = Date.now();
  const r = await fetch("https://api.x.ai/v1/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI}` }, body: JSON.stringify({ model: "grok-imagine-image-quality", prompt, n: 1, aspect_ratio: "1:1", response_format: "b64_json", resolution: "2k" }) });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  fs.writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from((await r.json()).data[0].b64_json, "base64"));
  console.log(`  ${name} ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
for (const v of variants) { console.log(v.name); try { await xai(v.name, v.prompt); } catch (e) { console.log("  FAIL:", e.message); } }
console.log("DONE");
