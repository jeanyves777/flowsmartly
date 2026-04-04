import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { WebsiteEditor } from "@/components/website-builder/editor/website-editor";

export default async function WebsiteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const website = await prisma.website.findFirst({
    where: { id, userId: session.userId, deletedAt: null },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!website) redirect("/websites");

  return (
    <WebsiteEditor
      websiteId={website.id}
      websiteName={website.name}
      websiteSlug={website.slug}
      pages={website.pages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        isHomePage: p.isHomePage,
        status: p.status,
        sortOrder: p.sortOrder,
        blocks: p.blocks,
      }))}
      theme={website.theme}
      navigation={website.navigation}
    />
  );
}
