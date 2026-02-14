import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications";

// GET /api/notifications/preferences - Get notification preferences
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const preferences = await getNotificationPreferences(session.userId);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get preferences" } },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/preferences - Update notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, push } = body;

    if (!email && !push) {
      return NextResponse.json(
        { success: false, error: { message: "No preferences provided" } },
        { status: 400 }
      );
    }

    const updated = await updateNotificationPreferences(session.userId, {
      email,
      push,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update preferences" } },
      { status: 500 }
    );
  }
}
