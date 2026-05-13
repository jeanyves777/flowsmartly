import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getAutopilotState,
  handleAutopilotAction,
  updateAutopilotSettings,
} from "@/lib/listsmartly/autopilot-agent";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const state = await getAutopilotState(session.userId);
    if (!state) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("Get ListSmartly autopilot error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load autopilot" } },
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
    await updateAutopilotSettings(session.userId, {
      enabled: body.enabled,
      autoFix: body.autoFix,
      autoDescriptions: body.autoDescriptions,
      mode: body.mode,
    });

    const state = await getAutopilotState(session.userId);
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("Update ListSmartly autopilot error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update autopilot" } },
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
    const result = await handleAutopilotAction(session.userId, body.action, body);
    const state = await getAutopilotState(session.userId);

    return NextResponse.json({ success: true, data: { result, state } });
  } catch (error) {
    console.error("Run ListSmartly autopilot action error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to run autopilot action" } },
      { status: 500 }
    );
  }
}
