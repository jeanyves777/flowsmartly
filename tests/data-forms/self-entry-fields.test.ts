import test from "node:test";
import assert from "node:assert/strict";

import {
  hasConsentEvidence,
  SELF_ENTRY_CONSENT_EMAIL_ID,
  SELF_ENTRY_CONSENT_SMS_ID,
  SELF_ENTRY_FORM_FIELDS,
  SMART_COLLECT_FIELDS,
} from "../../src/types/data-form";

// The defect these pin: possessing someone's address was treated as permission
// to market to them (`emailOptedIn: !!email`). Consent must come from the
// respondent agreeing, and from nothing else.

test("supplying an address is not consent", () => {
  const data = { email: "someone@example.com", phone: "+15551234567" };
  assert.equal(hasConsentEvidence(data, SELF_ENTRY_CONSENT_EMAIL_ID), false);
  assert.equal(hasConsentEvidence(data, SELF_ENTRY_CONSENT_SMS_ID), false);
});

test("an unticked box is not consent", () => {
  for (const value of [[], "", null, undefined, false, 0]) {
    assert.equal(
      hasConsentEvidence({ [SELF_ENTRY_CONSENT_EMAIL_ID]: value }, SELF_ENTRY_CONSENT_EMAIL_ID),
      false,
      `expected no consent for ${JSON.stringify(value)}`
    );
  }
});

test("a ticked box is consent", () => {
  assert.equal(
    hasConsentEvidence(
      { [SELF_ENTRY_CONSENT_EMAIL_ID]: ["Yes, send me email updates"] },
      SELF_ENTRY_CONSENT_EMAIL_ID
    ),
    true
  );
  assert.equal(
    hasConsentEvidence({ [SELF_ENTRY_CONSENT_SMS_ID]: true }, SELF_ENTRY_CONSENT_SMS_ID),
    true
  );
});

test("email consent and sms consent are independent", () => {
  const data = { [SELF_ENTRY_CONSENT_EMAIL_ID]: ["Yes, send me email updates"] };
  assert.equal(hasConsentEvidence(data, SELF_ENTRY_CONSENT_EMAIL_ID), true);
  assert.equal(hasConsentEvidence(data, SELF_ENTRY_CONSENT_SMS_ID), false);
});

// The owner's submissions view renders answers by iterating form.fields, so a
// question with no definition is collected and then invisible.
test("every contact detail collected has a field definition behind it", () => {
  const definedIds = new Set(SELF_ENTRY_FORM_FIELDS.map((f) => f.id));
  for (const field of SMART_COLLECT_FIELDS) {
    if (field.key === "imageUrl") continue; // photo is not part of self-entry
    assert.ok(
      definedIds.has(field.key),
      `${field.key} would be collected but never shown to the owner`
    );
  }
});

test("field ids match Contact columns, so they map without guesswork", () => {
  for (const id of ["firstName", "lastName", "email", "phone", "birthday", "address", "city", "state"]) {
    assert.ok(
      SELF_ENTRY_FORM_FIELDS.some((f) => f.id === id),
      `missing field definition for ${id}`
    );
  }
});

test("both consent questions are optional", () => {
  for (const id of [SELF_ENTRY_CONSENT_EMAIL_ID, SELF_ENTRY_CONSENT_SMS_ID]) {
    const field = SELF_ENTRY_FORM_FIELDS.find((f) => f.id === id);
    assert.ok(field, `missing consent field ${id}`);
    assert.equal(field.required, false, "consent must never be a condition of submitting");
    assert.equal(field.type, "checkbox");
    assert.ok((field.options?.length ?? 0) > 0, "a consent box needs a label to tick");
  }
});

test("name is captured as two fields, so a surname is not dropped", () => {
  const first = SELF_ENTRY_FORM_FIELDS.find((f) => f.id === "firstName");
  const last = SELF_ENTRY_FORM_FIELDS.find((f) => f.id === "lastName");
  assert.equal(first?.required, true);
  assert.equal(last?.required, true);
});
