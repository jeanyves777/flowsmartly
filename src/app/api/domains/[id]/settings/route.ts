import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * PATCH /api/domains/[id]/settings
 * Update domain settings: autoRenew, whoisPrivacy, link to store/website.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: { id: true, userId: true, storeId: true, domainName: true },
    });

    if (!domain) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Domain not found" } },
        { status: 404 }
      );
    }

    if (domain.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You do not own this domain" } },
        { status: 403 }
      );
    }

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {};

    if (typeof body.autoRenew === "boolean") {
      updateData.autoRenew = body.autoRenew;
    }

    if (typeof body.whoisPrivacy === "boolean") {
      updateData.whoisPrivacy = body.whoisPrivacy;
    }

    // Link to store
    if (body.linkToStore === true) {
      const store = await prisma.store.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (store) {
        updateData.storeId = store.id;
      } else {
        return NextResponse.json(
          { success: false, error: { code: "NO_STORE", message: "You don't have a FlowShop store to link" } },
          { status: 400 }
        );
      }
    } else if (body.linkToStore === false) {
      updateData.storeId = null;
    }

    // Link to website
    if (typeof body.linkToWebsite === "string" && body.linkToWebsite) {
      const website = await prisma.website.findFirst({
        where: { id: body.linkToWebsite, userId: session.userId, deletedAt: null },
        select: { id: true, slug: true, customDomain: true },
      });
      if (!website) {
        return NextResponse.json(
          { success: false, error: { code: "WEBSITE_NOT_FOUND", message: "Website not found" } },
          { status: 404 }
        );
      }
      // Update website's customDomain
      await prisma.website.update({
        where: { id: website.id },
        data: { customDomain: domain.domainName },
      });
    } else if (body.linkToWebsite === null) {
      // Unlink from any website that uses this domain
      await prisma.website.updateMany({
        where: { customDomain: domain.domainName, userId: session.userId },
        data: { customDomain: null },
      });
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.storeDomain.update({
        where: { id },
        data: updateData,
      });
    }

    // Return updated domain
    const updated = await prisma.storeDomain.findUnique({
      where: { id },
      select: {
        id: true,
        domainName: true,
        autoRenew: true,
        whoisPrivacy: true,
        storeId: true,
        isPrimary: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { domain: updated },
    });
  } catch (error) {
    console.error("Domain settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update domain settings" } },
      { status: 500 }
    );
  }
}
