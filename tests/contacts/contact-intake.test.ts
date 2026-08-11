import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFollowUpContactData,
  buildImportedContactData,
  buildImportedContactUpdate,
  consentForDiscoveredContact,
} from "../../src/lib/contacts/contact-intake";

// The invariant under test:
//
//   Possession of an email address or phone number is contact data, not
//   marketing consent. Importing, exporting, copying, syncing or discovering
//   that channel may never manufacture consent evidence.
//
// This repo stores consent in exactly four columns on Contact — emailOptedIn,
// emailOptedInAt, smsOptedIn, smsOptedInAt. There is no consent event table, so
// those columns ARE the evidence, and leaving them empty is the whole assertion.

const CONSENT_COLUMNS = [
  "emailOptedIn",
  "emailOptedInAt",
  "smsOptedIn",
  "smsOptedInAt",
] as const;

function assertNoConsent(
  row: {
    emailOptedIn: boolean;
    emailOptedInAt: Date | null;
    smsOptedIn: boolean;
    smsOptedInAt: Date | null;
  },
  label: string
) {
  assert.equal(row.emailOptedIn, false, `${label}: emailOptedIn must be false`);
  assert.equal(row.emailOptedInAt, null, `${label}: no email opt-in timestamp`);
  assert.equal(row.smsOptedIn, false, `${label}: smsOptedIn must be false`);
  assert.equal(row.smsOptedInAt, null, `${label}: no SMS opt-in timestamp`);
}

// ── PLANT 1 ──────────────────────────────────────────────────────────
test("CSV row with email only is created without email consent", () => {
  const row = buildImportedContactData({
    userId: "user_1",
    email: "jean@example.com",
    phone: null,
    firstName: "Jean",
  });

  assert.equal(row.email, "jean@example.com", "the address is still stored");
  assertNoConsent(row, "email-only import");
});

// ── PLANT 2 ──────────────────────────────────────────────────────────
test("CSV row with phone only is created without SMS consent", () => {
  const row = buildImportedContactData({
    userId: "user_1",
    email: null,
    phone: "+15551234567",
  });

  assert.equal(row.phone, "+15551234567", "the number is still stored");
  assertNoConsent(row, "phone-only import");
});

// ── PLANT 3 ──────────────────────────────────────────────────────────
test("CSV row with both channels stores both and consents to neither", () => {
  const row = buildImportedContactData({
    userId: "user_1",
    email: "jean@example.com",
    phone: "+15551234567",
    firstName: "Jean",
    lastName: "Koffi",
    city: "Pittsfield",
    tags: ["vip"],
  });

  assert.equal(row.email, "jean@example.com");
  assert.equal(row.phone, "+15551234567");
  assert.equal(row.city, "Pittsfield");
  assert.equal(row.tags, JSON.stringify(["vip"]));
  assertNoConsent(row, "both-channel import");
});

// ── PLANT 4 ──────────────────────────────────────────────────────────
test("follow-up entry with email and phone behaves identically", () => {
  const row = buildFollowUpContactData({
    userId: "user_1",
    email: "jean@example.com",
    phone: "+15551234567",
    name: "Jean Koffi",
    address: "123 Main St",
  });

  assert.equal(row.email, "jean@example.com");
  assert.equal(row.phone, "+15551234567");
  assert.equal(row.firstName, "Jean");
  assert.equal(row.lastName, "Koffi");
  assertNoConsent(row, "follow-up export");
});

test("a follow-up export of an email-only or phone-only entry consents to neither", () => {
  assertNoConsent(
    buildFollowUpContactData({
      userId: "u",
      email: "a@b.com",
      phone: null,
      name: "A",
      address: null,
    }),
    "follow-up email only"
  );
  assertNoConsent(
    buildFollowUpContactData({
      userId: "u",
      email: null,
      phone: "+15551234567",
      name: "A",
      address: null,
    }),
    "follow-up phone only"
  );
});

// ── PLANT 5 ──────────────────────────────────────────────────────────
test("an existing opted-in contact keeps its consent through an import", () => {
  const update = buildImportedContactUpdate(
    { email: "jean@example.com", phone: null, tags: "[]" },
    { firstName: "Jean", phone: "+15551234567", tags: ["imported"] }
  );

  // The import fills the missing phone and the name...
  assert.equal(update.phone, "+15551234567");
  assert.equal(update.firstName, "Jean");

  // ...and says nothing whatsoever about consent, in either direction.
  for (const column of CONSENT_COLUMNS) {
    assert.ok(
      !(column in update),
      `an import must not write ${column} — consent is not granted or revoked by re-uploading a file`
    );
  }
});

// ── PLANT 6 ──────────────────────────────────────────────────────────
test("an existing opted-out contact stays opted out through an import", () => {
  // Same assertion from the other side: because the update never mentions the
  // consent columns, a false stays false and a true stays true.
  const update = buildImportedContactUpdate(
    { email: "jean@example.com", phone: "+15551234567", tags: null },
    { firstName: "Jean", email: "other@example.com", phone: "+15559999999" }
  );

  for (const column of CONSENT_COLUMNS) {
    assert.ok(!(column in update), `an import must not write ${column}`);
  }
  // And it does not overwrite channels we already hold, either.
  assert.equal(update.email, undefined);
  assert.equal(update.phone, undefined);
});

// ── PLANT 7 ──────────────────────────────────────────────────────────
test("neither path produces any consent evidence beyond the empty columns", () => {
  // This repo has no consent/preference event table — the four Contact columns
  // are the only consent evidence that exists. Pinning the exact key set means
  // any new field, including a side-effect record, has to come past this test.
  const imported = buildImportedContactData({
    userId: "user_1",
    email: "jean@example.com",
    phone: "+15551234567",
  });
  assert.deepEqual(Object.keys(imported).sort(), [
    "address",
    "birthday",
    "city",
    "company",
    "email",
    "emailOptedIn",
    "emailOptedInAt",
    "firstName",
    "lastName",
    "phone",
    "smsOptedIn",
    "smsOptedInAt",
    "state",
    "tags",
    "userId",
  ]);

  const exported = buildFollowUpContactData({
    userId: "user_1",
    email: "jean@example.com",
    phone: "+15551234567",
    name: "Jean Koffi",
    address: null,
  });
  assert.deepEqual(Object.keys(exported).sort(), [
    "address",
    "email",
    "emailOptedIn",
    "emailOptedInAt",
    "firstName",
    "lastName",
    "phone",
    "smsOptedIn",
    "smsOptedInAt",
    "userId",
  ]);
});

test("the consent helper takes no input that could change its answer", () => {
  assert.equal(consentForDiscoveredContact.length, 0);
  assertNoConsent(consentForDiscoveredContact(), "helper");

  // A fresh object each call — no shared mutable constant to poison.
  const a = consentForDiscoveredContact();
  const b = consentForDiscoveredContact();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
});
