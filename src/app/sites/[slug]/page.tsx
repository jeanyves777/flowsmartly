import { prisma } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { resolveTheme } from "@/lib/website/theme-resolver";
import { BlockRenderer } from "@/components/website-builder/blocks/block-renderer";
import type { WebsiteBlock } from "@/types/website-builder";

export default async function WebsiteHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const website = await prisma.website.findUnique({
    where: { slug },
    include: {
      brandKit: { select: { colors: true, fonts: true, logo: true, name: true } },
      pages: { where: { isHomePage: true }, take: 1 },
    },
  });

  if (!website || (!website.pages[0])) notFound();

  const page = website.pages[0];
  const theme = resolveTheme(website.theme, website.brandKit);

  let blocks: WebsiteBlock[] = [];
  try { blocks = JSON.parse(page.blocks || "[]"); } catch {}

  // Increment view count (fire and forget)
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
