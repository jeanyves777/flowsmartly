/**
 * Voice Agent (Call agent) UI check — drives the REAL app, not a mock.
 *
 * Covers the things that are easy to get wrong here and impossible to catch
 * with `tsc`:
 *   1. the "Call agent" rail section exists, and sits directly below Leads
 *   2. clicking it opens the studio itself (no one-card menu step)
 *   3. the brief auto-fills the business blurb from the Brand Kit
 *   4. the greeting carries the REAL business name — callers must never hear
 *      "Thanks for calling us." (every preset greeting has a {business} slot)
 *   5. the "Filled in from your Brand Kit" chip actually renders
 *   6. the number step offers a line and quotes honest prices
 *
 * Run:  npm run test:voice-agent          (needs `npm run dev` up)
 *       VOICE_UI_ORIGIN=http://localhost:3011 npm run test:voice-agent
 */
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { SignJWT } from "jose";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env" });

const origin = process.env.VOICE_UI_ORIGIN || "http://localhost:3000";
const shot = path.join(os.tmpdir(), "voice-agent-ui.png");

// The brief's business field — NOT `document.querySelector("textarea")`. The
// chat composer is also a textarea and comes FIRST in the DOM, so selecting by
// document order silently reads the wrong (empty) field and reports a
// pass/fail about nothing.
const BUSINESS = 'textarea[placeholder^="What you do"]';
const GREETING = 'input[placeholder^="Thanks for calling"]';

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({
  where: { deletedAt: null, email: "test@flowsmartly.com" },
  select: { id: true },
}) ?? await prisma.user.findFirst({
  where: { deletedAt: null, onboardingComplete: true },
  select: { id: true },
});
assert(user, "A local test user is required for the Voice Agent UI check.");

const kit = await prisma.brandKit.findFirst({
  where: { userId: user.id },
  orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  select: { name: true },
});
await prisma.$disconnect();

const secret = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production",
);
const accessToken = await new SignJWT({
  userId: user.id,
  sessionId: "voice-agent-ui-check",
  type: "access",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("15m")
  .sign(secret);

// Stripe/SMTP/VAPID keys are deliberately absent in dev, so the billing widget
// throws on every page regardless of what we're testing. Ignore that ONE known
// env gap rather than dropping the page-error assertion — a real error in the
// studio must still fail this run.
const DEV_ENV_NOISE = /Please call Stripe\(\) with your publishable key/i;

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const fail = [];
page.on("pageerror", (e) => {
  const msg = String(e);
  if (!DEV_ENV_NOISE.test(msg)) fail.push(msg);
});

try {
  await page.setViewport({ width: 1500, height: 950 });
  const { hostname } = new URL(origin);
  await page.setCookie({ name: "access_token", value: accessToken, domain: hostname, path: "/" });

  // The onboarding intro is gated on a localStorage flag, not a DB column —
  // without this every load lands on "Pick where to start" instead of the app.
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => localStorage.setItem("fs-agent-onboarded", "1"));

  await page.goto(`${origin}/home`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForFunction(() => /Call agent/i.test(document.body.innerText), { timeout: 60000 });

  // 1. rail position
  const rail = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.className.includes("w-[66px]"))
      .map((b) => b.innerText.trim()),
  );
  assert(rail.includes("Call agent"), `"Call agent" missing from the rail: ${rail.join(", ")}`);
  assert.equal(
    rail[rail.indexOf("Leads") + 1],
    "Call agent",
    `"Call agent" must sit directly below Leads — got: ${rail.join(", ")}`,
  );
  console.log("✅ rail:", rail.join(" · "));

  // 2. the rail opens the studio itself, not a menu of one card.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => /^Call agent$/i.test(b.innerText.trim()))
      ?.click();
  });
  // Wait on real content — the dev route compiles on first hit, so a fixed
  // sleep here reports a false failure.
  await page.waitForFunction(
    () => /What should it do\?|Build my agent|Agent brief/i.test(document.body.innerText),
    { timeout: 120000 },
  );
  console.log("✅ rail click opens the studio directly");

  // 3–5. Brand Kit auto-fill.
  if (kit?.name) {
    await page.waitForFunction(
      (sel) => {
        const ta = document.querySelector(sel);
        return !!ta && ta.value.trim().length > 0;
      },
      { timeout: 30000 },
      BUSINESS,
    );

    const got = await page.evaluate(
      (bizSel, greetSel) => ({
        business: document.querySelector(bizSel)?.value ?? "",
        greeting: document.querySelector(greetSel)?.value ?? "",
        chip: /Filled in from your Brand Kit/i.test(document.body.innerText),
      }),
      BUSINESS,
      GREETING,
    );

    assert(
      got.business.includes(kit.name),
      `business blurb should name the business ("${kit.name}") — got: ${got.business.slice(0, 120)}`,
    );
    assert(
      !/calling us\b/i.test(got.greeting),
      `greeting still says "calling us" — the {business} placeholder was not filled: ${got.greeting}`,
    );
    assert(
      got.greeting.includes(kit.name),
      `greeting should name the business — got: ${got.greeting}`,
    );
    // The chip is set from a flag; flipping it inside a setState updater reads
    // back stale (updaters run during the next render), which silently hid it.
    assert(got.chip, 'the "Filled in from your Brand Kit" chip did not render');
    console.log(`✅ brand kit → business + greeting ("${got.greeting}") + chip`);
  } else {
    console.log("⏭  no Brand Kit on the test user — skipped the auto-fill checks");
  }

  // 6. the number step + honest pricing.
  const text = await page.evaluate(() => document.body.innerText);
  for (const probe of ["Subscribe to a new number", "500 cr / month", "Forward my existing line", "9 cr / min"]) {
    assert(text.includes(probe), `brief is missing: ${probe}`);
  }
  console.log("✅ number step + pricing (9 cr / min · 500 cr / month)");

  await page.screenshot({ path: shot });
  assert.equal(fail.length, 0, `page errors:\n${fail.join("\n")}`);
  console.log(`\nAll Voice Agent UI checks passed — ${shot}`);
} finally {
  await browser.close();
}
