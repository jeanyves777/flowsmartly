import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const jobId = "cmldbtbnl0005vpe4yh6li6vy";

  const job = await p.cartoonVideo.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, progress: true, currentStep: true, script: true, sceneImages: true },
  });

  if (!job) {
    console.log("Job not found");
    return;
  }

  console.log(`Job ${job.id}: status=${job.status}, progress=${job.progress}`);
  console.log(`Script: ${job.script ? "yes" : "no"}`);
  console.log(`Scene images: ${job.sceneImages || "none"}`);

  // Mark as FAILED so the Retry button works
  await p.cartoonVideo.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      progress: 0,
      errorMessage: "Connection lost during generation. Use Retry to resume from saved progress.",
    },
  });

  console.log("Job marked as FAILED — ready for retry");
  await p.$disconnect();
}

main();
