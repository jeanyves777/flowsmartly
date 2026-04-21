import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { SharedPlanViewer } from "./viewer-client";

// Public, auth-less viewer for a business plan that the owner chose to share.
// Only plans with a publicToken are reachable. Read-only — no edit controls,
// no share/regenerate, no download unless we decide to enable it later.
//
// Kept outside the (dashboard) route group so the dashboard layout / auth
// gates don't wrap this page. A recipient opens the link without logging in.

export default async function SharedBusinessPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || typeof token !== "string" || token.length < 10) return notFound();

  const plan = await prisma.businessPlan.findFirst({
    where: { publicToken: token },
    select: {
      id: true,
      name: true,
      industry: true,
      stage: true,
      coverColor: true,
      generationCount: true,
      createdAt: true,
      updatedAt: true,
      sections: true,
    },
  });
  if (!plan) return notFound();

  let sections: unknown = [];
  try { sections = JSON.parse(plan.sections); } catch {}

  return (
    <SharedPlanViewer
      plan={{
        name: plan.name,
        industry: plan.industry,
        stage: plan.stage,
        coverColor: plan.coverColor,
        generationCount: plan.generationCount,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sections: Array.isArray(sections) ? (sections as any[]) : [],
      }}
    />
  );
}
