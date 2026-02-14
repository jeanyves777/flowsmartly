import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const jobs = await p.cartoonVideo.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      progress: true,
      currentStep: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  console.log(JSON.stringify(jobs, null, 2));
  await p.$disconnect();
}

main();
