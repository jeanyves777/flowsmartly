import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ── PLANT 8 — the mutation guard ─────────────────────────────────────
//
// A test that only checks "the contact was imported successfully" says nothing
// about the defect. This one fails the moment the pattern comes back, anywhere
// — including in a route that does not exist yet.
//
// The pattern: deriving a consent flag from the presence of a channel.
//   emailOptedIn: !!email        smsOptedIn: !!phone
//   emailOptedIn: Boolean(email) emailOptedInAt: email ? new Date() : null
//
// Possession is not consent. If a new source genuinely carries authoritative
// evidence of an affirmative act, it does not look like this — it carries the
// disclosure, the timestamp and the provenance, and it earns its own review.

const SRC = join(process.cwd(), "src");

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  {
    pattern: /\b(email|sms)OptedIn\s*:\s*!!/,
    why: "consent derived from the presence of a channel",
  },
  {
    pattern: /\b(email|sms)OptedIn\s*:\s*Boolean\s*\(/,
    why: "consent derived from the presence of a channel",
  },
  {
    pattern: /\b(email|sms)OptedInAt\s*:\s*\w+\s*\?\s*new Date\(\)/,
    why: "an opt-in timestamp derived from the presence of a channel",
  },
];

/**
 * Sites carrying the pattern that are being corrected elsewhere. Listed so the
 * guard is honest about what it is not yet covering, rather than being weakened
 * to accommodate them. A stale entry is harmless; a missing one is a bug.
 */
const KNOWN_UNFIXED: Record<string, string> = {
  "app/api/data-forms/[id]/sync-contacts/route.ts":
    "corrected on the public-form self-entry branch (#534), which owns this file",
  "app/api/contacts/route.ts":
    "same defect, different shape: an owner-supplied boolean that FALLS BACK to possession. Reported, not changed — an owner asserting consent about their own contact is a different question from an import inventing it, and it needs its own decision",
  "lib/ai/flow-agent/tools/contact-tools.ts":
    "the agent's create_contact tool, same possession fallback as app/api/contacts/route.ts and the same open question",
  "lib/ai/flow-agent/tools/import-contacts-csv.ts":
    "THE SAME OPERATION as the governed CSV import, through the agent. A `defaultOptIn` tool argument plus possession of the channel sets the flag, so the governed route can be bypassed by asking the agent to import the file instead. Left unchanged only because this lane was scoped to two named files; it is the first follow-up and it is not optional",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function relative(file: string): string {
  return file.slice(SRC.length + 1).split("\\").join("/");
}

test("no source derives marketing consent from possessing a channel", () => {
  const violations: string[] = [];

  for (const file of walk(SRC)) {
    const rel = relative(file);
    const lines = readFileSync(file, "utf8").split("\n");

    lines.forEach((line, index) => {
      for (const { pattern, why } of FORBIDDEN) {
        if (!pattern.test(line)) continue;
        if (KNOWN_UNFIXED[rel]) return;
        violations.push(`${rel}:${index + 1} — ${why}\n    ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    violations,
    [],
    `possession is not consent:\n\n${violations.join("\n")}\n`
  );
});

test("the two governed intake paths never write a consent column directly", () => {
  const governed = [
    "app/api/contacts/import/route.ts",
    "app/api/follow-ups/[id]/export-contacts/route.ts",
  ];

  for (const rel of governed) {
    const lines = readFileSync(join(SRC, ...rel.split("/")), "utf8").split("\n");

    lines.forEach((line, index) => {
      // A type annotation declares a shape; it does not grant anything.
      if (/:\s*(boolean|Date \| null|string \| null)\s*;?\s*$/.test(line)) return;

      for (const column of ["emailOptedIn", "smsOptedIn", "emailOptedInAt", "smsOptedInAt"]) {
        assert.ok(
          !new RegExp(`\\b${column}\\s*:`).test(line),
          `${rel}:${index + 1} sets ${column} inline — it must go through contact-intake, which grants nothing:\n    ${line.trim()}`
        );
      }
    });
  }
});

test("the guard actually catches the pattern it claims to", () => {
  // Guarding the guard: a regex that matches nothing would pass silently.
  const samples = [
    "emailOptedIn: !!email,",
    "smsOptedIn: !!phone,",
    "emailOptedIn: Boolean(email),",
    "emailOptedInAt: email ? new Date() : null,",
    "smsOptedInAt: phone ? new Date() : null,",
  ];

  for (const sample of samples) {
    assert.ok(
      FORBIDDEN.some(({ pattern }) => pattern.test(sample)),
      `the guard would not have caught: ${sample}`
    );
  }

  // ...and does not fire on legitimate reads or explicit grants.
  const allowed = [
    "where: { emailOptedIn: true },",
    "select: { smsOptedIn: true },",
    "data: { smsOptedIn: true, smsOptedInAt: new Date() },", // the opt-in page
  ];
  for (const sample of allowed) {
    assert.ok(
      !FORBIDDEN.some(({ pattern }) => pattern.test(sample)),
      `the guard fires on a legitimate line: ${sample}`
    );
  }
});
