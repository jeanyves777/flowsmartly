import { prisma } from "@/lib/db/client";
import { researchBusiness } from "./researcher";
import { generatePitch, type BrandContext } from "./generator";

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

    // Step 2: Get sender's user + brand kit for fully personalized pitch
    const [user, brandKit] = await Promise.all([
      prisma.user.findUnique({
        where: { id: pitch.userId },
        select: { name: true },
      }),
      prisma.brandKit.findFirst({
        where: { userId: pitch.userId },
        select: {
          name: true,
          description: true,
          industry: true,
          niche: true,
          products: true,
          uniqueValue: true,
          targetAudience: true,
          website: true,
        },
      }),
    ]);

    // Parse products JSON array safely
    const products = (() => {
      try { return JSON.parse(brandKit?.products || "[]") as string[]; }
      catch { return [] as string[]; }
    })();

    // Step 3: Research the business (pass brand name so AI references the user's brand)
    const research = await researchBusiness(pitch.businessUrl || "", pitch.businessName, brandKit?.name || undefined);

    // Build brand context — fall back to generic if no brand kit
    const brand: BrandContext = brandKit?.name
      ? {
          name: brandKit.name,
          description: brandKit.description || undefined,
          industry: brandKit.industry || undefined,
          niche: brandKit.niche || undefined,
          products: products.filter(Boolean),
          uniqueValue: brandKit.uniqueValue || undefined,
          targetAudience: brandKit.targetAudience || undefined,
          website: brandKit.website || undefined,
          senderName: user?.name || brandKit.name,
        }
      : {
          name: user?.name || "Our Team",
          senderName: user?.name || "Our Team",
        };

    // Step 4: Generate the pitch customized to the user's brand
    const pitchContent = await generatePitch(research, pitch.businessName, brand);

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
