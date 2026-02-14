import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

// Password hashing config
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

async function main() {
  console.log("\n🔧 Creating Test User...\n");

  const testEmail = "test@flowsmartly.com";
  const testPassword = "Test@123456";
  const testName = "Test User";
  const testUsername = "testuser";

  // Check if test user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (existingUser) {
    console.log("✅ Test User already exists!\n");
  } else {
    const passwordHash = hashPassword(testPassword);

    // Set plan expiry to 1 year from now
    const planExpiresAt = new Date();
    planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);

    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: testName,
        username: testUsername,
        plan: "BASIC",
        planExpiresAt,
        aiCredits: 1000,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    console.log("✅ Test User created successfully!\n");
  }

  console.log("================================");
  console.log("  TEST USER CREDENTIALS");
  console.log("================================");
  console.log(`  Email:    ${testEmail}`);
  console.log(`  Password: ${testPassword}`);
  console.log(`  Plan:     BASIC (Active)`);
  console.log("================================\n");
  console.log("🚀 Login at: http://localhost:3000/login\n");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
