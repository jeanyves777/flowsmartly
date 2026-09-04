import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentDelta,
  buildContactFillDelta,
  buildContactSyncPlan,
  initialConsentFields,
} from "../../src/lib/data-forms/contact-sync";
import {
  SELF_ENTRY_CONSENT_EMAIL_ID,
  SELF_ENTRY_CONSENT_SMS_ID,
  SELF_ENTRY_EMAIL_CONSENT_VALUE,
  SELF_ENTRY_SMS_CONSENT_VALUE,
  SMS_CONSENT_IS_AUTHORITATIVE,
} from "../../src/types/data-form";

const emailTicked = { [SELF_ENTRY_CONSENT_EMAIL_ID]: [SELF_ENTRY_EMAIL_CONSENT_VALUE] };
const smsTicked = { [SELF_ENTRY_CONSENT_SMS_ID]: [SELF_ENTRY_SMS_CONSENT_VALUE] };

// ── The fill rule ────────────────────────────────────────────────────
// Sync may fill an EMPTY field. It must never overwrite a value the owner
// already holds just because a submission disagrees.

test("an empty field is filled from the submission", () => {
  const contact = { address: null, birthday: null };
  const delta = buildContactFillDelta(contact, { address: "123 Main St", birthday: "08-15" });
  assert.equal(delta.address, "123 Main St");
  assert.equal(delta.birthday, "08-15");
});

test("an existing value is PRESERVED when the submission differs", () => {
  const contact = { address: "123 Main" };
  const delta = buildContactFillDelta(contact, { address: "999 Other" });
  assert.equal(delta.address, undefined, "sync must not overwrite what the owner holds");
  assert.deepEqual(delta, {});
});

test("a whitespace-only stored value counts as empty", () => {
  const delta = buildContactFillDelta({ city: "   " }, { city: "Pittsfield" });
  assert.equal(delta.city, "Pittsfield");
});

test("a blank submitted value never clears a stored one", () => {
  const delta = buildContactFillDelta({ city: "Pittsfield" }, { city: "" });
  assert.equal(delta.city, undefined);
});

test("gaps and held values are handled independently in one submission", () => {
  const contact = { firstName: "Jean", lastName: null, address: "123 Main", city: null };
  const delta = buildContactFillDelta(contact, {
    firstName: "Someone Else",
    lastName: "Koffi",
    address: "999 Other",
    city: "Pittsfield",
  });
  assert.deepEqual(delta, { lastName: "Koffi", city: "Pittsfield" });
});

test("only the fillable columns are ever written", () => {
  const delta = buildContactFillDelta({}, { email: "a@b.com", phone: "+1555", status: "DELETED" });
  assert.deepEqual(delta, {}, "email/phone go through the uniqueness rules, not the fill delta");
});

// ── The consent rule ─────────────────────────────────────────────────

test("presence is not consent", () => {
  for (const value of [[], [""], ["No"], ["garbage"], ["banana"], "yes", true, 1]) {
    const delta = buildConsentDelta(
      { email: "a@b.com", emailOptedIn: false },
      { [SELF_ENTRY_CONSENT_EMAIL_ID]: value }
    );
    assert.equal(
      delta.emailOptedIn,
      undefined,
      `${JSON.stringify(value)} must not count as consent`
    );
  }
});

test("the exact affirmative grants email consent", () => {
  const delta = buildConsentDelta({ email: "a@b.com", emailOptedIn: false }, emailTicked);
  assert.equal(delta.emailOptedIn, true);
  assert.ok(delta.emailOptedInAt instanceof Date);
});

test("evidence must prove the specific claim, not merely be present", () => {
  // The email affirmative, submitted under the SMS field.
  const crossed = { [SELF_ENTRY_CONSENT_SMS_ID]: [SELF_ENTRY_EMAIL_CONSENT_VALUE] };
  const delta = buildConsentDelta({ phone: "+15551234567", smsOptedIn: false }, crossed);
  assert.equal(delta.smsOptedIn, undefined);
  assert.equal(delta.smsConsentWithheld, false, "it was never SMS consent to begin with");
});

test("consent is only granted, never revoked", () => {
  // No tick at all against an already opted-in contact.
  const delta = buildConsentDelta({ email: "a@b.com", emailOptedIn: true }, {});
  assert.equal(delta.emailOptedIn, undefined, "an absent tick is not a withdrawal");
});

test("consent without a channel to use it changes nothing", () => {
  const delta = buildConsentDelta({ email: null, emailOptedIn: false }, emailTicked);
  assert.equal(delta.emailOptedIn, undefined);
});

// ── The SMS gate ─────────────────────────────────────────────────────

test("a ticked SMS box is recorded but not promoted while the copy is uncleared", () => {
  const delta = buildConsentDelta({ phone: "+15551234567", smsOptedIn: false }, smsTicked);

  if (SMS_CONSENT_IS_AUTHORITATIVE) {
    assert.equal(delta.smsOptedIn, true);
    assert.equal(delta.smsConsentWithheld, false);
  } else {
    assert.equal(delta.smsOptedIn, undefined, "SMS consent is not authoritative yet");
    assert.equal(delta.smsConsentWithheld, true, "but the answer must be visible as withheld");
  }
});

test("a new contact gets the same consent treatment as an existing one", () => {
  const granted = initialConsentFields({ ...emailTicked, ...smsTicked }, "a@b.com", "+15551234567");
  assert.equal(granted.emailOptedIn, true);
  assert.equal(granted.smsOptedIn, SMS_CONSENT_IS_AUTHORITATIVE);

  const untickedt = initialConsentFields({}, "a@b.com", "+15551234567");
  assert.equal(untickedt.emailOptedIn, false);
  assert.equal(untickedt.emailOptedInAt, null);
  assert.equal(untickedt.smsOptedIn, false);
  assert.equal(untickedt.smsOptedInAt, null);
});

test("a new contact is never opted in by merely supplying an address", () => {
  const fields = initialConsentFields(
    { email: "a@b.com", phone: "+15551234567" },
    "a@b.com",
    "+15551234567"
  );
  assert.equal(fields.emailOptedIn, false);
  assert.equal(fields.smsOptedIn, false);
});

// ── Composition ──────────────────────────────────────────────────────
// Both helpers above are individually correct. The defect these pin lived only
// in their ORDER: consent needs the channel it is consent for, and that channel
// may be supplied by the very submission granting it.

test("a channel supplied by this submission counts for consent in the same pass", () => {
  // Matched on phone; the email arrives now, with the email box ticked.
  const contact = { phone: "+15551234567", email: null, emailOptedIn: false };
  const plan = buildContactSyncPlan(
    contact,
    { email: "jean@example.com", ...emailTicked },
    { email: "jean@example.com" }
  );

  assert.equal(plan.update.email, "jean@example.com", "the email must be filled");
  assert.equal(plan.update.emailOptedIn, true, "and the consent must not be dropped");
  assert.ok(plan.update.emailOptedInAt instanceof Date);
});

test("an SMS tick against a number supplied now is counted as withheld, not lost", () => {
  // Matched on email; the phone arrives now, with the SMS box ticked.
  const contact = { email: "jean@example.com", phone: null, smsOptedIn: false };
  const plan = buildContactSyncPlan(
    contact,
    { phone: "+15551234567", ...smsTicked },
    { phone: "+15551234567" }
  );

  assert.equal(plan.update.phone, "+15551234567", "the phone must be filled");
  assert.equal(plan.update.smsOptedIn, undefined, "SMS consent is not authoritative yet");
  assert.equal(
    plan.smsConsentWithheld,
    !SMS_CONSENT_IS_AUTHORITATIVE,
    "a withheld answer must be visible, never silent"
  );
});

test("a channel refused by the uniqueness check grants no consent", () => {
  // Another contact already owns that email, so it is not approved.
  const contact = { phone: "+15551234567", email: null, emailOptedIn: false };
  const plan = buildContactSyncPlan(contact, { email: "taken@example.com", ...emailTicked }, {});

  assert.equal(plan.update.email, undefined);
  assert.equal(plan.update.emailOptedIn, undefined, "no channel, no consent");
});

test("a channel already held is not re-filled, and consent still applies to it", () => {
  const contact = { email: "jean@example.com", emailOptedIn: false };
  const plan = buildContactSyncPlan(contact, emailTicked, { email: "other@example.com" });

  assert.equal(plan.update.email, undefined, "never overwrite a held channel");
  assert.equal(plan.update.emailOptedIn, true);
});

test("the plan reports the contact as it will be after the write", () => {
  const contact = { email: null, address: null, emailOptedIn: false };
  const plan = buildContactSyncPlan(
    contact,
    { address: "123 Main St", email: "jean@example.com", ...emailTicked },
    { email: "jean@example.com" }
  );

  assert.equal(plan.effectiveContact.address, "123 Main St");
  assert.equal(plan.effectiveContact.email, "jean@example.com");
  assert.equal(plan.effectiveContact.emailOptedIn, true);
});

test("nothing to do produces an empty update", () => {
  const contact = { email: "jean@example.com", address: "123 Main", emailOptedIn: true };
  const plan = buildContactSyncPlan(contact, { address: "999 Other" }, {});
  assert.deepEqual(plan.update, {});
  assert.equal(plan.smsConsentWithheld, false);
});
