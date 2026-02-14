import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/contacts/birthday-stats?listId=optional — Count contacts with/without birthday
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const listId = request.nextUrl.searchParams.get("listId");

    const baseWhere: Record<string, unknown> = {
      userId: session.userId,
      status: "ACTIVE",
    };

    if (listId) {
      baseWhere.lists = { some: { contactListId: listId } };
    }

    const [withBirthday, total] = await Promise.all([
      prisma.contact.count({
        where: {
          ...baseWhere,
          birthday: { not: null },
          NOT: { birthday: "" },
        },
      }),
      prisma.contact.count({ where: baseWhere }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        withBirthday,
        withoutBirthday: total - withBirthday,
        total,
      },
    });
  } catch (error) {
    console.error("Birthday stats error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch birthday stats" } },
      { status: 500 }
    );
  }
}
