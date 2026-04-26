/**
 * Smoke test for the premium HTML template designer pipeline.
 *
 * Runs end-to-end (skipping DB + S3): Claude generates HTML for a
 * single style → headless Chromium screenshots it → save the PNG to
 * `tmp-smoke-test.png` so you can eyeball the polish locally before
 * deploying to prod.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-html-designer.ts "happy birthday"
 *   npx tsx scripts/smoke-test-html-designer.ts "wedding invitation" "Photo collage"
 *
 * Default style: "Elegant gold-foil" (matches the Bro George reference).
 */
import fs from "node:fs/promises";
import path from "node:path";
// tsx doesn't auto-load .env like Next.js does — pull it in manually
// so ANTHROPIC_API_KEY is available before we import the designer.
import "dotenv/config";
import { designTemplateAsHtml, HTML_STYLE_VARIANTS } from "../src/lib/ai/template-html-designer";
import { renderHtmlToPng, closeRenderer } from "../src/lib/utils/html-renderer";

async function main() {
  const query = process.argv[2] || "happy birthday";
  const styleLabel = process.argv[3] || "Elegant gold-foil";

  if (!HTML_STYLE_VARIANTS.find((v) => v.label === styleLabel)) {
    console.error(`Unknown style "${styleLabel}". Valid: ${HTML_STYLE_VARIANTS.map((v) => v.label).join(", ")}`);
    process.exit(1);
  }

  console.log(`[smoke] query="${query}" style="${styleLabel}"`);
  console.log(`[smoke] step 1/2 — calling Claude designTemplateAsHtml…`);
  const t0 = Date.now();
  const { html, inputTokens, outputTokens } = await designTemplateAsHtml({
    query,
    styleLabel,
    width: 1080,
    height: 1350,
  });
  const t1 = Date.now();
  console.log(`[smoke]   ✓ Claude responded in ${t1 - t0}ms (input=${inputTokens} output=${outputTokens} tokens)`);
  console.log(`[smoke]   ✓ HTML length: ${html.length} chars`);

  // Sanity checks
  if (!/<html/i.test(html)) throw new Error("HTML missing <html> tag");
  if (!/fonts\.googleapis\.com/i.test(html)) console.warn("[smoke]   ⚠ no Google Fonts link found — Claude may have used system fonts");
  if (!/(linear-gradient|radial-gradient)/i.test(html)) console.warn("[smoke]   ⚠ no gradients found — design may be flat");

  // Save the HTML for inspection
  const htmlOut = path.resolve(process.cwd(), "tmp-smoke-test.html");
  await fs.writeFile(htmlOut, html, "utf8");
  console.log(`[smoke]   ✓ HTML saved to ${htmlOut}`);

  console.log(`[smoke] step 2/2 — rendering with headless Chromium…`);
  const t2 = Date.now();
  const png = await renderHtmlToPng(html, {
    width: 1080,
    height: 1350,
    deviceScaleFactor: 2,
    fontLoadDelayMs: 2000,
  });
  const t3 = Date.now();
  console.log(`[smoke]   ✓ Screenshot complete in ${t3 - t2}ms (${(png.length / 1024).toFixed(1)} KB PNG)`);

  const pngOut = path.resolve(process.cwd(), "tmp-smoke-test.png");
  await fs.writeFile(pngOut, png);
  console.log(`[smoke]   ✓ PNG saved to ${pngOut}`);
  console.log(`[smoke] DONE — total ${t3 - t0}ms. Open the PNG to inspect.`);

  await closeRenderer();
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
