import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, submissionIds } = body;

    // Verify DataForm ownership
    const dataForm = await prisma.dataForm.findUnique({
      where: { id },
      include: {
        submissions: submissionIds
          ? { where: { id: { in: submissionIds } } }
          : true,
      },
    });

    if (!dataForm) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (dataForm.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get submissions (all or filtered)
    const submissions = dataForm.submissions;

    if (submissions.length === 0) {
      return NextResponse.json(
        { error: "No submissions to create follow-up from" },
        { status: 400 }
      );
    }

    // Create the FollowUp
    const followUp = await prisma.followUp.create({
      data: {
        name: name || `${dataForm.title} Follow-Up`,
        userId: session.userId,
        type: "TRACKER",
        status: "ACTIVE",
        totalEntries: 0,
      },
    });

    // Create FollowUpEntry for each submission
    const entries = await Promise.all(
      submissions.map(async (submission) => {
        // Extract contact info from submission data
        const data = JSON.parse(submission.data || "{}") as Record<string, string>;

        // Try to find name, email, phone, address from data
        let entryName = submission.respondentName;
        let email = submission.respondentEmail;
        let phone = submission.respondentPhone;
        let address: string | undefined;

        // Parse form fields to find matching values
        if (data) {
          // Look for common field names
          for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();

            if (!entryName && (lowerKey.includes("name") && !lowerKey.includes("email"))) {
              entryName = String(value || "");
            }

            if (!email && lowerKey.includes("email")) {
              email = String(value || "");
            }

            if (!phone && (lowerKey.includes("phone") || lowerKey.includes("mobile"))) {
              phone = String(value || "");
            }

            if (!address && lowerKey.includes("address")) {
              address = String(value || "");
            }
          }
        }

        return prisma.followUpEntry.create({
          data: {
            followUpId: followUp.id,
            name: entryName || "Unknown",
            email: email || undefined,
            phone: phone || undefined,
            address: address || undefined,
            status: "PENDING",
          },
        });
      })
    );

    // Update FollowUp totalEntries count
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: { totalEntries: entries.length },
    });

    return NextResponse.json({
      followUpId: followUp.id,
      entriesCreated: entries.length,
    });
  } catch (error) {
    console.error("Error creating follow-up:", error);
    return NextResponse.json(
      { error: "Failed to create follow-up" },
      { status: 500 }
    );
  }
}
