import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import fs from 'node:fs';

const p = new PrismaClient();
const SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production');

// 1. user JWT
const user = await p.user.findUnique({ where: { email: 'test@flowsmartly.com' } });
if (!user) throw new Error('no test user');
const jwt = await new SignJWT({ userId: user.id, sessionId: 'visual-qa-session', type: 'access' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('6h').sign(SECRET);

// 2. admin user + session
const admin = await p.adminUser.upsert({
  where: { email: 'visualqa@flowsmartly.com' },
  update: { isActive: true, isSuperAdmin: true },
  create: { email: 'visualqa@flowsmartly.com', passwordHash: 'x', name: 'Visual QA', role: 'SUPER_ADMIN', isActive: true, isSuperAdmin: true, permissions: '[]' },
});
const adminToken = 'visualqa-admin-token-' + Date.now();
await p.adminSession.deleteMany({ where: { adminId: admin.id } });
await p.adminSession.create({ data: { adminId: admin.id, token: adminToken, expiresAt: new Date(Date.now() + 6*3600*1000) } });

// 3. credit pricing rows (need >=1 to open the edit modal)
const n = await p.creditPricing.count();
if (n === 0) {
  await p.creditPricing.createMany({ data: [
    { key: 'AI_POST', name: 'AI Post Generation', description: 'Generate a social post with AI', credits: 5, category: 'text_generation', isActive: true },
    { key: 'AI_LOGO_GENERATION', name: 'AI Logo Generation', description: 'Generate a logo', credits: 25, category: 'image_generation', isActive: true },
  ]});
}

console.log(JSON.stringify({ userId: user.id, email: user.email, aiCredits: user.aiCredits, jwt, adminToken, creditPricingRows: await p.creditPricing.count() }, null, 1));
fs.writeFileSync('D:/wt-credit/qa-auth.json', JSON.stringify({ jwt, adminToken, userId: user.id }));
await p.$disconnect();
