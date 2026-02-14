import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { generateAdPageHtml } from "@/lib/ads/ad-page-generator";

interface AdPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdPage({ params }: AdPageProps) {
  const { slug } = await params;

  const adPage = await prisma.adPage.findFirst({
    where: { slug, status: "ACTIVE" },
  });

  if (!adPage) {
    notFound();
  }

  // Increment views (fire-and-forget)
  prisma.adPage.update({
    where: { id: adPage.id },
    data: { views: { increment: 1 } },
  }).catch(() => {});

  // Also increment campaign impressions if linked
  prisma.adCampaign.updateMany({
    where: { adPageId: adPage.id, status: "ACTIVE" },
    data: { impressions: { increment: 1 } },
  }).catch(() => {});

  // Generate HTML on the fly from stored fields
  const html = generateAdPageHtml({
    headline: adPage.headline,
    description: adPage.description || undefined,
    mediaUrl: adPage.mediaUrl || undefined,
    videoUrl: adPage.videoUrl || undefined,
    destinationUrl: adPage.destinationUrl,
    ctaText: adPage.ctaText,
    slug: adPage.slug,
    templateStyle: adPage.templateStyle as "minimal" | "hero" | "split" | "video",
  });

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export async function generateMetadata({ params }: AdPageProps) {
  const { slug } = await params;
  const adPage = await prisma.adPage.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { headline: true, description: true, mediaUrl: true },
  });

  if (!adPage) return { title: "Ad Not Found" };

  return {
    title: adPage.headline,
    description: adPage.description || adPage.headline,
    openGraph: {
      title: adPage.headline,
      description: adPage.description || adPage.headline,
      ...(adPage.mediaUrl ? { images: [adPage.mediaUrl] } : {}),
    },
  };
}
