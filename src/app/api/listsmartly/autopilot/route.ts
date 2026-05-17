import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getListingOperationsState,
  handleListingOperationsAction,
  updateListingOperationsSettings,
} from "@/lib/listsmartly/operations";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const state = await getListingOperationsState(session.userId);
    if (!state) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("Get ListSmartly operations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load listing operations" } },
      { status: 500 }
    );
  }
}

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
    await updateListingOperationsSettings(session.userId, {
      enabled: body.enabled,
      autoFix: body.autoFix,
      autoDescriptions: body.autoDescriptions,
      mode: body.mode,
    });

    const state = await getListingOperationsState(session.userId);
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("Update ListSmartly operations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update listing operations" } },
      { status: 500 }
    );
  }
}

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
    const action = String(body.action || "");
    const result = await handleListingOperationsAction(session.userId, action, body);
    const state = await getListingOperationsState(session.userId);

    return NextResponse.json({ success: true, data: { result, state } });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: "This listing operation needs more credits before it can run.",
          },
        },
        { status: 402 }
      );
    }

    if (error instanceof Error && error.message === "TASK_ALREADY_CLAIMED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TASK_ALREADY_CLAIMED",
            message: "Another listing request already claimed that workflow. Refresh the page and try again.",
          },
        },
        { status: 409 }
      );
    }

    console.error("Run ListSmartly operations action error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to run listing operation" } },
      { status: 500 }
    );
  }
}
