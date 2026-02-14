import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getNotifications,
  markAsRead,
  deleteNotifications,
  getUnreadCount,
} from "@/lib/notifications";

// GET /api/notifications - Get user's notifications
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
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const countOnly = searchParams.get("countOnly") === "true";

    // If only count is needed
    if (countOnly) {
      const unreadCount = await getUnreadCount(session.userId);
      return NextResponse.json({
        success: true,
        data: { unreadCount },
      });
    }

    const result = await getNotifications(session.userId, {
      limit,
      offset,
      unreadOnly,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get notifications" } },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark notifications as read
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
    const { notificationIds, markAll } = body;

    // Mark all or specific notifications as read
    if (markAll) {
      await markAsRead(session.userId);
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await markAsRead(session.userId, notificationIds);
    } else {
      return NextResponse.json(
        { success: false, error: { message: "notificationIds array or markAll flag required" } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Notifications marked as read" },
    });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to mark notifications as read" } },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: { message: "ids parameter required" } },
        { status: 400 }
      );
    }

    const notificationIds = idsParam.split(",").filter(Boolean);

    if (notificationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "At least one notification id required" } },
        { status: 400 }
      );
    }

    await deleteNotifications(session.userId, notificationIds);

    return NextResponse.json({
      success: true,
      data: { message: "Notifications deleted" },
    });
  } catch (error) {
    console.error("Delete notifications error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete notifications" } },
      { status: 500 }
    );
  }
}
