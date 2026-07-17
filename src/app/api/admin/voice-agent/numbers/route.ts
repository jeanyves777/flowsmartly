/**
 * Admin — fulfil voice number requests.
 *
 * The provider refuses to provision its own numbers over the API ("Use the
 * console instead"), so a human genuinely has to add the number there. This is
 * the queue for that, and the way the console number gets mapped back to the
 * tenant who asked.
 *
 * GET  → open requests + the team's numbers from the provider, side by side so
 *        an admin can see which console numbers aren't claimed yet.
 * POST → attach a provider number to a request and switch the line on.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/client";
import { listXaiNumbers } from "@/lib/voice-agent/xai-phone";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const [requests, claimed, provider] = await Promise.all([
      prisma.phoneNumber.findMany({
        where: { status: "REQUESTED" },
        orderBy: { requestedAt: "asc" },
        include: {
          user: { select: { id: true, email: true, name: true } },
          agent: { select: { id: true, name: true } },
        },
      }),
      prisma.phoneNumber.findMany({
        where: { status: "ACTIVE" },
        select: { xaiPhoneNumberId: true, e164: true, userId: true },
      }),
      listXaiNumbers(),
    ]);

    const taken = new Set(claimed.map((c) => c.xaiPhoneNumberId).filter(Boolean));
    // Numbers that exist at the provider but aren't attached to any tenant here
    // — i.e. what an admin just added in the console and can now hand out.
    const unclaimed = provider.ok
      ? provider.numbers.filter((n) => !taken.has(n.phoneNumberId))
      : [];

    return NextResponse.json({
      success: true,
      requests,
      unclaimed,
      providerError: provider.ok ? null : provider.error,
    });
  } catch (error) {
    console.error("[admin/voice-numbers] GET error:", error);
    return fail("Could not load number requests", 500);
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const { requestId, xaiPhoneNumberId } = body as {
      requestId?: string;
      xaiPhoneNumberId?: string;
    };
    if (!requestId || !xaiPhoneNumberId) return fail("Pick a request and a number.");

    const req = await prisma.phoneNumber.findUnique({ where: { id: requestId } });
    if (!req) return fail("Request not found", 404);
    if (req.status !== "REQUESTED") return fail("That request is already handled.");

    const provider = await listXaiNumbers();
    if (!provider.ok) return fail(provider.error || "Could not reach the provider", 502);

    const picked = provider.numbers.find((n) => n.phoneNumberId === xaiPhoneNumberId);
    if (!picked?.phoneNumber) return fail("That number isn't at the provider.");

    // Don't hand the same line to two tenants.
    const clash = await prisma.phoneNumber.findFirst({
      where: {
        OR: [{ xaiPhoneNumberId }, { e164: picked.phoneNumber }],
        status: { not: "RELEASED" },
        NOT: { id: requestId },
      },
    });
    if (clash) return fail("That number is already assigned to someone.");

    const number = await prisma.phoneNumber.update({
      where: { id: requestId },
      data: {
        e164: picked.phoneNumber,
        status: "ACTIVE",
        xaiPhoneNumberId: picked.phoneNumberId,
        xaiAgentId: picked.agentId ?? null,
        sipHost: picked.sipHost ?? null,
        region: picked.name ?? null,
        fulfilledAt: new Date(),
        fulfilledBy: admin.adminId,
      },
      include: { user: { select: { email: true } } },
    });

    // Handing a phone line to a tenant is worth a trail.
    await auditAdmin("voice_number.assign", admin.adminId, "PhoneNumber", number.id, {
      e164: picked.phoneNumber,
      xaiPhoneNumberId,
      tenant: number.user?.email,
    });

    return NextResponse.json({ success: true, number });
  } catch (error) {
    console.error("[admin/voice-numbers] POST error:", error);
    return fail("Could not assign that number", 500);
  }
}
