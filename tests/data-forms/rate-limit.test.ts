import test from "node:test";
import assert from "node:assert/strict";

import {
  bucketKey,
  consumeRate,
  type RateCounterStore,
  type RateRule,
} from "../../src/lib/data-forms/rate-limit";

/**
 * Models the database counter: the increment and the read of the new value are
 * one indivisible step, which is exactly the property `upsert ... { increment }`
 * gives us and the property the old in-memory limiter lacked.
 */
function fakeStore(): RateCounterStore & { keys(): string[]; size(): number } {
  const rows = new Map<string, { count: number; expiresAt: Date }>();
  return {
    async increment(key, expiresAt) {
      // Deliberately await BEFORE mutating, to give any racing caller a chance
      // to interleave. The mutation itself is still a single step.
      await Promise.resolve();
      const row = rows.get(key) ?? { count: 0, expiresAt };
      row.count += 1;
      rows.set(key, row);
      return row.count;
    },
    async sweep(now) {
      for (const [key, row] of rows) if (row.expiresAt < now) rows.delete(key);
    },
    keys: () => [...rows.keys()],
    size: () => rows.size,
  };
}

const rule: RateRule = { scope: "test", max: 10, windowSeconds: 60 };

test("requests up to the limit are allowed, and past it refused", async () => {
  const store = fakeStore();
  const results: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    results.push((await consumeRate(store, rule, "ip")).allowed);
  }
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(results.slice(10).every((r) => r === false), true);
});

// The defect this pins: the old limiter checked the map, awaited the database,
// then recorded — so a parallel burst was admitted wholesale before any of it
// counted. A probe admitted 30 requests against a ten-request limit.
test("a concurrent burst cannot exceed the limit", async () => {
  const store = fakeStore();
  const decisions = await Promise.all(
    Array.from({ length: 50 }, () => consumeRate(store, rule, "ip"))
  );
  assert.equal(decisions.filter((d) => d.allowed).length, 10);
});

test("counters are shared, so a second process sees the first one's usage", async () => {
  // One store, two independent callers — the database case.
  const store = fakeStore();
  for (let i = 0; i < 10; i++) await consumeRate(store, rule, "ip");

  const fromAnotherProcess = await consumeRate(store, rule, "ip");
  assert.equal(fromAnotherProcess.allowed, false);
});

test("a restart does not hand out a fresh allowance", async () => {
  const store = fakeStore();
  for (let i = 0; i < 10; i++) await consumeRate(store, rule, "ip");

  // Nothing about the limiter is held in module state; the same store answers.
  assert.equal((await consumeRate(store, rule, "ip")).allowed, false);
});

test("identities and scopes do not share a bucket", async () => {
  const store = fakeStore();
  for (let i = 0; i < 10; i++) await consumeRate(store, rule, "ip-a");

  assert.equal((await consumeRate(store, rule, "ip-b")).allowed, true);
  assert.equal(
    (await consumeRate(store, { ...rule, scope: "other" }, "ip-a")).allowed,
    true
  );
});

test("the window rolls, and the store stays bounded by expiry", async () => {
  const store = fakeStore();
  const first = new Date("2026-01-01T00:00:00Z");
  const later = new Date("2026-01-01T00:01:00Z");

  for (let i = 0; i < 10; i++) await consumeRate(store, rule, "ip", first);
  assert.equal((await consumeRate(store, rule, "ip", first)).allowed, false);

  // New window: a fresh key, and a fresh allowance.
  assert.equal((await consumeRate(store, rule, "ip", later)).allowed, true);
  assert.equal(store.size(), 2);

  // Old windows are removable — the store does not grow without bound.
  // A sweep only drops windows that have actually closed.
  await store.sweep(new Date("2026-01-01T00:01:30Z"));
  assert.equal(store.size(), 1, "the live window must survive a sweep");

  await store.sweep(new Date("2026-01-01T00:03:00Z"));
  assert.equal(store.size(), 0);
});

test("the window start is part of the key", () => {
  const at = new Date("2026-01-01T00:00:30Z");
  const same = new Date("2026-01-01T00:00:59Z");
  const next = new Date("2026-01-01T00:01:00Z");

  assert.equal(bucketKey(rule, "ip", at), bucketKey(rule, "ip", same));
  assert.notEqual(bucketKey(rule, "ip", at), bucketKey(rule, "ip", next));
});

test("a refusal reports when to come back", async () => {
  const store = fakeStore();
  const at = new Date("2026-01-01T00:00:30Z");
  for (let i = 0; i < 10; i++) await consumeRate(store, rule, "ip", at);

  const refused = await consumeRate(store, rule, "ip", at);
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterSeconds, 30);
});
