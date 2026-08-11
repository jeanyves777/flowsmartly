import test from "node:test";
import assert from "node:assert/strict";

import {
  effectiveFormFields,
  isSelfEntryFormType,
  parseFormFields,
} from "../../src/lib/data-forms/self-entry-fields";
import { SELF_ENTRY_FORM_FIELDS } from "../../src/types/data-form";

// Reads may adapt legacy representation; reads do not silently migrate durable
// business state. This resolver is the adaptation — it returns fields and
// writes nothing.

test("a legacy self-entry form resolves to the canonical set", () => {
  for (const type of ["SMART_COLLECT", "ATTENDANCE"]) {
    assert.deepEqual(effectiveFormFields({ type, fields: "[]" }), SELF_ENTRY_FORM_FIELDS);
    assert.deepEqual(effectiveFormFields({ type, fields: null }), SELF_ENTRY_FORM_FIELDS);
    assert.deepEqual(effectiveFormFields({ type, fields: "" }), SELF_ENTRY_FORM_FIELDS);
  }
});

test("a form's own fields always win", () => {
  const own = [{ id: "q1", type: "text", label: "Custom", required: false }];
  assert.deepEqual(
    effectiveFormFields({ type: "SMART_COLLECT", fields: JSON.stringify(own) }),
    own
  );
});

test("a standard form is never given self-entry fields", () => {
  assert.deepEqual(effectiveFormFields({ type: "STANDARD", fields: "[]" }), []);
  assert.deepEqual(effectiveFormFields({ type: null, fields: null }), []);
});

test("malformed stored fields do not throw", () => {
  assert.deepEqual(parseFormFields("not json"), []);
  assert.deepEqual(parseFormFields('{"not":"an array"}'), []);
  assert.deepEqual(
    effectiveFormFields({ type: "SMART_COLLECT", fields: "not json" }),
    SELF_ENTRY_FORM_FIELDS
  );
});

test("only self-entry types are recognised", () => {
  assert.equal(isSelfEntryFormType("SMART_COLLECT"), true);
  assert.equal(isSelfEntryFormType("ATTENDANCE"), true);
  assert.equal(isSelfEntryFormType("STANDARD"), false);
  assert.equal(isSelfEntryFormType(null), false);
  assert.equal(isSelfEntryFormType(undefined), false);
});
