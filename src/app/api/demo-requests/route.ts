import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  companySize: z.string().trim().max(80).optional().or(z.literal("")),
  productInterest: z.array(z.string().trim().max(80)).max(8).default([]),
  preferredTime: z.string().trim().max(120).optional().or(z.literal("")),
  timezone: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(1200).optional().or(z.literal("")),
  source: z.string().trim().max(80).optional(),
});

function emptyToNull(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = demoRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Please check the highlighted fields and try again." } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const demoRequest = await prisma.demoRequest.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: emptyToNull(data.phone),
        company: emptyToNull(data.company),
        role: emptyToNull(data.role),
        companySize: emptyToNull(data.companySize),
        productInterest: JSON.stringify(data.productInterest),
        preferredTime: emptyToNull(data.preferredTime),
        timezone: emptyToNull(data.timezone),
        message: emptyToNull(data.message),
        source: data.source || "public-book-demo",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: demoRequest.id },
    });
  } catch (error) {
    console.error("Create demo request error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Unable to submit your request right now." } },
      { status: 500 }
    );
  }
}
