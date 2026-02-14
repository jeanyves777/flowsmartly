import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

// Password hashing config (matches src/lib/auth/password.ts)
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

async function main() {
  console.log("\n🔧 Creating Super Admin user...\n");

  // Super Admin credentials
  const email = "admin@flowsmartly.com";
  const password = "Admin@123456";
  const name = "Super Admin";

  // Check if admin already exists
  const existing = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("✅ Super Admin already exists!\n");
    console.log("================================");
    console.log("  SUPER ADMIN CREDENTIALS");
    console.log("================================");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log("================================\n");
    return;
  }

  const passwordHash = hashPassword(password);

  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name,
      role: "SUPER_ADMIN",
      permissions: JSON.stringify([
        "VIEW_USERS", "EDIT_USERS", "DELETE_USERS", "BAN_USERS",
        "VIEW_CONTENT", "MODERATE_CONTENT", "DELETE_CONTENT",
        "VIEW_ANALYTICS", "EXPORT_ANALYTICS",
        "VIEW_AUDIT_LOGS", "EXPORT_AUDIT_LOGS",
        "VIEW_SETTINGS", "EDIT_SETTINGS",
        "VIEW_ADMINS", "MANAGE_ADMINS"
      ]),
      isSuperAdmin: true,
      isActive: true,
    },
  });

  console.log("✅ Super Admin created successfully!\n");
  console.log("================================");
  console.log("  SUPER ADMIN CREDENTIALS");
  console.log("================================");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("================================\n");
  console.log("🚀 Login at: http://localhost:3000/admin/login\n");

  // Create test user
  await createTestUser();
}

async function createTestUser() {
  console.log("🔧 Creating Test User...\n");

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
    console.log("================================");
    console.log("  TEST USER CREDENTIALS");
    console.log("================================");
    console.log(`  Email:    ${testEmail}`);
    console.log(`  Password: ${testPassword}`);
    console.log(`  Plan:     BASIC`);
    console.log("================================\n");
    return;
  }

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
    console.error("❌ Error creating admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
