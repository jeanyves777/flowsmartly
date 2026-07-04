// Reproduce the REAL Campaign Studio image path: generateBrandedImage() with a
// dev brand-kit user that HAS a logo, so we see routing (xAI vs Nano-Banana),
// the single-vs-duplicate logo, and text quality — the actual failure surface.
import fs from "node:fs";
import path from "node:path";
for (const l of fs.readFileSync("d:/Flowsmartly/flowsmartly/.env", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

const { prisma } = await import("../src/lib/db/client");
const { generateBrandedImage } = await import("../src/lib/media/branded-image");

const kit = await prisma.brandKit.findFirst({ where: { logo: { not: null } }, select: { userId: true, name: true } })
  || await prisma.brandKit.findFirst({ select: { userId: true, name: true } });
if (!kit) { console.log("no brand kit in dev DB"); process.exit(0); }
console.log(`using brand kit: ${kit.name} (user ${kit.userId})`);

const prompt = `Your growth team doesn't sleep — and now neither does your workflow. Watch AI agents handle emails, schedule content, and organize leads while you rest. FlowSmartly works the night shift. CTA: Start your free trial.`;

const t = Date.now();
const res = await generateBrandedImage({ userId: kit.userId, prompt, tier: "standard", orientation: "square", skipCredits: true });
console.log(`generateBrandedImage in ${((Date.now() - t) / 1000).toFixed(1)}s →`, { ok: res.ok, designId: res.designId, err: res.error });

if (res.designId) {
  const row = await prisma.design.findUnique({ where: { id: res.designId }, select: { imageUrl: true, metadata: true } });
  console.log("stored imageUrl:", row?.imageUrl);
  try { const meta = JSON.parse(row?.metadata || "{}"); console.log("provider/model:", meta.provider, meta.pipeline); } catch {}
  const url = row?.imageUrl || "";
  if (url.startsWith("/")) {
    const local = path.join(process.cwd(), "public", url);
    if (fs.existsSync(local)) { fs.copyFileSync(local, "d:/Flowsmartly/flowsmartly/design/bakeoff/CAMPAIGN-repro.png"); console.log("saved CAMPAIGN-repro.png"); }
    else console.log("local file not found at", local);
  } else console.log("imageUrl is remote (S3); not fetched");
}
process.exit(0);
