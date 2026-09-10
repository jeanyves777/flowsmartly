/**
 * One-off data fix: rewrite `User.theme = "grey"` to `"dark"`.
 * ===========================================================
 *
 * Grey mode was hidden from the UI on 2026-09-09 (commit 81bfa234) - it is gone
 * from the ThemeMenu, from Settings > Appearance, and from the ThemeProvider
 * `themes` array. `theme-provider.tsx` migrates each browser's localStorage on
 * load, and that is what actually drives the class on <html>; this script cleans
 * the mirror that `handleThemeChange` PATCHes to /api/users/profile, so the
 * column stops advertising a theme the product no longer offers.
 *
 * The UI writes the value in lower case ("light"/"dark"/"system") but the column
 * default is "SYSTEM", so both cases coexist. This enumerates the distinct
 * values it actually finds rather than assuming a spelling - anything not in the
 * list below is printed, never silently rewritten.
 *
 * Dry run by default. Pass --apply to write.
 *
 *     npx tsx scripts/migrate-grey-theme-to-dark.ts            # report only
 *     npx tsx scripts/migrate-grey-theme-to-dark.ts --apply    # write
 */
import { prisma } from "../src/lib/db/client";

/** Every spelling of grey we are willing to rewrite. */
const GREY = ["grey", "GREY", "Grey", "gray", "GRAY", "Gray"];

async function main() {
  const apply = process.argv.includes("--apply");

  const distinct = await prisma.user.groupBy({ by: ["theme"], _count: { theme: true } });
  console.log("Distinct User.theme values before:");
  for (const row of [...distinct].sort((a, b) => b._count.theme - a._count.theme)) {
    console.log(`  ${JSON.stringify(row.theme)} -> ${row._count.theme}`);
  }

  const targets = distinct.filter((r) => GREY.includes(r.theme));
  const total = targets.reduce((n, r) => n + r._count.theme, 0);
  if (total === 0) {
    console.log("\nNothing to do: no row holds a grey theme.");
    return;
  }
  console.log(`\n${total} row(s) hold a grey theme: ${targets.map((r) => JSON.stringify(r.theme)).join(", ")}`);

  if (!apply) {
    console.log('Dry run - re-run with --apply to rewrite them to "dark".');
    return;
  }

  const result = await prisma.user.updateMany({ where: { theme: { in: GREY } }, data: { theme: "dark" } });
  console.log(`Updated ${result.count} row(s) to "dark".`);

  const after = await prisma.user.count({ where: { theme: { in: GREY } } });
  console.log(after === 0 ? "Verified: no grey rows remain." : `WARNING: ${after} grey row(s) still present.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
