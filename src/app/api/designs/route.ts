import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/designs - Fetch user's design history
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const folderId = searchParams.get("folderId");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    const where: Record<string, unknown> = { userId: session.userId };
    if (category) where.category = category;
    if (folderId) {
      where.folderId = folderId === "root" ? null : folderId;
    }
    if (search) {
      where.name = { contains: search };
    }

    const designs = await prisma.design.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = designs.length > limit;
    const result = hasMore ? designs.slice(0, limit) : designs;

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        designs: result.map((d) => {
          const meta = JSON.parse(d.metadata || "{}");
          return {
            id: d.id,
            prompt: d.prompt,
            category: d.category,
            size: d.size,
            style: d.style,
            imageUrl: d.imageUrl,
            name: d.name,
            canvasData: d.canvasData,
            pipeline: meta.pipeline || null,
            status: d.status,
            metadata: d.metadata || "{}",
            createdAt: d.createdAt.toISOString(),
          };
        }),
        hasMore,
        nextCursor: hasMore ? result[result.length - 1]?.id : null,
      }),
    });
  } catch (error) {
    console.error("Get designs error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch designs" } },
      { status: 500 }
    );
  }
}

// POST /api/designs - Save a design
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt, category, size, style, imageUrl, name, canvasData } = body;

    if (!category || !size) {
      return NextResponse.json(
        { success: false, error: { message: "Category and size are required" } },
        { status: 400 }
      );
    }

    const design = await prisma.design.create({
      data: {
        userId: session.userId,
        prompt: prompt || "",
        category,
        size,
        style: style || null,
        imageUrl: imageUrl || null,
        name: name || "Untitled Design",
        canvasData: canvasData || null,
        status: canvasData || imageUrl ? "COMPLETED" : "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        design: {
          id: design.id,
          prompt: design.prompt,
          category: design.category,
          size: design.size,
          style: design.style,
          imageUrl: design.imageUrl,
          name: design.name,
          canvasData: design.canvasData,
          status: design.status,
          createdAt: design.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Create design error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to save design" } },
      { status: 500 }
    );
  }
}

// PUT /api/designs - Update an existing design
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, name, canvasData, imageUrl, category, size, style, prompt } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Design ID is required" } },
        { status: 400 }
      );
    }

    const existing = await prisma.design.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    const updated = await prisma.design.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(canvasData !== undefined && { canvasData }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(category !== undefined && { category }),
        ...(size !== undefined && { size }),
        ...(style !== undefined && { style }),
        ...(prompt !== undefined && { prompt }),
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        design: {
          id: updated.id,
          prompt: updated.prompt,
          category: updated.category,
          size: updated.size,
          style: updated.style,
          imageUrl: updated.imageUrl,
          name: updated.name,
          canvasData: updated.canvasData,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Update design error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update design" } },
      { status: 500 }
    );
  }
}
