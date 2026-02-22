import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Rate limiting map: IP -> formId -> timestamps
const rateLimitMap = new Map<string, Map<string, number[]>>();

function checkRateLimit(ip: string, formId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, new Map());
  }

  const formMap = rateLimitMap.get(ip)!;
  if (!formMap.has(formId)) {
    formMap.set(formId, []);
  }

  const timestamps = formMap.get(formId)!;
  // Remove old timestamps
  const recentTimestamps = timestamps.filter((t) => t > oneHourAgo);
  formMap.set(formId, recentTimestamps);

  if (recentTimestamps.length >= 5) {
    return false;
  }

  recentTimestamps.push(now);
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        description: true,
        fields: true,
        thankYouMessage: true,
        status: true,
        userId: true,
      },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This form is no longer accepting submissions" },
        { status: 410 }
      );
    }

    // Fetch brand kit
    let brandKit = await prisma.brandKit.findFirst({
      where: {
        userId: form.userId,
        isDefault: true,
      },
    });

    // If no default brand kit, try any brand kit
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({
        where: { userId: form.userId },
      });
    }

    const brand = brandKit
      ? {
          name: brandKit.name,
          logo: brandKit.logo,
          iconLogo: brandKit.iconLogo,
          colors: brandKit.colors ? JSON.parse(brandKit.colors) : null,
          fonts: brandKit.fonts ? JSON.parse(brandKit.fonts) : null,
          email: brandKit.email,
          phone: brandKit.phone,
          website: brandKit.website,
          address: brandKit.address,
        }
      : null;

    return NextResponse.json({
      title: form.title,
      description: form.description,
      fields: form.fields ? JSON.parse(form.fields) : [],
      thankYouMessage: form.thankYouMessage,
      brand,
    });
  } catch (error) {
    console.error("Error fetching public form:", error);
    return NextResponse.json(
      { error: "Failed to fetch form" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const form = await prisma.dataForm.findUnique({
      where: { slug },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This form is no longer accepting submissions" },
        { status: 410 }
      );
    }

    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip, form.id)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { data, respondentName, respondentEmail, respondentPhone } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Invalid submission data" },
        { status: 400 }
      );
    }

    // Parse form fields and validate required fields
    const fields = form.fields ? JSON.parse(form.fields) : [];
    for (const field of fields) {
      if (field.required) {
        const value = data[field.id];
        if (value === undefined || value === null || value === "") {
          return NextResponse.json(
            { error: `Field "${field.label}" is required` },
            { status: 400 }
          );
        }
      }
    }

    // Auto-extract respondent info from fields if not provided
    let finalRespondentName = respondentName;
    let finalRespondentEmail = respondentEmail;
    let finalRespondentPhone = respondentPhone;

    for (const field of fields) {
      const value = data[field.id];
      if (!value) continue;

      if (field.type === "email" && !finalRespondentEmail) {
        finalRespondentEmail = value;
      } else if (field.type === "phone" && !finalRespondentPhone) {
        finalRespondentPhone = value;
      } else if (
        field.type === "text" &&
        !finalRespondentName &&
        field.label.toLowerCase().includes("name")
      ) {
        finalRespondentName = value;
      }
    }

    // Create submission
    const submission = await prisma.dataFormSubmission.create({
      data: {
        formId: form.id,
        data: JSON.stringify(data),
        respondentName: finalRespondentName,
        respondentEmail: finalRespondentEmail,
        respondentPhone: finalRespondentPhone,
      },
    });

    // Increment response count
    await prisma.dataForm.update({
      where: { id: form.id },
      data: { responseCount: { increment: 1 } },
    });

    return NextResponse.json({ id: submission.id });
  } catch (error) {
    console.error("Error submitting form:", error);
    return NextResponse.json(
      { error: "Failed to submit form" },
      { status: 500 }
    );
  }
}
