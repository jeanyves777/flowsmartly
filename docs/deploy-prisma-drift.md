# Prisma schema drift and the deploy — diagnosis and proposed reconciliation

**Status: the July 2026 drift is already reconciled. Production is clean today.**
This document records what happened, why the reconciliation that was applied was
the right one, and what to do the next time a schema change tries to drop a
column. **Nothing here has been executed against production**, and nothing here
should be, without an explicit authorization for a destructive DB change.

Written 2026-08-11 from live evidence on `root@flowsmartly.com` (read-only).

---

## 1. Why this matters to the deploy pipeline

`scripts/deploy-vps.sh` runs `prisma db push` on **every** deploy. That is how
schema ships: the deploy is the single place the production schema advances.

Prisma flags two very different things as "data loss" and refuses both
non-interactively:

- **Real loss** — dropping a column or table that holds rows.
- **Merely cautious** — adding a `@unique` constraint, which *could* fail on
  duplicates but usually doesn't.

The current script tells them apart: it runs `prisma migrate diff` first, applies
an additive-only diff with `--accept-data-loss`, and for anything containing
`DROP COLUMN` / `DROP TABLE` runs the plain push so it **fails loudly with the
specifics**. That gate is deliberate and should stay. A destructive schema change
is supposed to stop the deploy.

The compounding failure is what this lane exists for: before this PR, a deploy
that failed here was never retried (see `scripts/poll-deploy.sh`), so a schema
drift didn't just block one release — it silently blocked *every* release until
someone noticed.

---

## 2. What happened, with evidence

From `/var/log/flowsmartly-deploy.log`:

| Time (UTC) | Event |
|---|---|
| 2026-07-17 20:52 | Deploy of `73be414a` fails. `db push` refuses: 7 columns would be dropped, plus a new `@unique` on `xaiPhoneNumberId`. |
| 2026-07-17 → 07-18 | Six more commits fail at the same step (`62c20dd2`, `59ae070d`, `911bde0d`, `d6662863`, `e8dbb150`). Every merge in that window shipped nothing. |
| 2026-07-18 00:00 | `243c64fb` — *"Schema: retain PhoneNumber/VoiceAgent legacy columns (unblock deploy) (#250)"* — re-adds all 7 columns to `schema.prisma`. **It still fails**, now on the `@unique` warning alone. |
| 2026-07-18 00:13 | `MANUAL: deploy-vps.sh triggered by authorized unblock` — a human resolved it. |
| later | `deploy-vps.sh` gains the additive-vs-destructive diff gate, so a bare `@unique` add can no longer wedge a release. |

The exact refusal text, verbatim from the log:

```
• You are about to drop the column `cancelAtPeriodEnd` on the `PhoneNumber` table, which still contains 1 non-null values.
  … numberType, rentCredits, smsCapable, source, voiceCapable …
• You are about to drop the column `voice` on the `VoiceAgent` table, which still contains 1 non-null values.
• A unique constraint covering the columns `[xaiPhoneNumberId]` on the table `PhoneNumber` will be added.
```

**Read "non-null values" carefully.** These are `NOT NULL` columns with defaults.
"1 non-null value" meant one row existed, not that one row carried meaningful
data. Prisma cannot tell the difference; a human must.

## 3. Current production state — the drift is gone

```
$ npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma --script
-- This is an empty migration.
```

The production DB and `prisma/schema.prisma` agree exactly. All seven columns are
present in both. `PhoneNumber_xaiPhoneNumberId_key` exists as a UNIQUE index.
`prisma db push` on prod today is a no-op, so **the manual fallback workflow is
not broken** — it would run cleanly. It was broken between 2026-07-17 and the
manual unblock; it is not broken now.

The chosen reconciliation was **additive**: put the columns back in the schema
rather than drop them from the database. That was the correct call, and it should
be the default whenever a legacy column's fate is uncertain — a column that
nothing reads costs a few bytes a row; a column dropped in error costs data that
does not come back.

## 4. Per-column diagnosis

Live data, `2026-08-11`, `PhoneNumber` (6 rows) and `VoiceAgent` (3 rows):

| Column | Reads in the codebase | Live data | Verdict |
|---|---|---|---|
| `PhoneNumber.source` | **none** (`source: "RENTED"\|"FORWARDED"\|"SMS_LINKED"` — 0 writes) | 4 `RENTED`, **2 `FORWARDED`** | **Preserve.** No code reads it, but the 2 non-default rows are the only record that those lines are not ours to bill. Information without a reader is still information. |
| `PhoneNumber.rentCredits` | **none** (0 word-boundary hits; earlier greps matched `cur`+`rentCredits`) | 4 × `500` (default), **2 × `0`** | **Preserve.** The two zeros pair with the two `FORWARDED` rows and encode "never charge". |
| `PhoneNumber.numberType` | **none.** The 11 `numberType` hits are all the Telnyx *search API* parameter (`lib/telnyx/numbers.ts`, `api/sms/numbers`, the SMS settings page) — a different thing with the same name. | all `local` (default) | Droppable. Carries no information. |
| `PhoneNumber.voiceCapable` | **none** | all `true` (default) | Droppable. |
| `PhoneNumber.smsCapable` | **none** | all `false` (default) | Droppable. |
| `PhoneNumber.cancelAtPeriodEnd` | **none** | all `false` (default) | Droppable. |
| `VoiceAgent.voice` | **none.** The `voice:` hits in `api/voice-agent/voices/clone` are a JSON *response* field; `lib/voice-agent/session-config.ts` and `xai-phone.ts` read `agent.voiceId`, not `agent.voice`. | `'{}'` on **all 3 rows** — the schema default, i.e. never written | Droppable. Genuinely empty. |
| `PhoneNumber.twilioSid`, `rentPaidUntil`, `rentLastBilled`, `emergencyAddressSid` | **none** (the 4 `emergencyAddressSid` hits write `MarketingConfig.smsEmergencyAddressSid` from a Telnyx result — a different column) | all NULL | Same family; listed for completeness. |

**A correction to the schema's own comment.** `prisma/schema.prisma` justifies
retaining these with *"These columns still back the SMS / number-rental system."*
They do not. SMS line rental runs entirely off `MarketingConfig.smsPhoneNumber` /
`MarketingConfig.smsRentalChargedAt` (`api/cron/sms-number-rentals`), and voice
number rental reads only `PhoneNumber.rentalChargedAt`
(`api/cron/voice-number-rentals`). Neither cron touches any of the seven columns.
The retention was right; the stated reason was not. This PR corrects the comment
so the next person doesn't inherit a false premise — a comment change only, no
schema change, so the diff stays empty.

## 5. Proposed reconciliation — NOT executed

The drift is resolved and the deploy is unblocked, so **the correct action today
is to do nothing to the database.** Dropping five dead columns to tidy up would
require a destructive production migration to reclaim a few kilobytes. That trade
is not worth making, and this lane has no authorization to make it.

If someone later decides the cleanup is worth doing, this is the shape it must
take. It is a proposal, not a runbook to execute unprompted:

1. **Split the change.** Two columns (`source`, `rentCredits`) carry information;
   five do not. They must not travel in one commit — a single `DROP` in the diff
   makes the whole deploy destructive and the gate refuses all of it.
2. **Preserve first, drop second.** Before any `DROP` of `source`/`rentCredits`,
   the "don't bill this line" fact must live somewhere a reader exists for —
   most naturally by giving `PhoneNumber` an explicit `billable Boolean` and
   backfilling `billable = (source <> 'FORWARDED')`. Ship the backfill, verify it
   in production, and only then propose the drop, in a later release.
3. **The five inert columns** (`numberType`, `voiceCapable`, `smsCapable`,
   `cancelAtPeriodEnd`, `VoiceAgent.voice`) can be dropped without a backfill —
   every row holds the schema default and nothing reads them. Even so this needs
   an explicit human authorization, a fresh `pg_dump` of both tables taken
   immediately beforehand, and a `migrate diff --script` reviewed by eye and
   confirmed to contain *only* the intended `DROP COLUMN` lines.
4. **Never `--accept-data-loss` against production to get past a `DROP`.** That
   flag exists in `deploy-vps.sh` only on the additive branch, where the sole
   "loss" a diff can contain is a new constraint. Widening it would convert the
   gate from a safety mechanism into a rubber stamp.
5. **Expect the fallback to be unnecessary.** With the retry semantics in this PR,
   a schema-drift failure now retries, then reports `stuck` with `failedStep:
   "Syncing DB schema (prisma db push)"` — so the operator learns *what* broke
   from `/api/version` and the log, and re-runs with `poll-deploy.sh --force`
   after fixing the schema. The dispatch-only workflow remains available but is
   no longer the only recovery path.

## 6. Rule of thumb for future schema changes

> Removing a field from `prisma/schema.prisma` is a **production data change**,
> not a code change, and CI cannot see it. If your PR deletes a model field,
> either keep the column (annotate why) or get explicit authorization for the
> drop — otherwise your merge will stop every deploy behind it, not just yours.
