/**
 * The registrant authority, tested against the code that actually runs.
 *
 * Every case here is one that production expressed before this change. The
 * point of each is not "it refused" but **what it refused, and what it never
 * sent** — a test that only checks for failure passes just as happily when the
 * failure comes from somewhere else entirely.
 *
 *     npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  registrantFrom,
  pickBrandKit,
  describeMissingRegistrant,
  type RegistrantSource,
} from "./registrant";

/** A brand identity with everything filled in, correctly. */
function complete(overrides: Partial<RegistrantSource> = {}): RegistrantSource {
  return {
    id: "bk_1",
    name: "Acme Plumbing",
    ownerFirstName: "Jane",
    ownerLastName: "Okafor",
    email: "jane@acmeplumbing.com",
    phone: "+1 413 555 0147",
    address: "132 Lincoln St",
    city: "Pittsfield",
    state: "MA",
    zip: "01201",
    country: "US",
    ...overrides,
  };
}

const missingFields = (source: RegistrantSource, email: string | null = null) => {
  const result = registrantFrom(source, email);
  return result.ok ? [] : result.missing.map((m) => m.field);
};

/* ================================================================= */

describe("a missing fact stays missing", () => {
  test("refuses a missing city, and substitutes nothing", () => {
    // The exact defect. Production wrote "New York" here and the completeness
    // guard downstream saw a non-empty city and passed.
    const result = registrantFrom(complete({ city: null }), null);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(
      result.missing.map((m) => m.field),
      ["city"]
    );

    // And nothing was built. There is no contact carrying "New York", because
    // there is no contact at all.
    assert.equal("contact" in result, false);
    assert.match(describeMissingRegistrant(result.missing), /City/);
  });

  test("names every missing field at once, so the owner fixes it in one pass", () => {
    const result = registrantFrom(
      complete({ city: null, state: null, zip: null, address: null }),
      null
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(
      result.missing.map((m) => m.field).sort(),
      ["address", "city", "state", "zip"]
    );
  });

  test("accepts a complete identity — so the refusals above are the rule deciding", () => {
    const result = registrantFrom(complete(), null);
    assert.equal(result.ok, true);
  });
});

describe("the registrant is a person", () => {
  test("refuses when the owner has no name, rather than splitting the business name", () => {
    // "Acme Plumbing" used to become first_name "Acme", last_name "Plumbing" —
    // a company filed as a human being on the contact a registrar uses for
    // identity verification.
    const result = registrantFrom(
      complete({ ownerFirstName: null, ownerLastName: null }),
      null
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(
      result.missing.map((m) => m.field).sort(),
      ["ownerFirstName", "ownerLastName"]
    );
  });

  test("never puts the business name in a person field", () => {
    const result = registrantFrom(complete(), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.contact.first_name, "Jane");
    assert.equal(result.contact.last_name, "Okafor");
    assert.notEqual(result.contact.first_name, "Acme");
    assert.notEqual(result.contact.last_name, "Plumbing");
    // The business is an organization, which is what it is.
    assert.equal(result.contact.org_name, "Acme Plumbing");
  });

  test("leaves the organization off when there is no business name", () => {
    const result = registrantFrom(complete({ name: null }), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contact.org_name, undefined);
  });
});

describe("the country code is looked up, never guessed", () => {
  // The exact value the registrar receives, for each width of dialling code.
  // A test that only asserts "a phone came out" passes while the number is
  // silently cut in the wrong place.
  const cases: Array<[string, string, string, string]> = [
    ["one digit", "US", "+1 413 555 0147", "+1.4135550147"],
    ["two digits", "GB", "+44 20 7946 0958", "+44.2079460958"],
    ["three digits", "FI", "+358 40 123 4567", "+358.401234567"],
    ["three digits again", "PT", "+351 21 123 4567", "+351.211234567"],
  ];

  for (const [width, country, stored, expected] of cases) {
    test(`splits a ${width} country code exactly (${country})`, () => {
      const result = registrantFrom(complete({ country, phone: stored }), null);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.contact.phone, expected);
    });
  }

  test("the Finnish number is not cut after two digits", () => {
    // The old regex had `2[0-9]{2}` as its only three-digit branch, so +358…
    // became +35.8401234567 — a country code that was moved rather than
    // invented, which is the same untruth and harder to spot.
    const result = registrantFrom(complete({ country: "FI", phone: "+358401234567" }), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.contact.phone, "+35.8401234567");
    assert.equal(result.contact.phone, "+358.401234567");
  });

  test("keeps every digit the customer gave us", () => {
    const result = registrantFrom(complete({ country: "FI", phone: "+358 40 123 4567" }), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contact.phone.replace(/\D/g, ""), "358401234567");
  });

  test("refuses a number that does not carry a country code", () => {
    assert.deepEqual(missingFields(complete({ phone: "4135550147" })), ["phone"]);
  });

  test("refuses a number whose country code is not the owner's", () => {
    // A US address with a Finnish number: we cannot confirm where the code
    // ends, so we say so instead of picking a split.
    const result = registrantFrom(complete({ country: "US", phone: "+358401234567" }), null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.missing[0]?.field, "phone");
    assert.match(result.missing[0]?.why ?? "", /\+1/);
  });

  test("refuses a country that is not a two-letter code, rather than assuming US", () => {
    const result = registrantFrom(complete({ country: "United States" }), null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.missing.some((m) => m.field === "country"), true);
    assert.match(result.missing.find((m) => m.field === "country")?.why ?? "", /two-letter/);
  });

  test("says so when a dialling code is not on file, rather than filing a wrong one", () => {
    const result = registrantFrom(complete({ country: "ZZ", phone: "+9991234567" }), null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.missing.some((m) => m.field === "phone"), true);
  });
});

describe("the email falls back to the account, and nothing else does", () => {
  test("uses the account email when the brand has none", () => {
    const result = registrantFrom(complete({ email: null }), "owner@example.com");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contact.email, "owner@example.com");
  });

  test("refuses when there is no email anywhere", () => {
    assert.deepEqual(missingFields(complete({ email: null }), null), ["email"]);
  });
});

describe("which business identity was filed", () => {
  const kit = (id: string, isDefault: boolean, createdAt: string) => ({
    id,
    isDefault,
    createdAt: new Date(createdAt),
  });

  test("prefers the default kit over an older one", () => {
    // A bare `findFirst` returned whichever row the database felt like — real
    // data, from the wrong business.
    const picked = pickBrandKit([
      kit("old", false, "2024-01-01"),
      kit("default", true, "2025-06-01"),
    ]);
    assert.equal(picked?.id, "default");
  });

  test("breaks a tie deterministically when two kits claim to be default", () => {
    // The schema puts no unique constraint on `isDefault`, so this is
    // reachable — and without a tie-break the answer could alternate between
    // calls, which is an identity nobody chose.
    const picked = pickBrandKit([
      kit("newer", true, "2025-06-01"),
      kit("older", true, "2024-01-01"),
    ]);
    assert.equal(picked?.id, "older");
    // Same input in the other order gives the same answer.
    assert.equal(
      pickBrandKit([kit("older", true, "2024-01-01"), kit("newer", true, "2025-06-01")])?.id,
      "older"
    );
  });

  test("falls back to any kit when none is default", () => {
    const picked = pickBrandKit([kit("b", false, "2025-01-01"), kit("a", false, "2024-01-01")]);
    assert.equal(picked?.id, "a");
  });

  test("reports which kit the contact came from", () => {
    const result = registrantFrom(complete({ id: "bk_used" }), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.brandKitId, "bk_used");
  });
});
