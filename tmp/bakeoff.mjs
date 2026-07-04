// Image-provider bake-off. Reproduces the failing "baked text + logo" case (A)
// and tests the "clean background, no text/logo" fix (B) across providers.
// Saves PN/JPEGs to design/bakeoff/. Run: node scratchpad/bakeoff.mjs
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const ROOT = "d:/Flowsmartly/flowsmartly";
const OUT = path.join(ROOT, "design", "bakeoff");
fs.mkdirSync(OUT, { recursive: true });

// ── load .env ──
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const XAI = env.XAI_API_KEY, OPENAI = env.OPENAI_API_KEY, GEMINI = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;

const PROMPT_A = `Design a modern SaaS social media ad, square 1:1. Deep blue gradient background with an abstract glowing network of connected nodes. Big headline "YOUR GROWTH TEAM NEVER RESTS". Body text "Watch AI agents handle emails, schedule content, and organize leads while you rest." Subtext "FlowSmartly works the night shift". A teal rounded call-to-action button that says "START FREE TRIAL". Brand name "FlowSmartly" shown at the top. A footer strip with "info@flowsmartly.com". Clean, high-end tech-startup aesthetic, crisp typography.`;

const PROMPT_B = `A premium abstract background image for a SaaS tech brand social ad, square 1:1. Deep blue-to-indigo gradient with a subtle glowing network of connected nodes and soft bokeh light orbs. Lots of clean negative space — keep the upper ~20% and the top corners calm and empty. Modern, high-end, minimal, editorial. ABSOLUTELY NO text, NO words, NO letters, NO numbers, NO logos, NO wordmarks, NO watermarks, NO UI, NO buttons, NO captions anywhere — a pure graphic background only.`;

const save = (name, b64, ext) => {
  const p = path.join(OUT, `${name}.${ext}`);
  fs.writeFileSync(p, Buffer.from(b64, "base64"));
  console.log("  saved", path.basename(p), `(${Math.round(Buffer.from(b64, "base64").length / 1024)}kb)`);
};

async function xai(prompt, name) {
  const t = Date.now();
  const r = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI}` },
    body: JSON.stringify({ model: "grok-imagine-image-quality", prompt, n: 1, aspect_ratio: "1:1", response_format: "b64_json" }),
  });
  if (!r.ok) throw new Error(`xai ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  save(name, j.data[0].b64_json, "jpg");
  console.log(`  xai ok in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

async function openai(prompt, name, model = "gpt-image-1", quality = "high") {
  const t = Date.now();
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
    body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024", quality }),
  });
  if (!r.ok) throw new Error(`openai(${model}) ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  save(name, j.data[0].b64_json, "png");
  console.log(`  openai(${model}) ok in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

const genai = new GoogleGenAI({ apiKey: GEMINI });
async function nanoBanana(prompt, name) {
  const t = Date.now();
  const res = await genai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\n[Output a single 1:1 image.]` }] }],
    config: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const parts = res.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error("nano-banana: no image");
  save(name, img.inlineData.data, "png");
  console.log(`  nano-banana ok in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
async function imagen(prompt, name, model = "imagen-4.0-ultra-generate-001") {
  const t = Date.now();
  const res = await genai.models.generateImages({ model, prompt, config: { numberOfImages: 1, aspectRatio: "1:1" } });
  const b = res.generatedImages?.[0]?.image?.imageBytes;
  if (!b) throw new Error(`imagen(${model}): no image`);
  save(name, b, "png");
  console.log(`  imagen(${model}) ok in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

const run = async (label, fn) => { console.log(label); try { await fn(); } catch (e) { console.log("  FAIL:", e.message); } };

console.log("=== VARIANT A — full designed ad, model renders all text (reproduces the bug) ===");
await run("[A] xai", () => xai(PROMPT_A, "A-xai"));
await run("[A] nano-banana", () => nanoBanana(PROMPT_A, "A-nanobanana"));
await run("[A] gpt-image-1", () => openai(PROMPT_A, "A-gptimage1", "gpt-image-1", "high"));
await run("[A] imagen-4-ultra", () => imagen(PROMPT_A, "A-imagen4ultra"));

console.log("\n=== VARIANT B — clean background, NO text/logo (the composite-fix approach) ===");
await run("[B] xai", () => xai(PROMPT_B, "B-xai"));
await run("[B] nano-banana", () => nanoBanana(PROMPT_B, "B-nanobanana"));
await run("[B] gpt-image-1", () => openai(PROMPT_B, "B-gptimage1", "gpt-image-1", "high"));
await run("[B] imagen-4-ultra", () => imagen(PROMPT_B, "B-imagen4ultra"));

console.log("\n=== probe: does gpt-image-2 exist? ===");
await run("[probe] gpt-image-2", () => openai(PROMPT_B, "B-gptimage2", "gpt-image-2", "high"));

console.log("\nDONE →", OUT);
