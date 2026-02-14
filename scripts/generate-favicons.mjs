import sharp from "sharp";
import { mkdirSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const source = resolve(root, "templogo_location/flowsmartly_icone.png");

const targets = [
  { path: "src/app/favicon.ico", size: 32 },
  { path: "src/app/icon.png", size: 512 },
  { path: "src/app/apple-icon.png", size: 180 },
  { path: "public/icon-192.png", size: 192 },
  { path: "public/icon-512.png", size: 512 },
];

async function generate() {
  for (const target of targets) {
    const outPath = resolve(root, target.path);
    mkdirSync(dirname(outPath), { recursive: true });
    await sharp(source)
      .resize(target.size, target.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`Generated ${target.path} (${target.size}x${target.size})`);
  }
  console.log("Done!");
}

generate().catch(console.error);
