import test from "node:test";
import assert from "node:assert/strict";

import { clientIdentity, UNTRUSTED_IDENTITY } from "../../src/lib/data-forms/client-identity";

// The defect these pin: the previous limiter read the LEFTMOST x-forwarded-for
// value. Our nginx uses $proxy_add_x_forwarded_for, which APPENDS, so anything
// the caller sent survives at the front — a caller could rotate a fake address
// per request and never be limited.

test("a spoofed x-forwarded-for prefix cannot become the identity", () => {
  const headers = new Headers({
    // What an attacker sends, then what our proxy appended.
    "x-forwarded-for": "1.1.1.1, 203.0.113.9",
  });
  const { identity, trusted } = clientIdentity(headers);
  assert.equal(identity, "203.0.113.9");
  assert.equal(trusted, true);
});

test("rotating spoofed prefixes all collapse to one bucket", () => {
  const identities = new Set<string>();
  for (let i = 0; i < 40; i++) {
    identities.add(
      clientIdentity(new Headers({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.9` })).identity
    );
  }
  assert.deepEqual([...identities], ["203.0.113.9"]);
});

test("x-real-ip wins, because the ingress overwrites it every hop", () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.9",
    "x-forwarded-for": "1.1.1.1, 2.2.2.2",
  });
  assert.equal(clientIdentity(headers).identity, "203.0.113.9");
});

test("no ingress header means one shared bucket, not a free pass each", () => {
  const { identity, trusted } = clientIdentity(new Headers());
  assert.equal(identity, UNTRUSTED_IDENTITY);
  assert.equal(trusted, false);
});

test("a single-hop forwarded-for is still the proxy's own value", () => {
  assert.equal(
    clientIdentity(new Headers({ "x-forwarded-for": "203.0.113.9" })).identity,
    "203.0.113.9"
  );
});
