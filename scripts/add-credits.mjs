// scripts/add-credits.mjs — add AI credits to a user (dev/testing).
//   node scripts/add-credits.mjs test@flowsmartly.com 1000
import { PrismaClient } from "@prisma/client";

const email = process.argv[2] || "test@flowsmartly.com";
const amount = Number(process.argv[3] || 1000);

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, aiCredits: true } });
  if (!user) {
    console.error(`✗ No user with email ${email}`);
    process.exit(1);
  }
  const updated = await prisma.user.update({
    where: { email },
    data: { aiCredits: { increment: amount } },
    select: { aiCredits: true },
  });
  console.log(`✓ ${email}: ${user.aiCredits} → ${updated.aiCredits} (+${amount})`);
} finally {
  await prisma.$disconnect();
}
