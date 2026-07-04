// Exercise the REAL router path end-to-end: resolveImageChain (reads
// SystemSetting) → Standard chain (xAI quality @2K) + the recipe module.
import fs from "node:fs";
// load .env into process.env before importing app modules
for (const line of fs.readFileSync("d:/Flowsmartly/flowsmartly/.env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { generateImageForRole } = await import("../src/lib/ai/image-router");
const { buildArtDirection } = await import("../src/lib/ai/image-recipe");
const { getRecipeConfig, resolveImageChain } = await import("../src/lib/ai/media-policy");

const brief = `Design a premium social media marketing flyer for "FlowSmartly", an all-in-one AI growth platform (SaaS). Square.
HEADER: brand name lockup top-left + a small pill tag "AI-POWERED GROWTH WORKSPACE".
HERO: a realistic app-dashboard mockup on a laptop + phone, floating with a soft glow.
HEADLINE: "Create, Sell, and Grow with AI".
SUBHEAD: "Run content, commerce, local listings, customer messages, and reporting from one focused workspace."
FEATURE ROW: 4 chips with line-icons: "AI Studio", "Social Calendar", "Email & SMS", "Analytics".
CTA: a bright rounded "Try for free" button + tiny "No credit card required".
FOOTER: a brand-colored bar with "flowsmartly.com".`;

const chain = await resolveImageChain("design_generate");
console.log("resolved Standard chain:", chain.map((s) => `${s.provider}:${s.model}`).join("  →  "));
const recipe = await getRecipeConfig();
console.log("recipe:", recipe);

const prompt = `${brief}\n\n${buildArtDirection({ recipe, hasLogo: false })}`;
const t = Date.now();
const res = await generateImageForRole("design_generate", prompt, 1024, 1024, { quality: "high" });
console.log(`router returned: provider=${res.provider} model=${res.model} format=${res.format} in ${((Date.now() - t) / 1000).toFixed(1)}s`);
if (res.base64) {
  fs.writeFileSync(`d:/Flowsmartly/flowsmartly/design/bakeoff/E2E-standard.${res.format === "jpeg" ? "jpg" : "png"}`, Buffer.from(res.base64, "base64"));
  console.log("saved E2E-standard image");
}
process.exit(0);
