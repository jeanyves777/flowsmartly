import test from "node:test";
import assert from "node:assert/strict";

import {
  checkChallenge,
  CODE_LENGTH,
  generateCode,
  hashCode,
  MAX_CODE_ATTEMPTS,
  type StoredChallenge,
} from "../../src/lib/data-forms/challenge";

process.env.DATA_FORM_CHALLENGE_PEPPER ||= "test-pepper";

function challenge(overrides: Partial<StoredChallenge> = {}): StoredChallenge {
  return {
    id: "chal_1",
    formId: "form_1",
    contactId: "contact_1",
    codeHash: hashCode("form_1", "contact_1", "123456"),
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    ...overrides,
  };
}

test("codes are numeric and the right length", () => {
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    assert.match(code, new RegExp(`^\\d{${CODE_LENGTH}}$`));
  }
});

test("codes vary", () => {
  const seen = new Set(Array.from({ length: 200 }, () => generateCode()));
  assert.ok(seen.size > 100, `expected varied codes, saw ${seen.size} distinct`);
});

test("the correct code is accepted", () => {
  assert.deepEqual(checkChallenge(challenge(), "123456"), { ok: true });
});

test("a wrong code is rejected", () => {
  assert.deepEqual(checkChallenge(challenge(), "999999"), { ok: false, reason: "mismatch" });
});

test("the hash is bound to the form, so a code cannot cross forms", () => {
  // Same code, same contact, different form: must not verify.
  const other = challenge({ formId: "form_2" });
  assert.deepEqual(checkChallenge(other, "123456"), { ok: false, reason: "mismatch" });
});

test("the hash is bound to the contact, so a code cannot cross people", () => {
  const other = challenge({ contactId: "contact_2" });
  assert.deepEqual(checkChallenge(other, "123456"), { ok: false, reason: "mismatch" });
});

test("an expired code is refused even when correct", () => {
  const expired = challenge({ expiresAt: new Date(Date.now() - 1) });
  assert.deepEqual(checkChallenge(expired, "123456"), { ok: false, reason: "expired" });
});

test("a consumed code cannot be replayed", () => {
  const used = challenge({ consumedAt: new Date() });
  assert.deepEqual(checkChallenge(used, "123456"), { ok: false, reason: "consumed" });
});

test("guesses run out", () => {
  const spent = challenge({ attempts: MAX_CODE_ATTEMPTS });
  // Refused before the code is even compared.
  assert.deepEqual(checkChallenge(spent, "123456"), { ok: false, reason: "exhausted" });
});

test("the last permitted guess still counts", () => {
  const nearly = challenge({ attempts: MAX_CODE_ATTEMPTS - 1 });
  assert.deepEqual(checkChallenge(nearly, "123456"), { ok: true });
});

test("the stored hash does not contain the code", () => {
  const stored = hashCode("form_1", "contact_1", "123456");
  assert.ok(!stored.includes("123456"));
  assert.match(stored, /^[0-9a-f]{64}$/);
});
