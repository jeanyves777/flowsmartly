import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { notifyDomainRegistered, notifyDomainRegistrationFailed } from "@/lib/notifications/domain";

/**
 * POST /api/domains/[id]/retry — Retry a failed domain registration
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const domain = await prisma.storeDomain.findFirst({
      where: { id, userId: session.userId },
    });
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    if (domain.registrarStatus !== "registration_failed" && domain.registrarStatus !== "pending_registration") {
      return NextResponse.json({ error: "Domain is not in a retryable state" }, { status: 400 });
    }

    // Try to register with OpenSRS
    try {
      const { registerDomain } = await import("@/lib/domains/opensrs-client");
      const { nanoid } = await import("nanoid");

      // OpenSRS only allows alphanumerics — strip non-alphanumeric chars
      const cleanId = nanoid(8).replace(/[^a-zA-Z0-9]/g, "");
      const cleanPw = nanoid(16).replace(/[^a-zA-Z0-9]/g, "");
      const result = await registerDomain({
        domain: domain.domainName,
        period: 1,
        regUsername: `fs${cleanId}`,
        regPassword: cleanPw,
      });

      // Update domain record
      await prisma.storeDomain.update({
        where: { id },
        data: {
          registrarStatus: "active",
          registrarOrderId: result.orderId,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      await notifyDomainRegistered(session.userId, domain.domainName);
      return NextResponse.json({ success: true, message: "Domain registered successfully!" });
    } catch (err: any) {
      // Update failure count or status
      await prisma.storeDomain.update({
        where: { id },
        data: { registrarStatus: "registration_failed" },
      });

      await notifyDomainRegistrationFailed(session.userId, domain.domainName, err.message);
      return NextResponse.json({ error: `Registration failed: ${err.message}` }, { status: 500 });
    }
  } catch (err) {
    console.error("Domain retry error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
