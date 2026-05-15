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

    const birthdayWhere: Record<string, unknown> = {
      ...baseWhere,
      birthday: { not: null },
      NOT: { birthday: "" },
    };

    const validBirthdayEmailWhere: Record<string, unknown> = {
      ...baseWhere,
      birthday: { not: null },
      emailOptedIn: true,
      email: { contains: "@" },
      NOT: { birthday: "" },
    };

    const validBirthdayEmailWithImageWhere: Record<string, unknown> = {
      ...baseWhere,
      birthday: { not: null },
      emailOptedIn: true,
      email: { contains: "@" },
      imageUrl: { not: null },
      NOT: [{ birthday: "" }, { imageUrl: "" }],
    };

    const [withBirthday, withBirthdayAndValidEmail, withBirthdayAndImage, total] = await Promise.all([
      prisma.contact.count({
        where: birthdayWhere,
      }),
      prisma.contact.count({
        where: validBirthdayEmailWhere,
      }),
      prisma.contact.count({
        where: validBirthdayEmailWithImageWhere,
      }),
      prisma.contact.count({ where: baseWhere }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        withBirthday,
        withBirthdayAndValidEmail,
        withBirthdayMissingValidEmail: Math.max(0, withBirthday - withBirthdayAndValidEmail),
        withBirthdayAndImage,
        eligibleBirthdayContacts: withBirthdayAndValidEmail,
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
