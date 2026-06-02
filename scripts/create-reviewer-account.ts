/**
 * Create / repair the store-reviewer test account (Google Play & app review).
 * Run on the production server: `npx tsx scripts/create-reviewer-account.ts`
 *
 * IMPORTANT: the password is hashed with the SAME scrypt scheme the live login
 * uses (src/lib/auth/password.ts) — `saltB64:hashB64`. An earlier version of
 * this script used bcrypt, whose hash verifyPassword() can't read, so the
 * account could never log in with email/password. This version is verifiable
 * end-to-end and will UPDATE an existing account's hash so it works.
 */

import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

// Mirror src/lib/auth/password.ts exactly so the live login can verify it.
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

async function main() {
  const email = "reviewer@flowsmartly.com";
  const password = "FlowReview2026!Play";
  const username = "flowsmartly_reviewer";

  const passwordHash = hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash, // repair to a scrypt hash the login can verify
        name: "App Reviewer",
        username: existing.username || username,
        emailVerified: true,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        deletedAt: null,
        plan: "PRO",
        aiCredits: existing.aiCredits < 500 ? 500 : existing.aiCredits,
        oauthProvider: null, // ensure it's an email/password account
      },
    });
    console.log("✅ Reviewer account REPAIRED (password reset to scrypt hash).");
    console.log(`   User ID: ${existing.id}`);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: "App Reviewer",
        passwordHash,
        country: "US",
        region: "worldwide",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        aiCredits: 500,
        freeCredits: 500,
        plan: "PRO",
      },
    });
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 500,
        type: "BONUS",
        description: "Test account credits for app reviewer",
        balanceAfter: 500,
      },
    });
    console.log("✅ Reviewer account CREATED.");
    console.log(`   User ID: ${user.id}`);
  }

  console.log("\n📋 REVIEWER CREDENTIALS:");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Username: ${username}`);
  console.log(`   Plan: PRO · Credits: 500`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ Script failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
