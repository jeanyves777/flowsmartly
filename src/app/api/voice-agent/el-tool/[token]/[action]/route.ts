/**
 * ElevenLabs webhook-tool executor.
 *
 * Each of an agent's skills is registered with ElevenLabs as a webhook tool
 * pointing here: `/api/voice-agent/el-tool/{token}/{action}`. When the agent
 * decides to act, EL POSTs the tool arguments; we run the same executor the xAI
 * MCP relay uses (`runMcpTool` → the real save_lead / place_order / … writes) and
 * return a short, speakable result for the agent to read back.
 *
 * The token identifies the tenant (VoiceAgent.mcpToken) — the same secret the MCP
 * relay uses — so nobody can spend a tenant's actions without it.
 */

import { NextRequest, NextResponse } from "next/server";

import { runMcpTool } from "@/lib/voice-agent/mcp-tools";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; action: string }> },
) {
  const { token, action } = await params;

  let args: Record<string, unknown> = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object") args = body as Record<string, unknown>;
  } catch {
    /* no/invalid body — treat as no args */
  }

  const caller = request.headers.get("x-caller-id") || "elevenlabs";
  const result = await runMcpTool(token, action, args, caller);

  // EL reads the returned JSON back to the agent; keep it short and speakable.
  if ("error" in result) {
    return NextResponse.json({ success: false, result: result.error });
  }
  return NextResponse.json({ success: true, result: result.text });
}
