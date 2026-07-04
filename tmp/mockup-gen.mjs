// Generate realistic blank product mockups via xAI (grok-imagine-image-quality
// @2K) for Print Studio. Front view, flat, clean uniform background so we can
// background-remove them and overlay the user's artwork on the print zone.
import fs from "node:fs";
import path from "node:path";
const ROOT = "d:/Flowsmartly/flowsmartly";
const OUT = path.join(ROOT, "design", "mockups-test");
fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const XAI = env.XAI_API_KEY;

const RULES = "Front view, perfectly centered, flat and facing the camera, floating (ghost-mannequin / flat-lay style) on a SOLID uniform light-gray studio background with soft even lighting and a soft contact shadow. Crisp e-commerce product photography, high detail, photorealistic. ABSOLUTELY NO text, NO logo, NO graphics, NO print, NO pattern on the product — a completely BLANK product ready for a design. No people, no hands, no props.";

const ITEMS = [
  { name: "tee", prompt: `A plain blank WHITE cotton crew-neck t-shirt. ${RULES}` },
  { name: "hoodie", prompt: `A plain blank heather-gray pullover hoodie with a front kangaroo pocket and drawstrings. ${RULES}` },
  { name: "vest", prompt: `A blank high-visibility safety vest in hi-vis yellow with two horizontal and two vertical silver reflective stripes, sleeveless, open front with a zipper. ${RULES}` },
  { name: "cap", prompt: `A plain blank black baseball cap / structured 6-panel cap, three-quarter front view showing the crown and the curved bill. ${RULES}` },
  { name: "tote", prompt: `A plain blank natural canvas tote bag with two handles, standing upright. ${RULES}` },
  { name: "mug", prompt: `A plain blank white ceramic coffee mug with a handle on the right, side view. ${RULES}` },
  { name: "bottle", prompt: `A plain blank stainless-steel insulated water bottle with a screw cap, upright, side view. ${RULES}` },
];

async function gen(name, prompt) {
  const t = Date.now();
  const r = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI}` },
    body: JSON.stringify({ model: "grok-imagine-image-quality", prompt, n: 1, aspect_ratio: "1:1", response_format: "b64_json", resolution: "2k" }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  fs.writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from((await r.json()).data[0].b64_json, "base64"));
  console.log(`  ${name} ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
for (const it of ITEMS) { console.log(it.name); try { await gen(it.name, it.prompt); } catch (e) { console.log("  FAIL", e.message); } }
console.log("DONE");
