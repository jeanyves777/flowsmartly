import { prisma } from "@/lib/db/client";
import { researchBusiness } from "./researcher";
import { generatePitch } from "./generator";

export async function processPitch(pitchId: string): Promise<void> {
  let pitch;
  try {
    pitch = await prisma.pitch.findUnique({ where: { id: pitchId } });
    if (!pitch) return;

    // Step 1: Start researching
    await prisma.pitch.update({
      where: { id: pitchId },
      data: { status: "RESEARCHING" },
    });

    // Step 2: Research the business
    const research = await researchBusiness(pitch.businessUrl || "", pitch.businessName);

    // Step 3: Get sender name (the user who created the pitch)
    const user = await prisma.user.findUnique({
      where: { id: pitch.userId },
      select: { name: true },
    });
    const senderName = user?.name || "The FlowSmartly Team";

    // Step 4: Generate the pitch
    const pitchContent = await generatePitch(research, pitch.businessName, senderName);

    // Step 5: Save results
    await prisma.pitch.update({
      where: { id: pitchId },
      data: {
        status: "READY",
        research: JSON.stringify(research),
        pitchContent: JSON.stringify(pitchContent),
        errorMessage: null,
      },
    });
  } catch (err) {
    console.error(`[processPitch] Error for pitch ${pitchId}:`, err);
    try {
      await prisma.pitch.update({
        where: { id: pitchId },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "Unknown error during research",
        },
      });
    } catch { /* ignore secondary errors */ }
  }
}
