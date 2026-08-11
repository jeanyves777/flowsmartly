import test from "node:test";
import assert from "node:assert/strict";

import {
  exactNameClauses,
  MAX_NAME_TOKENS,
  parseRespondentName,
} from "../../src/lib/data-forms/respondent-name";

test("an over-long name is rejected, never silently truncated", () => {
  const tooMany = Array.from({ length: MAX_NAME_TOKENS + 1 }, (_, i) => `Word${i}`).join(" ");
  const parsed = parseRespondentName(tooMany);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.ok === false && parsed.reason, "too_many_words");
});

test("truncation would have changed the identity being matched", () => {
  // The old code kept the first five words, so these two different names
  // collapsed to the same query. They must now be treated as distinct input.
  const a = parseRespondentName("Ana Maria Del Carmen Ruiz");
  const b = parseRespondentName("Ana Maria Del Carmen Ruiz Gonzalez");
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
});

test("a name at the limit is accepted whole", () => {
  const parsed = parseRespondentName("  Ana   Maria Del Carmen Ruiz  ");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok === true && parsed.fullName, "Ana Maria Del Carmen Ruiz");
  assert.equal(parsed.ok === true && parsed.tokens.length, 5);
});

test("short and absent input is rejected", () => {
  for (const input of ["", "  ", "Al", null, undefined, 42]) {
    assert.equal(parseRespondentName(input).ok, false, `expected rejection for ${String(input)}`);
  }
});

test("a very long single word is rejected on length", () => {
  const parsed = parseRespondentName("x".repeat(200));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.ok === false && parsed.reason, "too_long");
});

test("matching is exact equality on every split, never a prefix", () => {
  const clauses = JSON.stringify(exactNameClauses(["Ada", "Lovelace"]));
  assert.ok(clauses.includes('"equals":"Ada"'));
  assert.ok(clauses.includes('"equals":"Lovelace"'));
  assert.ok(clauses.includes('"equals":"Ada Lovelace"'));
  // The enumerable operator must not appear anywhere.
  assert.ok(!clauses.includes("contains"));
  assert.ok(!clauses.includes("startsWith"));
});

test("a one-word name only matches a record with no surname", () => {
  const clauses = exactNameClauses(["Prince"]) as { OR?: unknown[] }[];
  assert.equal(clauses.length, 1);
  assert.deepEqual(clauses[0].OR, [{ lastName: null }, { lastName: "" }]);
});
