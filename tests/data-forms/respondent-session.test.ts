import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSession,
  hashSessionToken,
  mintSessionToken,
  readBearer,
  SESSION_PURPOSE_PREFILL,
  type StoredSession,
} from "../../src/lib/data-forms/respondent-session";

function session(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    id: "sess_1",
    formId: "form_1",
    contactId: "contact_1",
    purpose: SESSION_PURPOSE_PREFILL,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

// The defect this pins: the previous token was base64url plaintext
// `{f, c, e}` plus an HMAC. HMAC authenticates, it does not encrypt — the raw
// contact id could be read straight out of the token by anyone holding it.

test("the token carries no readable payload", () => {
  // The old token decoded to `{"f":"form_...","c":"contact_...","e":...}`.
  // This one decodes to noise: no ids, and nothing JSON-shaped to parse.
  for (let i = 0; i < 200; i++) {
    const { token } = mintSessionToken();
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    assert.ok(!decoded.includes("contact"), `leaked "contact" in ${token}`);
    assert.ok(!decoded.includes("form"), `leaked "form" in ${token}`);
    assert.throws(() => JSON.parse(decoded), `token parsed as JSON: ${token}`);
  }
});

test("the token is not derivable from the ids it stands for", () => {
  // Two sessions for the identical contact and form share nothing.
  const a = mintSessionToken();
  const b = mintSessionToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.tokenHash, b.tokenHash);
});

test("tokens are unique and long", () => {
  const tokens = new Set(Array.from({ length: 500 }, () => mintSessionToken().token));
  assert.equal(tokens.size, 500);
  assert.ok([...tokens][0].length >= 40);
});

test("only the hash is suitable for storage, and it is stable", () => {
  const { token, tokenHash } = mintSessionToken();
  assert.equal(hashSessionToken(token), tokenHash);
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
  assert.notEqual(tokenHash, token);
});

test("a session bound to one form cannot act on another", () => {
  assert.deepEqual(checkSession(session(), "form_2", SESSION_PURPOSE_PREFILL), {
    ok: false,
    reason: "wrong_form",
  });
});

test("a session issued for one purpose cannot be repurposed", () => {
  assert.deepEqual(checkSession(session(), "form_1", "something_else"), {
    ok: false,
    reason: "wrong_purpose",
  });
});

test("expiry is enforced", () => {
  const stale = session({ expiresAt: new Date(Date.now() - 1) });
  assert.deepEqual(checkSession(stale, "form_1", SESSION_PURPOSE_PREFILL), {
    ok: false,
    reason: "expired",
  });
});

test("revocation is enforced", () => {
  const revoked = session({ revokedAt: new Date() });
  assert.deepEqual(checkSession(revoked, "form_1", SESSION_PURPOSE_PREFILL), {
    ok: false,
    reason: "revoked",
  });
});

test("a consumed session may still read but may not mutate again", () => {
  const used = session({ consumedAt: new Date() });
  assert.deepEqual(checkSession(used, "form_1", SESSION_PURPOSE_PREFILL, new Date(), true), {
    ok: true,
  });
  assert.deepEqual(checkSession(used, "form_1", SESSION_PURPOSE_PREFILL, new Date(), false), {
    ok: false,
    reason: "consumed",
  });
});

test("a valid session passes", () => {
  assert.deepEqual(checkSession(session(), "form_1", SESSION_PURPOSE_PREFILL), { ok: true });
});

test("the bearer is read from the Authorization header", () => {
  assert.equal(readBearer(new Headers({ authorization: "Bearer abc123" })), "abc123");
  assert.equal(readBearer(new Headers({ authorization: "bearer abc123" })), "abc123");
});

test("the bearer may come from the POST body, and nowhere else", () => {
  assert.equal(readBearer(new Headers(), { token: "abc123" }), "abc123");
  assert.equal(readBearer(new Headers()), null);
  assert.equal(readBearer(new Headers(), {}), null);
  assert.equal(readBearer(new Headers(), { token: 42 }), null);
});
