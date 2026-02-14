const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return salt.toString("base64") + ":" + hash.toString("base64");
}

async function main() {
  console.log("Creating Test User...");

  const testEmail = "test@flowsmartly.com";
  const testPassword = "Test@123456";

  const existing = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (existing) {
    console.log("Test User already exists!");
  } else {
    const planExpiresAt = new Date();
    planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);

    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hashPassword(testPassword),
        name: "Test User",
        username: "testuser",
        plan: "BASIC",
        planExpiresAt,
        aiCredits: 1000,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log("Test User created successfully!");
  }

  console.log("");
  console.log("================================");
  console.log("  TEST USER CREDENTIALS");
  console.log("================================");
  console.log("  Email:    " + testEmail);
  console.log("  Password: " + testPassword);
  console.log("  Plan:     BASIC (Active)");
  console.log("================================");
  console.log("");
  console.log("Login at: http://localhost:3000/login");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
