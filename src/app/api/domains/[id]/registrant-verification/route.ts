import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  resendRegistrantVerificationEmail,
  syncRegistrantVerificationStatus,
} from "@/lib/domains/registrant-verification";

export const runtime = "nodejs";

async function requireOwnedDomain(id: string, userId: string) {
  const domain = await prisma.storeDomain.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!domain) {
    return { error: NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Domain not found" } }, { status: 404 }) };
  }

  if (domain.userId !== userId) {
    return { error: NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "You do not own this domain" } }, { status: 403 }) };
  }

  return { domain };
}

export async function GET(
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
    const check = await requireOwnedDomain(id, session.userId);
    if (check.error) return check.error;

    const status = await syncRegistrantVerificationStatus(id);
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("Registrant verification status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REGISTRANT_VERIFICATION_STATUS_FAILED",
          message: error instanceof Error ? error.message : "Failed to check registrant verification status",
        },
      },
      { status: 500 }
    );
  }
}

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
    const check = await requireOwnedDomain(id, session.userId);
    if (check.error) return check.error;

    const result = await resendRegistrantVerificationEmail(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Registrant verification resend error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REGISTRANT_VERIFICATION_RESEND_FAILED",
          message: error instanceof Error ? error.message : "Failed to resend registrant verification email",
        },
      },
      { status: 500 }
    );
  }
}
