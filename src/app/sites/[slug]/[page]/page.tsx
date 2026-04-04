import { prisma } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { resolveTheme } from "@/lib/website/theme-resolver";
import { BlockRenderer } from "@/components/website-builder/blocks/block-renderer";
import type { WebsiteBlock } from "@/types/website-builder";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; page: string }> }): Promise<Metadata> {
  const { slug, page: pageSlug } = await params;

  const website = await prisma.website.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!website) return { title: "Not Found" };

  const page = await prisma.websitePage.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug: pageSlug } },
    select: { seoTitle: true, seoDescription: true, seoImage: true, title: true },
  });
  if (!page) return { title: "Not Found" };

  return {
    title: page.seoTitle || `${page.title} - ${website.name}`,
    description: page.seoDescription || undefined,
    openGraph: {
      title: page.seoTitle || `${page.title} - ${website.name}`,
      description: page.seoDescription || undefined,
      images: page.seoImage ? [page.seoImage] : undefined,
    },
  };
}

export default async function WebsiteSubPage({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page: pageSlug } = await params;

  const website = await prisma.website.findUnique({
    where: { slug },
    include: { brandKit: { select: { colors: true, fonts: true, logo: true, name: true } } },
  });
  if (!website) notFound();

  const page = await prisma.websitePage.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug: pageSlug } },
  });
  if (!page || page.status === "HIDDEN") notFound();

  const theme = resolveTheme(website.theme, website.brandKit);

  let blocks: WebsiteBlock[] = [];
  try { blocks = JSON.parse(page.blocks || "[]"); } catch {}

  // Increment views
  prisma.websitePage.update({ where: { id: page.id }, data: { views: { increment: 1 } } }).catch(() => {});
  prisma.website.update({ where: { id: website.id }, data: { totalViews: { increment: 1 } } }).catch(() => {});

  return (
    <main>
      {blocks
        .filter((b) => b.visibility.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((block) => (
          <BlockRenderer key={block.id} block={block} theme={theme} siteSlug={slug} />
        ))}
    </main>
  );
}
