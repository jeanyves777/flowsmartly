import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

function publicPost(post: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string | null;
  image: string | null;
  author: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    image: post.image,
    author: post.author,
    date: (post.publishedAt || post.createdAt).toISOString().slice(0, 10),
    publishedAt: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const isPublicFeed = req.nextUrl.searchParams.get("public") === "1";

    if (isPublicFeed) {
      const website = await prisma.website.findFirst({
        where: { id, status: "PUBLISHED", deletedAt: null },
        select: { id: true },
      });
      if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const posts = await prisma.websiteBlogPost.findMany({
        where: { websiteId: id, status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      });

      return NextResponse.json({ success: true, posts: posts.map(publicPost) });
    }

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const posts = await prisma.websiteBlogPost.findMany({
      where: { websiteId: id, userId: session.userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error("GET /api/websites/[id]/blog-posts error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
