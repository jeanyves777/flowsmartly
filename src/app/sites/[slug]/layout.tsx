import { prisma } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { resolveTheme, themeToCSS, getGoogleFontsUrl } from "@/lib/website/theme-resolver";
import { generateAnimationCSS, generateAnimationScript } from "@/lib/website/animation-css";
import type { WebsiteBlock } from "@/types/website-builder";
import { DarkModeToggle } from "@/components/website-builder/shared/dark-mode-toggle";
import type { Metadata } from "next";

async function getWebsite(slug: string) {
  const website = await prisma.website.findUnique({
    where: { slug },
    include: {
      brandKit: { select: { colors: true, fonts: true, logo: true, name: true } },
      pages: { where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } },
    },
  });
  return website;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const website = await getWebsite(slug);
  if (!website) return { title: "Not Found" };

  return {
    title: website.seoTitle || website.name,
    description: website.seoDescription || `${website.name} - Built with FlowSmartly`,
    openGraph: {
      title: website.seoTitle || website.name,
      description: website.seoDescription || undefined,
      images: website.seoImage ? [website.seoImage] : undefined,
    },
  };
}

export default async function WebsiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const website = await getWebsite(slug);
  if (!website) notFound();
  if (website.status !== "PUBLISHED" && website.status !== "DRAFT") notFound();

  const theme = resolveTheme(website.theme, website.brandKit);
  const themeCSS = themeToCSS(theme);
  const fontsUrl = getGoogleFontsUrl(theme);

  // Collect all blocks from all pages for animation CSS
  const allBlocks: WebsiteBlock[] = website.pages.flatMap((p) => {
    try { return JSON.parse(p.blocks || "[]"); } catch { return []; }
  });
  const animCSS = generateAnimationCSS(allBlocks);
  const animScript = generateAnimationScript(allBlocks);

  return (
    <html lang="en">
      <head>
        {fontsUrl && <link rel="preconnect" href="https://fonts.googleapis.com" />}
        {fontsUrl && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />}
        {fontsUrl && <link href={fontsUrl} rel="stylesheet" />}
        {website.favicon && <link rel="icon" href={website.favicon} />}
        <style dangerouslySetInnerHTML={{ __html: themeCSS + animCSS }} />
      </head>
      <body className="min-h-screen">
        {children}
        <DarkModeToggle />
        {animScript && <div dangerouslySetInnerHTML={{ __html: animScript }} />}
      </body>
    </html>
  );
}
