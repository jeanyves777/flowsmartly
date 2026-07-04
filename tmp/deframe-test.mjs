import sharp from "sharp";
import fs from "node:fs";
const IN = "d:/Flowsmartly/flowsmartly/design/bakeoff/E2E-standard.jpg";
const OUTDIR = "d:/Flowsmartly/flowsmartly/design/bakeoff";
const input = fs.readFileSync(IN);
const meta = await sharp(input).metadata();
const ow = meta.width, oh = meta.height;
console.log("original", ow, "x", oh);
for (const threshold of [8, 14, 22, 30]) {
  try {
    const trimmed = await sharp(input).trim({ threshold }).toBuffer({ resolveWithObject: true });
    const removed = 1 - (trimmed.info.width * trimmed.info.height) / (ow * oh);
    console.log(`threshold ${threshold}: trimmed to ${trimmed.info.width}x${trimmed.info.height}  removed=${(removed * 100).toFixed(1)}%`);
    const out = await sharp(trimmed.data).resize(ow, oh, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer();
    fs.writeFileSync(`${OUTDIR}/E2E-deframed-t${threshold}.jpg`, out);
  } catch (e) { console.log(`threshold ${threshold}: FAIL ${e.message}`); }
}
console.log("done");
