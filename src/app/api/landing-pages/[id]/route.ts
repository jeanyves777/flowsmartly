import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/landing-pages/[id] - Get a single landing page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const page = await prisma.landingPage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json(
        { success: false, error: { message: "Landing page not found" } },
        { status: 404 }
      );
    }

    const include = request.nextUrl.searchParams.get("include") || "";
    let submissionCount: number | undefined;
    let recentSubmissions: Array<{ id: string; data: unknown; createdAt: Date; contactId: string | null }> | undefined;

    if (include.includes("submissions")) {
      submissionCount = await prisma.formSubmission.count({
        where: { landingPageId: id },
      });
      const rawSubmissions = await prisma.formSubmission.findMany({
        where: { landingPageId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, data: true, createdAt: true, contactId: true },
      });
      recentSubmissions = rawSubmissions.map((s) => ({
        ...s,
        data: typeof s.data === "string" ? JSON.parse(s.data) : s.data,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        page: {
          ...page,
          settings: JSON.parse(page.settings),
        },
        ...(submissionCount !== undefined && { submissionCount }),
        ...(recentSubmissions !== undefined && { recentSubmissions }),
      },
    });
  } catch (error) {
    console.error("Get landing page error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch landing page" } },
      { status: 500 }
    );
  }
}

// PATCH /api/landing-pages/[id] - Update a landing page
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership
    const existingPage = await prisma.landingPage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, error: { message: "Landing page not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { htmlContent, title, description, slug, settings, status } = body as {
      htmlContent?: string;
      title?: string;
      description?: string;
      slug?: string;
      settings?: Record<string, unknown>;
      status?: string;
    };

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};

    if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (settings !== undefined) updateData.settings = JSON.stringify(settings);
    if (status !== undefined) updateData.status = status;

    // Handle slug change with uniqueness check
    if (slug !== undefined && slug !== existingPage.slug) {
      const slugTaken = await prisma.landingPage.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      });

      if (slugTaken) {
        return NextResponse.json(
          { success: false, error: { message: "Slug is already taken" } },
          { status: 409 }
        );
      }

      updateData.slug = slug;
    }

    const updatedPage = await prisma.landingPage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        page: {
          ...updatedPage,
          settings: JSON.parse(updatedPage.settings),
        },
      },
    });
  } catch (error) {
    console.error("Update landing page error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update landing page" } },
      { status: 500 }
    );
  }
}

// DELETE /api/landing-pages/[id] - Delete a landing page
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership
    const existingPage = await prisma.landingPage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, error: { message: "Landing page not found" } },
        { status: 404 }
      );
    }

    await prisma.landingPage.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Landing page deleted successfully" },
    });
  } catch (error) {
    console.error("Delete landing page error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete landing page" } },
      { status: 500 }
    );
  }
}
