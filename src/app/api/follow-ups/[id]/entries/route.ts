import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/follow-ups/[id]/entries — List entries for a follow-up
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership first
    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, settings: true },
    });

    // If not the owner, check if user is an assignee on any entry in this follow-up
    let isOwner = !!followUp;
    let restrictToAssigned = false;

    if (!followUp) {
      const hasAssignment = await prisma.followUpEntry.findFirst({
        where: { followUpId: id, assigneeId: session.userId },
        select: { id: true },
      });
      if (!hasAssignment) {
        return NextResponse.json(
          { success: false, error: { message: "Follow-up not found" } },
          { status: 404 }
        );
      }
      // Get settings from the follow-up
      const fu = await prisma.followUp.findUnique({
        where: { id },
        select: { settings: true },
      });
      const settings = JSON.parse(fu?.settings || "{}");
      restrictToAssigned = settings.restrictToAssigned === true;
    } else {
      const settings = JSON.parse(followUp.settings || "{}");
      restrictToAssigned = settings.restrictToAssigned === true;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";

    const alreadyFilteredToAssigned = !isOwner && restrictToAssigned;

    // Build base filter conditions as an array (avoids OR key conflicts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseConditions: any[] = [{ followUpId: id }];
    if (alreadyFilteredToAssigned) {
      baseConditions.push({ assigneeId: session.userId });
    }
    if (status) baseConditions.push({ status });
    if (search) {
      baseConditions.push({
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { notes: { contains: search } },
        ],
      });
    }

    const orderBy = [
      { nextFollowUp: "asc" as const },
      { createdAt: "desc" as const },
    ];
    const include = {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          imageUrl: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    };
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entries: any[] = [];
    let total = 0;

    if (alreadyFilteredToAssigned) {
      // All visible entries are assigned to user — simple query
      const where = baseConditions.length === 1 ? baseConditions[0] : { AND: baseConditions };
      const [data, count] = await Promise.all([
        prisma.followUpEntry.findMany({ where, orderBy, skip, take: limit, include }),
        prisma.followUpEntry.count({ where }),
      ]);
      entries = data;
      total = count;
    } else {
      // Two-pass: user's assigned entries first, then others (with proper pagination)
      const assignedWhere = { AND: [...baseConditions, { assigneeId: session.userId }] };
      const otherWhere = {
        AND: [
          ...baseConditions,
          { OR: [{ assigneeId: null }, { assigneeId: { not: session.userId } }] },
        ],
      };

      const [assignedTotal, otherTotal] = await Promise.all([
        prisma.followUpEntry.count({ where: assignedWhere }),
        prisma.followUpEntry.count({ where: otherWhere }),
      ]);

      total = assignedTotal + otherTotal;

      if (skip < assignedTotal) {
        // Page still has some assigned entries
        const assignedTake = Math.min(limit, assignedTotal - skip);
        const otherTake = limit - assignedTake;

        const [assigned, others] = await Promise.all([
          prisma.followUpEntry.findMany({
            where: assignedWhere, orderBy, skip, take: assignedTake, include,
          }),
          otherTake > 0
            ? prisma.followUpEntry.findMany({
                where: otherWhere, orderBy, skip: 0, take: otherTake, include,
              })
            : Promise.resolve([]),
        ]);
        entries = [...assigned, ...others];
      } else {
        // All assigned entries shown on previous pages
        const otherSkip = skip - assignedTotal;
        entries = await prisma.followUpEntry.findMany({
          where: otherWhere, orderBy, skip: otherSkip, take: limit, include,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: entries.map((e) => ({
        ...e,
        customData: JSON.parse(e.customData || "{}"),
      })),
      meta: { isOwner, currentUserId: session.userId },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List entries error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch entries" } },
      { status: 500 }
    );
  }
}

// POST /api/follow-ups/[id]/entries — Create new entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contactId, assigneeId, name, phone, email, address, referralSource, notes, status, nextFollowUp } = body;

    // Need at least a name, email, or phone
    if (!contactId && !name && !email && !phone) {
      return NextResponse.json(
        { success: false, error: { message: "At least a name, email, or phone is required" } },
        { status: 400 }
      );
    }

    // Verify contact ownership if provided
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, userId: session.userId },
      });
      if (!contact) {
        return NextResponse.json(
          { success: false, error: { message: "Contact not found" } },
          { status: 404 }
        );
      }
    }

    const entry = await prisma.followUpEntry.create({
      data: {
        followUpId: id,
        contactId: contactId || null,
        assigneeId: assigneeId || null,
        name: name?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        referralSource: referralSource?.trim() || null,
        notes: notes?.trim() || null,
        status: status || "PENDING",
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
      },
    });

    // Update counter
    await prisma.followUp.update({
      where: { id },
      data: { totalEntries: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("Create entry error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create entry" } },
      { status: 500 }
    );
  }
}
