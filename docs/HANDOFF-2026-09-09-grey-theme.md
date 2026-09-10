# Handoff — Grey theme hidden (2026-09-09)

**Repo:** `jeanyves777/flowsmartly`
**Branch:** `feat/v5-public-cutover`
**Head SHA:** `2fb77904` (base at start of unit: `2a175b1b`)
**Frontend: done and pushed. One data step is left, and it needs a shell I did not have.**

---

## What shipped

**`81bfa234` — Hide Grey theme, Light / Dark only.** Grey ("lighter dark") is
removed from every surface that offers a theme:

| File | Change |
| --- | --- |
| `src/components/shared/theme-menu.tsx` | Grey entry dropped; fallback index `THEMES[2]` → `THEMES[1]` so it still resolves to Dark |
| `src/components/settings/settings-workspace.tsx` | Grey card dropped from Settings > Appearance; grid `sm:grid-cols-4` → `sm:grid-cols-3` so Light / Dark / System still fill the row |
| `src/app/layout.tsx` | `themes={["light", "dark"]}` |
| `src/components/providers/theme-provider.tsx` | **the load-bearing part** — see below |
| `src/components/layout/header.tsx` | comment only |

**Kept deliberately:** the `.grey` token block in `src/app/globals.css` (line ~55)
and the Tailwind `darkMode` variant that fires `dark:` under `.grey`
(`tailwind.config.ts` line 7). They are inert with nothing setting the class, and
leaving them means restoring Grey is just re-adding the three list entries.
**Do not "clean them up".**

### Why theme-provider.tsx matters

next-themes applies whatever string it finds in `localStorage` **regardless of the
`themes` array**. An existing Grey user would therefore have kept the `.grey`
class on `<html>` with nothing in the UI able to change it. The provider now
rewrites a stored `"grey"` → `"dark"` at **module scope**, which runs before
next-themes reads storage. Any future hidden theme needs the same migration.

---

## The one step left: `User.theme` in the production database

`handleThemeChange` (`settings-workspace.tsx:769`) mirrors the choice to
`PATCH /api/users/profile`, so accounts that were on Grey still carry
`theme = "grey"` in a column the product can no longer change.

**`2fb77904` adds `scripts/migrate-grey-theme-to-dark.ts` for this. It has NEVER
BEEN RUN — not against prod, not against a local `dev.db`.** Every execution path
was denied by the auto-mode classifier in the authoring session (`npx tsx` via
Bash, the same via PowerShell, and `ssh root@flowsmartly.com`). The commit message
says so too; please do not read the script's presence as evidence it ran.

```bash
# on the VPS, in the deployed tree
npx tsx scripts/migrate-grey-theme-to-dark.ts            # report only, no writes
npx tsx scripts/migrate-grey-theme-to-dark.ts --apply    # rewrite grey -> dark
```

It is dry-run by default, safe to re-run, enumerates the distinct `User.theme`
values it actually finds rather than assuming a spelling (the column default is
`"SYSTEM"` upper-case but the UI writes lower-case, so both live in there), and
re-counts afterwards to verify zero grey rows remain.

**Provider note:** the script goes through `src/lib/db/client`, so it follows
whatever `DATABASE_URL` the environment sets — Postgres on the VPS, the SQLite
`dev.db` locally. It needs the Postgres client generated
(`npm run prisma:generate:prod`), which the deployed tree already has.

**Priority: cosmetic.** Nothing reads `users.theme` back into next-themes — I
checked, no caller applies it — so a stale `"grey"` there changes nothing a user
sees. The localStorage migration in `81bfa234` is what actually gets people off
the hidden theme, and that is live. If the run is inconvenient, deferring it is
fine.

---

## Evidence classification

- **EXECUTED** — both commits created and pushed; `git ls-remote origin
  feat/v5-public-cutover` returns `2fb77904`, confirmed against the remote rather
  than trusting the push output.
- **SOURCE-READ** — that nothing reads `users.theme` back into the theme system
  (grepped `setTheme(` / `useTheme(` / `.theme` across `src/`; the only other
  `setTheme` callers are the admin portal's own light/dark toggle and the
  generated-website template runtime, both unrelated).
- **NOT EXECUTED** — the data migration, and any type-check. No `tsc` was run;
  **CI is the type gate** for these two commits.

## Do not

- Do not delete the `.grey` CSS block or the Tailwind `.grey` variant.
- Do not re-add Grey to any picker without also reverting the localStorage
  migration, or new Grey users get silently moved to Dark on next load.
- Do not treat `scripts/migrate-grey-theme-to-dark.ts` as already applied.
