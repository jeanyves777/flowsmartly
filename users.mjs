import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const us = await p.user.findMany({ select: { id:true, email:true, name:true, aiCredits:true }, take: 20 });
console.log(JSON.stringify(us, null, 1));
await p.$disconnect();
