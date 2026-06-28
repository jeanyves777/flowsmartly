// Validate the new-design /home surface endpoints end-to-end with a REAL
// authenticated session. Mints an access_token (the session is stateless JWT —
// see src/lib/auth/tokens.ts) for a test user and hits each surface's data API.
//
//   node scripts/validate-surfaces.mjs            # uses test@flowsmartly.com
//   TEST_USER_EMAIL=me@x.com node scripts/validate-surfaces.mjs
//   BASE_URL=http://localhost:3001 node scripts/validate-surfaces.mjs
//
// Requires the dev server running. Reads JWT_ACCESS_SECRET from .env.
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_USER_EMAIL || "test@flowsmartly.com";

const env = fs.readFileSync("./.env", "utf8");
const m = env.match(/^JWT_ACCESS_SECRET=(.*)$/m);
const secret = new TextEncoder().encode((m ? m[1] : "dev-access-secret-change-in-production").trim().replace(/^["']|["']$/g, ""));

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({ where: { email: EMAIL }, select: { id: true, email: true, plan: true } });
await prisma.$disconnect();
if (!user) { console.error(`No user ${EMAIL} in the DB.`); process.exit(1); }

const token = await new SignJWT({ userId: user.id, sessionId: "validate", type: "access" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m").sign(secret);
const cookie = `access_token=${token}`;

// [label, path, requiredDataKey | null, expectedNon200Reason | null]
const checks = [
  ["auth/me", "/api/auth/me", "user", null],
  ["email campaigns", "/api/campaigns?type=email&limit=5", "campaigns", null],
  ["email config", "/api/marketing-config", "config", null],
  ["sms campaigns", "/api/campaigns?type=sms&limit=5", "campaigns", null],
  ["sms number", "/api/sms/numbers?action=current", "hasNumber", null],
  ["pitch list", "/api/pitch?limit=5", "pitches", null],
  ["automations", "/api/automations", null, null],
  ["customers", "/api/ecommerce/customers?limit=5", null, "404 when no store"],
  ["teams", "/api/teams", null, null],
  ["referrals", "/api/referrals?limit=5", null, null],
  ["domains", "/api/domains", "domains", null],
  ["payment packages", "/api/payments/packages", "plans", null],
  ["payment methods", "/api/payments/methods", "paymentMethods", "500 when Stripe not configured"],
  ["content posts", "/api/content/posts?status=ALL&limit=5", "posts", null],
  ["store", "/api/ecommerce/store", "hasStore", null],
  ["story-ad campaigns", "/api/ai/story-ad-campaign", "campaigns", null],
  ["social accounts", "/api/social-accounts", null, null],
  ["user credits", "/api/user/credits", "credits", null],
];

console.log(`Validating ${checks.length} endpoints as ${user.email} (${user.plan}) @ ${BASE}\n`);
let pass = 0, expected = 0, fail = 0;
for (const [label, path, key, expectNon200] of checks) {
  try {
    const r = await fetch(BASE + path, { headers: { cookie } });
    let j = null; try { j = await r.json(); } catch {}
    const ok = r.status === 200 && j && j.success !== false && (!key || (j.data && key in j.data));
    if (ok) { pass++; console.log(`PASS ${String(r.status).padEnd(3)} ${label}`); }
    else if (expectNon200) { expected++; console.log(`OK*  ${String(r.status).padEnd(3)} ${label}  (expected: ${expectNon200})`); }
    else { fail++; console.log(`FAIL ${String(r.status).padEnd(3)} ${label}  -> ${j?.error?.message || (key && "missing data." + key) || "bad shape"}`); }
  } catch (e) { fail++; console.log(`FAIL  -  ${label}  -> ${e.message}`); }
}
console.log(`\n${pass} passed · ${expected} expected-non-200 · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
