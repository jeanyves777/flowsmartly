/** Materialize only the approved V5 public catalogue; no network, env or credential reads. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
const sourceIndex = process.argv.indexOf("--source");
const source = process.argv[sourceIndex + 1];
if (sourceIndex < 0 || !source || basename(source) !== "billing-offers.ts")
  throw new Error(
    "Supply the approved native packages/contracts/src/billing-offers.ts with --source.",
  );
const bytes = readFileSync(resolve(source), "utf8").replaceAll("\r\n", "\n");
if (
  !bytes.includes("export const BILLING_OFFERS") ||
  !bytes.includes("export function billingOfferPrice") ||
  /(?:sk_live_|sk_test_|whsec_|price_|prod_)/.test(bytes)
)
  throw new Error("Source is not the credential-free native public catalogue.");
const digest = createHash("sha256").update(bytes).digest("hex");
const target = fileURLToPath(
  new URL("../src/content/billing-offers.ts", import.meta.url),
);
const generated = `// Generated public facts from flowsmartly-v5/packages/contracts/src/billing-offers.ts.\n// Source SHA256: ${digest}. Regenerate with scripts/sync-billing-offers.mjs; do not edit prices here.\n${bytes}`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== generated)
    throw new Error(
      "Public/native catalogue drift. Regenerate from the approved source.",
    );
} else writeFileSync(target, generated);
console.log(
  `Public catalogue ${process.argv.includes("--check") ? "matches" : "materialized"} native SHA256 ${digest}`,
);
