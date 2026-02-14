import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/contacts - Get user's contacts
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const listId = searchParams.get("listId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";
    const validSorts = ["createdAt", "firstName", "lastName", "email", "status"];
    const sortField = validSorts.includes(sort) ? sort : "createdAt";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (listId) {
      where.lists = {
        some: { contactListId: listId },
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          lists: {
            include: {
              contactList: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    // Get stats
    const [totalContacts, activeContacts, unsubscribedContacts, emailOptedIn, smsOptedIn] = await Promise.all([
      prisma.contact.count({ where: { userId: session.userId } }),
      prisma.contact.count({ where: { userId: session.userId, status: "ACTIVE" } }),
      prisma.contact.count({ where: { userId: session.userId, status: "UNSUBSCRIBED" } }),
      prisma.contact.count({ where: { userId: session.userId, emailOptedIn: true } }),
      prisma.contact.count({ where: { userId: session.userId, smsOptedIn: true } }),
    ]);

    const formattedContacts = contacts.map(contact => ({
      id: contact.id,
      email: contact.email,
      phone: contact.phone,
      firstName: contact.firstName,
      lastName: contact.lastName,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || contact.phone,
      status: contact.status.toLowerCase(),
      emailOptedIn: contact.emailOptedIn,
      smsOptedIn: contact.smsOptedIn,
      birthday: contact.birthday || null,
      imageUrl: contact.imageUrl || null,
      tags: JSON.parse(contact.tags || "[]"),
      lists: contact.lists.map(l => l.contactList),
      createdAt: contact.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        contacts: formattedContacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          total: totalContacts,
          active: activeContacts,
          unsubscribed: unsubscribedContacts,
          emailOptedIn,
          smsOptedIn,
        },
      },
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch contacts" } },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, phone, firstName, lastName, birthday, imageUrl, tags = [], listIds = [], emailOptedIn, smsOptedIn } = body;

    // Validate birthday format if provided (MM-DD)
    if (birthday !== undefined && birthday !== null && birthday !== "") {
      const birthdayRegex = /^\d{2}-\d{2}$/;
      if (!birthdayRegex.test(birthday)) {
        return NextResponse.json(
          { success: false, error: { message: "Birthday must be in MM-DD format" } },
          { status: 400 }
        );
      }
      const [monthStr, dayStr] = birthday.split("-");
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return NextResponse.json(
          { success: false, error: { message: "Birthday must have a valid month (01-12) and day (01-31)" } },
          { status: 400 }
        );
      }
    }

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: { message: "Email or phone is required" } },
        { status: 400 }
      );
    }

    // Check for duplicates
    if (email) {
      const existingEmail = await prisma.contact.findUnique({
        where: { userId_email: { userId: session.userId, email } },
      });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: { message: "Contact with this email already exists" } },
          { status: 400 }
        );
      }
    }

    if (phone) {
      const existingPhone = await prisma.contact.findUnique({
        where: { userId_phone: { userId: session.userId, phone } },
      });
      if (existingPhone) {
        return NextResponse.json(
          { success: false, error: { message: "Contact with this phone already exists" } },
          { status: 400 }
        );
      }
    }

    const contact = await prisma.contact.create({
      data: {
        userId: session.userId,
        email,
        phone,
        firstName,
        lastName,
        birthday: birthday || null,
        imageUrl: imageUrl || null,
        tags: JSON.stringify(tags),
        emailOptedIn: emailOptedIn !== undefined ? emailOptedIn : !!email,
        emailOptedInAt: (emailOptedIn !== undefined ? emailOptedIn : !!email) ? new Date() : null,
        smsOptedIn: smsOptedIn !== undefined ? smsOptedIn : !!phone,
        smsOptedInAt: (smsOptedIn !== undefined ? smsOptedIn : !!phone) ? new Date() : null,
      },
    });

    // Add to lists if specified
    if (listIds.length > 0) {
      await prisma.contactListMember.createMany({
        data: listIds.map((listId: string) => ({
          contactId: contact.id,
          contactListId: listId,
        })),
      });

      // Update list counts
      await Promise.all(
        listIds.map((listId: string) =>
          prisma.contactList.update({
            where: { id: listId },
            data: {
              totalCount: { increment: 1 },
              activeCount: { increment: 1 },
            },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        contact: {
          id: contact.id,
          email: contact.email,
          phone: contact.phone,
          firstName: contact.firstName,
          lastName: contact.lastName,
          createdAt: contact.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create contact error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create contact" } },
      { status: 500 }
    );
  }
}
