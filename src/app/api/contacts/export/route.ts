import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

function escapeCSV(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/contacts/export - Export contacts as CSV download
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

    // Build where clause (same logic as GET /api/contacts)
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

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lists: {
          include: {
            contactList: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Build CSV
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Company",
      "Birthday",
      "City",
      "State",
      "Address",
      "Status",
      "Email Opted In",
      "SMS Opted In",
      "Tags",
      "Lists",
    ];

    const rows: string[] = [headers.map(escapeCSV).join(",")];

    for (const contact of contacts) {
      let tags: string[] = [];
      try {
        tags = JSON.parse(contact.tags || "[]");
      } catch {
        tags = [];
      }

      const listNames = contact.lists
        .map((l) => l.contactList.name)
        .join("; ");

      const row = [
        escapeCSV(contact.firstName),
        escapeCSV(contact.lastName),
        escapeCSV(contact.email),
        escapeCSV(contact.phone),
        escapeCSV(contact.company),
        escapeCSV(contact.birthday),
        escapeCSV(contact.city),
        escapeCSV(contact.state),
        escapeCSV(contact.address),
        escapeCSV(contact.status),
        contact.emailOptedIn ? "Yes" : "No",
        contact.smsOptedIn ? "Yes" : "No",
        escapeCSV(tags.join("; ")),
        escapeCSV(listNames),
      ];

      rows.push(row.join(","));
    }

    const csv = rows.join("\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=contacts-${timestamp}.csv`,
      },
    });
  } catch (error) {
    console.error("Export contacts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to export contacts" } },
      { status: 500 }
    );
  }
}
