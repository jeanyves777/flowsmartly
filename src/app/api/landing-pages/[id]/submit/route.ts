import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { headers } from "next/headers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Find the landing page - must be PUBLISHED
    const landingPage = await prisma.landingPage.findFirst({
      where: { id, status: "PUBLISHED" },
      select: { id: true, userId: true, pageType: true, title: true, slug: true },
    });

    if (!landingPage) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 }
      );
    }

    // 2. Parse form data
    const body = await request.json();
    const { email, firstName, lastName, phone, company, message, ...customData } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 3. Dedup: check if same email submitted to same page in last 60 seconds
    const recentSubmission = await prisma.formSubmission.findFirst({
      where: {
        landingPageId: id,
        data: { contains: trimmedEmail },
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    if (recentSubmission) {
      return NextResponse.json({ success: true, message: "Thank you for your submission!" });
    }

    // 4. Get request metadata for analytics
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";
    const referer = headersList.get("referer") || "";

    // Extract UTM params from referer or from body
    const utmSource = body.utm_source || "";
    const utmMedium = body.utm_medium || "";
    const utmCampaign = body.utm_campaign || "";

    // 5. Create FormSubmission record
    const submissionData = {
      email: trimmedEmail,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      message: message?.trim() || null,
      ...customData,
      _meta: {
        referer,
        utmSource,
        utmMedium,
        utmCampaign,
        submittedAt: new Date().toISOString(),
      },
    };

    // 6. Upsert Contact under the landing page owner's userId
    let contactId: string | null = null;
    try {
      // Try to find existing contact
      const existingContact = await prisma.contact.findFirst({
        where: { userId: landingPage.userId, email: trimmedEmail },
      });

      if (existingContact) {
        // Update: merge new fields (don't overwrite existing non-null values)
        const existingTags: string[] = JSON.parse(existingContact.tags || "[]");
        const existingCustomFields = JSON.parse(existingContact.customFields || "{}");

        const newTags = [...new Set([...existingTags, "landing-page-lead", `lp-${landingPage.pageType}`])];
        const newCustomFields = {
          ...existingCustomFields,
          lastLandingPage: landingPage.title,
          lastLandingPageId: landingPage.id,
          lastSubmissionAt: new Date().toISOString(),
          ...(utmSource && { lastUtmSource: utmSource }),
          ...(utmMedium && { lastUtmMedium: utmMedium }),
          ...(utmCampaign && { lastUtmCampaign: utmCampaign }),
        };

        const contact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            firstName: existingContact.firstName || firstName?.trim() || null,
            lastName: existingContact.lastName || lastName?.trim() || null,
            phone: existingContact.phone || phone?.trim() || null,
            company: existingContact.company || company?.trim() || null,
            tags: JSON.stringify(newTags),
            customFields: JSON.stringify(newCustomFields),
            emailOptedIn: true,
            emailOptedInAt: existingContact.emailOptedInAt || new Date(),
          },
        });
        contactId = contact.id;
      } else {
        // Create new contact
        const tags = ["landing-page-lead", `lp-${landingPage.pageType}`];
        const customFields = {
          source: "landing-page",
          landingPageId: landingPage.id,
          landingPageTitle: landingPage.title,
          landingPageSlug: landingPage.slug,
          ...(utmSource && { utmSource }),
          ...(utmMedium && { utmMedium }),
          ...(utmCampaign && { utmCampaign }),
        };

        const contact = await prisma.contact.create({
          data: {
            userId: landingPage.userId,
            email: trimmedEmail,
            firstName: firstName?.trim() || null,
            lastName: lastName?.trim() || null,
            phone: phone?.trim() || null,
            company: company?.trim() || null,
            tags: JSON.stringify(tags),
            customFields: JSON.stringify(customFields),
            emailOptedIn: true,
            emailOptedInAt: new Date(),
            status: "ACTIVE",
          },
        });
        contactId = contact.id;
      }
    } catch (contactError) {
      // If contact upsert fails (e.g. unique constraint), log but don't fail the submission
      console.error("Contact upsert error:", contactError);
    }

    // 7. Save form submission
    await prisma.formSubmission.create({
      data: {
        landingPageId: id,
        contactId,
        data: JSON.stringify(submissionData),
        source: "landing-page",
        ipAddress: typeof ipAddress === "string" ? ipAddress.split(",")[0].trim() : "unknown",
        userAgent: userAgent.substring(0, 500),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your submission!",
    });
  } catch (error) {
    console.error("Form submission error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process submission" },
      { status: 500 }
    );
  }
}
