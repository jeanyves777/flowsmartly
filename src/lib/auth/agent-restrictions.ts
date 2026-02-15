import { NextResponse } from "next/server";
import type { Session } from "./session";

/**
 * Check if the current session is an agent impersonation session
 */
export function isAgentRestricted(session: Session): boolean {
  return !!session.agentId;
}

/**
 * Returns a 403 response if the session is an agent impersonation session.
 * Use at the top of API routes that agents should NOT be able to access.
 */
export function agentRestrictionGuard(session: Session): NextResponse | null {
  if (session.agentId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AGENT_RESTRICTED",
          message: "This action is restricted in agent mode. Financial and security operations cannot be performed while managing a client account.",
        },
      },
      { status: 403 }
    );
  }
  return null;
}
