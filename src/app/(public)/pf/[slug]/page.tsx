import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { getPortfolioBySlug, serializePortfolio } from "@/lib/portfolio/portfolio-editor";
import { accessCookieName, hasVerifiedAccess } from "@/lib/portfolio/verification";
import { PortfolioPublic } from "@/components/portfolio/portfolio-public";
import { PortfolioGate } from "@/components/portfolio/portfolio-gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await getPortfolioBySlug(slug);
  if (!row) return { title: "Not found" };
  const p = serializePortfolio(row);
  const noindex = !p.access.seoIndex || p.status !== "PUBLISHED";
  return {
    title: row.seoTitle || `${p.name}${p.headline ? " — " + p.headline : ""}`,
    description: row.seoDescription || p.bio || undefined,
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function PortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getPortfolioBySlug(slug);
  if (!row || row.deletedAt || row.status !== "PUBLISHED") notFound();
  const p = serializePortfolio(row);

  // Count a view — fire-and-forget so it never blocks the render.
  prisma.portfolio.update({ where: { id: row.id }, data: { totalViews: { increment: 1 } } }).catch(() => {});

  const store = await cookies();
  const hasAccess = await hasVerifiedAccess(row.id, store.get(accessCookieName(row.id))?.value);

  // View gated behind email verification → show the gate instead of content.
  if (p.access.view === "email" && !hasAccess) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f17", display: "grid", placeItems: "center" }}>
        <PortfolioGate slug={slug} ownerName={p.name} accent={p.theme.accent} variant="view" />
      </div>
    );
  }

  const downloadGated = p.access.download === "email" && !hasAccess;
  return <PortfolioPublic p={p} slug={slug} downloadGated={downloadGated} />;
}
