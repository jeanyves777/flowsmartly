import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ── The guard ────────────────────────────────────────────────────────
//
// A test that only checks "the contact was imported successfully" says nothing
// about the defect. These fail the moment consent is manufactured again —
// including in a file that does not exist yet.
//
// The first version of this guard matched only the literal `!!` spelling, and
// it missed three live sites: a nullish/ternary fallback to possession, a
// caller-supplied `defaultOptIn` argument, and a write in a route nobody had
// thought to look at. A guard that only catches the spelling you already fixed
// will not catch the fourth instance, so this one covers the shape, the
// argument, and the write site.

const SRC = join(process.cwd(), "src");

const CONSENT_COLUMNS = ["emailOptedIn", "smsOptedIn", "emailOptedInAt", "smsOptedInAt"];

/** Shape 1: a consent value derived from a channel being present. */
const POSSESSION_PATTERNS: { name: string; pattern: RegExp; why: string }[] = [
  {
    name: "double-bang",
    pattern: /\b(email|sms)OptedIn\s*:\s*!!/,
    why: "consent set from the presence of a channel",
  },
  {
    name: "Boolean()",
    pattern: /\b(email|sms)OptedIn\s*:\s*Boolean\s*\(/,
    why: "consent set from the presence of a channel",
  },
  {
    name: "nullish fallback",
    pattern: /\b(email|sms)OptedIn\s*:[^,\n]*\?\?[^,\n]*!!/,
    why: "consent falls back to possession when the caller says nothing",
  },
  {
    name: "ternary fallback",
    pattern: /\b(email|sms)OptedIn\s*:[^,\n]*\?[^,\n]*:\s*!!/,
    why: "consent falls back to possession when the caller says nothing",
  },
  {
    name: "variable derivation",
    pattern: /\b(email|sms)OptedIn\b[^=\n]*=[^;\n]*!!\s*[\w.]*\b(email|phone)\b/,
    why: "a consent variable computed from a channel being present",
  },
  {
    name: "timestamp from channel",
    pattern: /\b(email|sms)OptedInAt\s*:\s*[\w.]*\b(email|phone)\b\s*\?/,
    why: "an opt-in timestamp derived from the presence of a channel",
  },
];

/**
 * The one file still carrying shape 1, corrected on another branch. Listed
 * rather than accommodated, so it disappears from here when that branch lands
 * instead of quietly weakening the rule.
 */
const POSSESSION_EXEMPT: Record<string, string> = {
  "app/api/data-forms/[id]/sync-contacts/route.ts":
    "corrected on the public-form self-entry branch (#534), which owns this file — remove this entry once it merges",
};

/** Shape 2: a caller-supplied argument that turns consent on by default. */
const DEFAULT_CONSENT_ARGUMENT = /\bdefault(Email|Sms)?OptIn\b/;

/**
 * Shape 3: files permitted to WRITE a consent column, each with the reason.
 *
 * Everything else must go through `lib/contacts/contact-intake.ts`, which
 * grants nothing. Adding a file here is a deliberate act that shows up in
 * review — which is the point.
 */
const MAY_WRITE_CONSENT: Record<string, string> = {
  "lib/contacts/contact-intake.ts":
    "the governed intake — it is the one place that answers this question, and its answer is always no",

  // Genuine affirmative acts by the recipient.
  "app/api/optin/[slug]/route.ts": "a real opt-in page: the recipient submitted it themselves",
  "app/api/sms/webhook/route.ts": "inbound STOP and START keywords, sent by the recipient",

  // Owner-asserted consent. The possession FALLBACK is removed; whether an
  // owner's explicit boolean should count at all is escalated, not settled.
  "app/api/contacts/route.ts": "owner-asserted explicit boolean; absence is now false — legitimacy escalated",
  "app/api/contacts/[contactId]/route.ts": "owner editing a contact; only writes when explicitly supplied",
  "lib/ai/flow-agent/tools/contact-tools.ts": "the agent's create_contact, same owner-asserted boolean",

  // Writes false, which is always safe.
  "lib/voice-agent/call-tools.ts": "creates callers with both flags false",

  // Corrected elsewhere or awaiting their own decision — see the PR body.
  "app/api/data-forms/[id]/sync-contacts/route.ts": "corrected on #534, which owns this file",
  "app/api/landing-pages/[id]/submit/route.ts":
    "REPORT ONLY, and the worst of them: it flips an EXISTING contact to opted-in, overwriting a state someone may have deliberately set",
  "app/api/ecommerce/customers/[customerId]/add-to-contacts/route.ts":
    "REPORT ONLY: relies on 'placed an order' as consent",
  "app/api/events/public/[slug]/route.ts": "REPORT ONLY: relies on 'registered for an event' as consent",
  "app/api/payments/webhook/route.ts": "REPORT ONLY: relies on 'bought a ticket' as consent",
};

const BLOCK_KEYWORD =
  /(\bdata\s*:|\bcreate\s*:|\bupdate\s*:|\bwhere\s*:|\bselect\s*:|NextResponse\.json|\breturn\s*\{|\binterface\b|\btype\s+\w+\s*=)/;

type BlockKind = "write" | "read" | "other";

/** Classify a consent-column mention by the nearest enclosing block keyword. */
function classify(lines: string[], index: number): BlockKind {
  for (let i = index; i >= 0 && i > index - 40; i--) {
    const match = BLOCK_KEYWORD.exec(lines[i]);
    if (!match) continue;
    const keyword = match[0];
    if (/^(data|create|update)\s*:/.test(keyword)) return "write";
    if (/^(where|select)\s*:/.test(keyword)) return "read";
    return "other";
  }
  return "other";
}

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

function isTypeAnnotation(line: string): boolean {
  return /:\s*(boolean|Date \| null|string \| null|number)\s*;?\s*$/.test(line.trim());
}

test("no source derives marketing consent from possessing a channel", () => {
  const violations: string[] = [];

  for (const file of walk(SRC)) {
    const rel = relative(file);
    if (POSSESSION_EXEMPT[rel]) continue;

    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const { pattern, why } of POSSESSION_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${rel}:${index + 1} — ${why}\n    ${line.trim()}`);
            break;
          }
        }
      });
  }

  assert.deepEqual(violations, [], `possession is not consent:\n\n${violations.join("\n")}\n`);
});

test("no caller-supplied argument turns consent on by default", () => {
  const violations: string[] = [];

  for (const file of walk(SRC)) {
    const rel = relative(file);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (DEFAULT_CONSENT_ARGUMENT.test(line)) {
          violations.push(`${rel}:${index + 1}\n    ${line.trim()}`);
        }
      });
  }

  assert.deepEqual(
    violations,
    [],
    `a default-opt-in argument is an assertion by the caller, not evidence of the recipient's act:\n\n${violations.join(
      "\n"
    )}\n`
  );
});

test("only the listed files write a consent column", () => {
  const violations: string[] = [];

  for (const file of walk(SRC)) {
    const rel = relative(file);
    if (MAY_WRITE_CONSENT[rel]) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (isTypeAnnotation(line)) return;
      if (!CONSENT_COLUMNS.some((c) => new RegExp(`\\b${c}\\s*:`).test(line))) return;
      if (classify(lines, index) !== "write") return;
      violations.push(`${rel}:${index + 1}\n    ${line.trim()}`);
    });
  }

  assert.deepEqual(
    violations,
    [],
    `these write consent outside the governed intake — route them through contact-intake, or add them to MAY_WRITE_CONSENT with a reason:\n\n${violations.join(
      "\n"
    )}\n`
  );
});

test("the agent CSV import behaves identically to the governed route", () => {
  // The bypass this closes: a user who asked the agent to import the file
  // instead of uploading it got contacts opted in to both channels by default.
  // Both paths now build their rows the same way, so there is one answer to
  // this question in the codebase rather than two.
  const agentImport = join(SRC, "lib/ai/flow-agent/tools/import-contacts-csv.ts");
  const source = readFileSync(agentImport, "utf8");

  assert.ok(
    source.includes("buildImportedContactData"),
    "the agent import must build its rows through the governed intake"
  );
  assert.ok(
    !DEFAULT_CONSENT_ARGUMENT.test(source),
    "the agent import must not accept a default-opt-in argument"
  );
  for (const column of CONSENT_COLUMNS) {
    assert.ok(
      !new RegExp(`\\b${column}\\s*[:=]`).test(source),
      `the agent import sets ${column} itself — it must not decide this`
    );
  }
  assert.ok(
    !MAY_WRITE_CONSENT["lib/ai/flow-agent/tools/import-contacts-csv.ts"],
    "the agent import must never be granted permission to write consent"
  );
});

// ── Guarding the guard ───────────────────────────────────────────────
// A regex that matches nothing passes silently, so each shape is proved
// against a sample of the code it exists to catch.

test("the guard catches every shape it claims to", () => {
  const mustCatch: [string, string][] = [
    ["double-bang", "emailOptedIn: !!email,"],
    ["double-bang", "smsOptedIn: !!phone,"],
    ["Boolean()", "emailOptedIn: Boolean(email),"],
    ["nullish fallback", "emailOptedIn: input.emailOptedIn ?? !!email,"],
    ["ternary fallback", "emailOptedIn: emailOptedIn !== undefined ? emailOptedIn : !!email,"],
    ["variable derivation", 'const emailOptedIn = typeof input.emailOptedIn === "boolean" ? input.emailOptedIn : !!email;'],
    ["variable derivation", "const smsOptedIn = !!parsed.phone && defaultOptIn === 'both';"],
    ["timestamp from channel", "emailOptedInAt: email ? new Date() : null,"],
    ["timestamp from channel", "smsOptedInAt: e.phone ? new Date() : null,"],
  ];

  for (const [name, sample] of mustCatch) {
    assert.ok(
      POSSESSION_PATTERNS.some(({ pattern }) => pattern.test(sample)),
      `the ${name} shape would not have been caught: ${sample}`
    );
  }

  assert.ok(DEFAULT_CONSENT_ARGUMENT.test("defaultOptIn: { type: \"string\" },"));
  assert.ok(DEFAULT_CONSENT_ARGUMENT.test("const defaultEmailOptIn = true;"));
});

test("the guard does not fire on legitimate code", () => {
  const mustNotCatch = [
    "where: { emailOptedIn: true },",
    "select: { smsOptedIn: true },",
    "data: { smsOptedIn: true, smsOptedInAt: new Date(), unsubscribedAt: null },", // the opt-in page
    "emailOptedIn: false,",
    "emailOptedIn: emailOptedIn === true,",
    "emailOptedInAt: emailOptedIn === true ? new Date() : null,", // from the flag, not the channel
    "emailOptedIn: boolean;",
  ];

  for (const sample of mustNotCatch) {
    assert.ok(
      !POSSESSION_PATTERNS.some(({ pattern }) => pattern.test(sample)),
      `the guard fires on legitimate code: ${sample}`
    );
    assert.ok(!DEFAULT_CONSENT_ARGUMENT.test(sample));
  }
});

test("the write classifier tells a write from a read", () => {
  const readBlock = ["const rows = await prisma.contact.findMany({", "  where: {", "    emailOptedIn: true,"];
  assert.equal(classify(readBlock, 2), "read");

  const selectBlock = ["  select: {", "    smsOptedIn: true,"];
  assert.equal(classify(selectBlock, 1), "read");

  const writeBlock = ["await prisma.contact.create({", "  data: {", "    emailOptedIn: true,"];
  assert.equal(classify(writeBlock, 2), "write");

  const upsertBlock = ["await prisma.contact.upsert({", "  update: { smsOptedIn: true },"];
  assert.equal(classify(upsertBlock, 1), "write");
});
