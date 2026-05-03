import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  createDomainVerificationToken,
  getDomainVerificationRecord,
  verifyDomainOwnership,
} from "@/lib/domains/verification";

export const runtime = "nodejs";

/**
 * POST /api/domains/[id]/verify
 * Verifies BYOD ownership through the _flowsmartly.<domain> TXT record.
 */
export async function POST(
  _request: NextRequest,
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
    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        domainName: true,
        isConnected: true,
        verificationToken: true,
        verifiedAt: true,
      },
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

    if (!domain.isConnected) {
      return NextResponse.json({
        success: true,
        data: {
          status: "verified",
          verifiedAt: domain.verifiedAt,
          message: "FlowSmartly-registered domains are verified automatically.",
        },
      });
    }

    const token = domain.verificationToken || createDomainVerificationToken();
    if (!domain.verificationToken) {
      await prisma.storeDomain.update({
        where: { id },
        data: {
          verificationToken: token,
          verificationStatus: "pending",
          verificationError: null,
        },
      });
    }

    const result = await verifyDomainOwnership(domain.domainName, token);
    const verifiedAt = result.status === "verified" ? new Date() : null;

    await prisma.storeDomain.update({
      where: { id },
      data: {
        verificationStatus: result.status,
        verifiedAt: verifiedAt ?? undefined,
        lastVerificationCheckAt: new Date(),
        verificationError: result.error ?? null,
      },
    });

    return NextResponse.json({
      success: result.status === "verified",
      data: {
        status: result.status,
        record: getDomainVerificationRecord(domain.domainName, token),
        foundTxtRecords: result.foundTxtRecords,
        nameservers: result.nameservers,
        verifiedAt,
        error: result.error,
      },
      error: result.status === "verified"
        ? undefined
        : {
            code: "TXT_NOT_FOUND",
            message: result.error || "Domain verification failed",
          },
    }, { status: result.status === "verified" ? 200 : 400 });
  } catch (error) {
    console.error("Domain verification error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to verify domain" } },
      { status: 500 }
    );
  }
}
