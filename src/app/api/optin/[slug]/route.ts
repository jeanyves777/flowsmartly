import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { formatPhoneNumber, isValidPhoneNumber } from "@/lib/telnyx/sms";

/**
 * Public SMS opt-in page API. GET returns the business identity for the hosted
 * opt-in form at /optin/<slug>; POST records an affirmative, checkbox-based SMS
 * consent by upserting a Contact with smsOptedIn=true. This is the documented
 * opt-in the carriers (A2P 10DLC) require — and real consent for sending.
 */

const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 60 * 60 * 1000) { hits.set(ip, { n: 1, t: now }); return false; }
  e.n += 1;
  return e.n > 30; // 30 submissions/hour/IP
}

async function businessFor(slug: string) {
  const cfg = await prisma.marketingConfig.findFirst({
    where: { optInSlug: slug },
    select: { userId: true, businessName: true, businessWebsite: true, privacyPolicyUrl: true, termsOfServiceUrl: true, optOutMessage: true },
  });
  if (!cfg) return null;
  const brand = await prisma.brandKit.findFirst({
    where: { userId: cfg.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { name: true, logo: true, iconLogo: true, colors: true },
  }).catch(() => null);
  const businessName = cfg.businessName || brand?.name || "Our business";
  let accent = "#2563eb";
  try { const c = JSON.parse(brand?.colors || "{}"); if (typeof c.primary === "string") accent = c.primary; } catch { /* ignore */ }
  return {
    userId: cfg.userId,
    businessName,
    website: cfg.businessWebsite || null,
    privacyPolicyUrl: cfg.privacyPolicyUrl || null,
    termsOfServiceUrl: cfg.termsOfServiceUrl || null,
    optOutMessage: cfg.optOutMessage || "Reply STOP to unsubscribe",
    logo: brand?.iconLogo || brand?.logo || null,
    accent,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await businessFor(slug);
  if (!b) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const { userId: _userId, ...pub } = b;
  return NextResponse.json({ success: true, data: pub });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ success: false, error: { message: "Too many requests — try again later." } }, { status: 429 });

  const b = await businessFor(slug);
  if (!b) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (!body?.consent) return NextResponse.json({ success: false, error: { message: "Please check the consent box to opt in." } }, { status: 400 });

  const raw = String(body.phone || "").trim();
  const phone = formatPhoneNumber(raw);
  if (!raw || !isValidPhoneNumber(phone)) {
    return NextResponse.json({ success: false, error: { message: "Enter a valid phone number." } }, { status: 400 });
  }
  const firstName = typeof body.firstName === "string" && body.firstName.trim() ? body.firstName.trim().slice(0, 60) : null;

  try {
    await prisma.contact.upsert({
      where: { userId_phone: { userId: b.userId, phone } },
      update: { smsOptedIn: true, smsOptedInAt: new Date(), ...(firstName ? { firstName } : {}) },
      create: { userId: b.userId, phone, firstName, smsOptedIn: true, smsOptedInAt: new Date(), status: "ACTIVE", tags: JSON.stringify(["sms-optin"]) },
    });
    return NextResponse.json({ success: true, data: { businessName: b.businessName } });
  } catch (e) {
    console.error("[optin] submit failed:", e);
    return NextResponse.json({ success: false, error: { message: "Could not record your opt-in. Please try again." } }, { status: 500 });
  }
}
