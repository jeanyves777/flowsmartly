/**
 * Create Test Reviewer Account for Facebook App Review
 * Run this on the production server to create the reviewer test account
 *
 * Usage: npx tsx scripts/create-reviewer-account.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createReviewerAccount() {
  try {
    console.log("Creating reviewer test account...");

    const email = "reviewer@flowsmartly.com";
    const password = "FlowTest2024!Review";
    const username = "flowsmartly_reviewer";

    // Check if account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("✅ Reviewer account already exists!");
      console.log(`   Email: ${email}`);
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   User ID: ${existingUser.id}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user account
    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: "Facebook Reviewer",
        password: hashedPassword,
        country: "US",
        region: "worldwide",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        aiCredits: 500, // Give reviewer plenty of credits
        freeCredits: 500,
        plan: "PRO", // Give PRO access so they can test all features
      },
    });

    // Add welcome credits transaction
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 500,
        type: "BONUS",
        description: "Test account credits for Facebook reviewer",
        balanceAfter: 500,
      },
    });

    console.log("\n✅ Reviewer account created successfully!");
    console.log("\n📋 TEST CREDENTIALS:");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Username: ${username}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Plan: PRO`);
    console.log(`   Credits: 500`);
    console.log("\n✅ Account is ready for Facebook app review!");
  } catch (error) {
    console.error("❌ Error creating reviewer account:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createReviewerAccount()
  .then(() => {
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
