// scripts/test-leads-google.mjs — local Google Places (lead-finding) API test.
// Mirrors src/app/api/leads/search/route.ts (Places text search + place details).
// Run from the repo root:
//   node scripts/test-leads-google.mjs "dentists" "Austin, TX"

import fs from "node:fs";
import path from "node:path";

// Load env the same way the app does (reads .env / .env.local in the repo root).
for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("❌ GOOGLE_MAPS_API_KEY (or GOOGLE_API_KEY) not set.");
  console.error("   1) Google Cloud Console → enable the 'Places API'.");
  console.error("   2) Create an API key.");
  console.error("   3) Add to .env:  GOOGLE_MAPS_API_KEY=AIza...");
  process.exit(1);
}
console.log(`✓ GOOGLE_MAPS_API_KEY loaded (len ${apiKey.length})`);

const query = process.argv[2] || "dentists";
const location = process.argv[3] || "Austin, TX";
const searchQuery = [query, location].filter(Boolean).join(" in ");

// Step 1 — text search → place IDs.
const textUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
textUrl.searchParams.set("query", searchQuery);
textUrl.searchParams.set("type", "establishment");
textUrl.searchParams.set("key", apiKey);

console.log(`→ Text search: "${searchQuery}"`);
const search = await fetch(textUrl).then((r) => r.json());
if (search.status !== "OK" && search.status !== "ZERO_RESULTS") {
  console.error(`✗ Google Places error: ${search.status} — ${search.error_message || ""}`);
  process.exit(1);
}
const places = (search.results || []).slice(0, 5);
console.log(`  ✓ ${search.results?.length || 0} results (showing ${places.length}):`);
for (const p of places) {
  console.log(`    • ${p.name} — ${p.formatted_address}  (★${p.rating ?? "—"}, ${p.user_ratings_total ?? 0} reviews)`);
}

// Step 2 — details (phone + website) for the first result.
if (places[0]) {
  const detUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detUrl.searchParams.set("place_id", places[0].place_id);
  detUrl.searchParams.set("fields", "name,formatted_phone_number,website");
  detUrl.searchParams.set("key", apiKey);
  const det = await fetch(detUrl).then((r) => r.json());
  const r = det.result || {};
  console.log(`  ✓ details[0]: ${r.name} · ${r.formatted_phone_number || "no phone"} · ${r.website || "no website"}`);
}
console.log("done");
