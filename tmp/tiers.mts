// Final validation: both tiers through the REAL router + shipped recipe.
// Standard (design_generate → xAI@2K) and Premium (premium → gpt-image-1),
// plus the Standard fallback (Nano Banana) for completeness.
import fs from "node:fs";
for (const l of fs.readFileSync("d:/Flowsmartly/flowsmartly/.env", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

const { generateImageForRole, generateImageWithProvider } = await import("../src/lib/ai/image-router");
const { buildArtDirection } = await import("../src/lib/ai/image-recipe");
const { getRecipeConfig } = await import("../src/lib/ai/media-policy");

const brief = `Design a premium social post for "FlowSmartly", an all-in-one AI growth platform (SaaS). Square.
Header: brand name lockup top-left + a pill tag "AI-POWERED GROWTH WORKSPACE".
Hero: a realistic app-dashboard mockup on a laptop + phone, floating with a soft glow.
Headline: "Create, Sell, and Grow with AI".
Subhead: "Run content, commerce, local listings, customer messages, and reporting from one focused workspace."
Feature row: 4 chips with line-icons: "AI Studio", "Social Calendar", "Email & SMS", "Analytics".
CTA: a bright rounded "Try for free" button + tiny "No credit card required".
Footer: a brand-colored bar with "flowsmartly.com".`;

const recipe = await getRecipeConfig();
const prompt = `${brief}\n\n${buildArtDirection({ recipe, hasLogo: false })}`;
const OUT = "d:/Flowsmartly/flowsmartly/design/bakeoff";
const save = (name, r) => { if (r.base64) { fs.writeFileSync(`${OUT}/${name}.${r.format === "jpeg" ? "jpg" : "png"}`, Buffer.from(r.base64, "base64")); console.log(`  ${name}: ${r.provider}/${r.model}`); } };

console.log("Standard (design_generate)…");
const t1 = Date.now(); const std = await generateImageForRole("design_generate", prompt, 1024, 1024, { quality: "high" }); console.log(`  ${((Date.now()-t1)/1000).toFixed(1)}s`); save("TIER-standard", std);

console.log("Premium (premium)…");
const t2 = Date.now(); const prem = await generateImageForRole("premium", prompt, 1024, 1024, { quality: "high" }); console.log(`  ${((Date.now()-t2)/1000).toFixed(1)}s`); save("TIER-premium", prem);

console.log("Standard fallback (Nano Banana direct)…");
const t3 = Date.now(); const nb = await generateImageWithProvider("gemini", prompt, 1024, 1024, { quality: "high", model: "gemini-2.5-flash-image" }); console.log(`  ${((Date.now()-t3)/1000).toFixed(1)}s`); save("TIER-nanobanana", nb);

console.log("DONE");
process.exit(0);
