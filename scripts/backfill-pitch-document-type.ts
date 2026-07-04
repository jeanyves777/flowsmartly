/**
 * One-off backfill: set Pitch.documentType from the legacy JSON where the type
 * was previously smuggled (pitchContent/research `documentType: "service_proposal"`).
 * Safe to re-run. Run: npx tsx scripts/backfill-pitch-document-type.ts
 */
import { prisma } from "../src/lib/db/client";

function isProposal(pitchContent: string | null, research: string | null): boolean {
  for (const json of [pitchContent, research]) {
    if (!json) continue;
    try {
      const parsed = JSON.parse(json) as { documentType?: string };
      if (parsed?.documentType === "service_proposal") return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

async function main() {
  const rows = await prisma.pitch.findMany({ select: { id: true, pitchContent: true, research: true, documentType: true } });
  let updated = 0;
  for (const row of rows) {
    const want = isProposal(row.pitchContent, row.research) ? "service_proposal" : "pitch";
    if (row.documentType !== want) {
      await prisma.pitch.update({ where: { id: row.id }, data: { documentType: want } });
      updated++;
    }
  }
  console.log(`Backfill complete: ${rows.length} pitches scanned, ${updated} updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
