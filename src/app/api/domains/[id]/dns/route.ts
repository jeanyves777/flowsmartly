import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { listDnsRecords, addDnsRecord, deleteDnsRecord } from "@/lib/domains/cloudflare-client";

/**
 * GET /api/domains/[id]/dns
 * List all DNS records for a domain's Cloudflare zone.
 */
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

    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: { userId: true, cloudflareZoneId: true, domainName: true },
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

    if (!domain.cloudflareZoneId) {
      return NextResponse.json({
        success: true,
        data: { records: [], message: "No Cloudflare zone configured for this domain" },
      });
    }

    const records = await listDnsRecords(domain.cloudflareZoneId);

    return NextResponse.json({
      success: true,
      data: {
        records: records.map((r) => ({
          id: r.id,
          type: r.type,
          name: r.name,
          content: r.content,
          proxied: r.proxied,
          ttl: r.ttl,
        })),
      },
    });
  } catch (error) {
    console.error("DNS list error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch DNS records" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains/[id]/dns
 * Add a new DNS record.
 */
export async function POST(
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
    const { type, name, content, proxied, ttl } = body;

    if (!type || !name || !content) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "type, name, and content are required" } },
        { status: 400 }
      );
    }

    const validTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TYPE", message: `Invalid record type. Supported: ${validTypes.join(", ")}` } },
        { status: 400 }
      );
    }

    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: { userId: true, cloudflareZoneId: true },
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

    if (!domain.cloudflareZoneId) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ZONE", message: "No Cloudflare zone configured" } },
        { status: 400 }
      );
    }

    const result = await addDnsRecord(domain.cloudflareZoneId, {
      type,
      name,
      content,
      proxied: proxied ?? false,
      ttl: ttl ?? 1,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "CREATE_FAILED", message: "Failed to create DNS record" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { recordId: result.recordId },
    });
  } catch (error) {
    console.error("DNS create error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create DNS record" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domains/[id]/dns
 * Delete a DNS record by recordId (passed in body).
 */
export async function DELETE(
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
    const { recordId } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "recordId is required" } },
        { status: 400 }
      );
    }

    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: { userId: true, cloudflareZoneId: true },
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

    if (!domain.cloudflareZoneId) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ZONE", message: "No Cloudflare zone configured" } },
        { status: 400 }
      );
    }

    const success = await deleteDnsRecord(domain.cloudflareZoneId, recordId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: { code: "DELETE_FAILED", message: "Failed to delete DNS record" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DNS delete error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete DNS record" } },
      { status: 500 }
    );
  }
}
