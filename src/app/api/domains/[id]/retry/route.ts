import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { notifyDomainRegistered, notifyDomainRegistrationFailed } from "@/lib/notifications/domain";
import { createZone, configureStoreDns, configureZoneSecurity } from "@/lib/domains/cloudflare-client";

/**
 * POST /api/domains/[id]/retry — Retry a failed domain registration
 * Handles both OpenSRS registration AND Cloudflare zone/DNS/SSL setup.
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

    // Allow retry for failed/pending registration OR active domains missing Cloudflare
    const needsRegistration = domain.registrarStatus === "registration_failed" || domain.registrarStatus === "pending_registration";
    const needsCloudflare = !domain.cloudflareZoneId;

    if (!needsRegistration && !needsCloudflare) {
      return NextResponse.json({ error: "Domain is fully configured" }, { status: 400 });
    }

    let orderId = domain.registrarOrderId;
    let registrarStatus = domain.registrarStatus;

    // Step 1: OpenSRS registration (if needed)
    if (needsRegistration) {
      try {
        const { registerDomain } = await import("@/lib/domains/opensrs-client");
        const { nanoid } = await import("nanoid");

        const cleanId = nanoid(8).replace(/[^a-zA-Z0-9]/g, "");
        const cleanPw = nanoid(16).replace(/[^a-zA-Z0-9]/g, "");

        // Fetch user's Brand Identity for contact info
        const brandKit = await prisma.brandKit.findFirst({
          where: { userId: session.userId },
          select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, country: true },
        });

        const contact = brandKit?.name && brandKit?.email && brandKit?.phone && brandKit?.address
          ? {
              first_name: brandKit.name.split(/\s+/)[0] || "Domain",
              last_name: brandKit.name.split(/\s+/).slice(1).join(" ") || "Owner",
              org_name: brandKit.name,
              address1: brandKit.address,
              city: brandKit.city || "New York",
              state: brandKit.state || "NY",
              postal_code: brandKit.zip || "10001",
              country: brandKit.country?.length === 2 ? brandKit.country : "US",
              phone: brandKit.phone.startsWith("+") ? brandKit.phone : `+1.${brandKit.phone.replace(/\D/g, "")}`,
              email: brandKit.email,
            }
          : undefined;

        const result = await registerDomain({
          domain: domain.domainName,
          period: 1,
          regUsername: `fs${cleanId}`,
          regPassword: cleanPw,
          contact,
        });

        orderId = result.orderId;
        registrarStatus = "active";
      } catch (err: any) {
        await prisma.storeDomain.update({
          where: { id },
          data: { registrarStatus: "registration_failed" },
        });
        await notifyDomainRegistrationFailed(session.userId, domain.domainName, err.message);
        return NextResponse.json({ error: `Registration failed: ${err.message}` }, { status: 500 });
      }
    }

    // Step 2: Cloudflare zone + DNS + SSL (if needed)
    let cloudflareZoneId = domain.cloudflareZoneId;
    let nameservers = domain.nameservers;
    let dnsRecords = domain.dnsRecords;

    if (!cloudflareZoneId) {
      try {
        const zone = await createZone(domain.domainName);
        if (zone) {
          cloudflareZoneId = zone.zoneId;
          nameservers = JSON.stringify(zone.nameservers);

          // Configure DNS records
          try {
            const recordIds = await configureStoreDns(zone.zoneId, domain.domainName);
            if (recordIds) dnsRecords = JSON.stringify(recordIds);
          } catch (dnsErr) {
            console.error("DNS config failed (non-fatal):", dnsErr);
          }

          // Configure SSL/security
          try {
            await configureZoneSecurity(zone.zoneId);
          } catch (secErr) {
            console.error("Security config failed (non-fatal):", secErr);
          }
        }
      } catch (cfErr) {
        console.error("Cloudflare zone creation failed (non-fatal):", cfErr);
      }
    }

    // Step 3: Update domain record with all results
    await prisma.storeDomain.update({
      where: { id },
      data: {
        registrarStatus,
        registrarOrderId: orderId,
        cloudflareZoneId,
        nameservers,
        dnsRecords,
        sslStatus: cloudflareZoneId ? "pending" : domain.sslStatus,
        expiresAt: needsRegistration ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : domain.expiresAt,
      },
    });

    await notifyDomainRegistered(session.userId, domain.domainName);
    return NextResponse.json({
      success: true,
      message: cloudflareZoneId
        ? "Domain registered and DNS configured! SSL will be ready shortly."
        : "Domain registered! Cloudflare setup will be retried.",
    });
  } catch (err) {
    console.error("Domain retry error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
