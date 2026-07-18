/**
 * MCP relay endpoint — the brain a pooled console agent calls during a call.
 *
 * Streamable-HTTP MCP transport: JSON-RPC 2.0 over POST. The `[token]` in the
 * URL identifies the tenant, so one pool of identical console agents (each
 * configured with its own token URL as a custom MCP connector) serves
 * per-tenant behaviour — no per-agent config on xAI's side.
 *
 * Handles: initialize, notifications/initialized, tools/list, tools/call, ping.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { mcpToolsFor, runMcpTool } from "@/lib/voice-agent/mcp-tools";
import { type AgentSkill } from "@/lib/voice-agent/types";

const PROTOCOL_VERSION = "2025-06-18";

interface RpcReq {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const ok = (id: RpcReq["id"], result: unknown) =>
  NextResponse.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcReq["id"], code: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  let body: RpcReq;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  // The agent this token belongs to (skills drive the tool list).
  const agent = await prisma.voiceAgent.findFirst({
    where: { mcpToken: token },
    select: { id: true, skills: true, status: true },
  });
  if (!agent) return rpcError(body.id ?? null, -32001, "Unknown agent");

  switch (body.method) {
    case "initialize":
      return ok(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "flowsmartly-voice-agent", version: "1.0.0" },
      });

    // Notifications carry no id and expect no response body.
    case "notifications/initialized":
    case "notifications/cancelled":
      return new NextResponse(null, { status: 202 });

    case "ping":
      return ok(body.id, {});

    case "tools/list": {
      const skills = parseSkills(agent.skills);
      const tools = mcpToolsFor(skills).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return ok(body.id, { tools });
    }

    case "tools/call": {
      const name = String(body.params?.name || "");
      const args = (body.params?.arguments as Record<string, unknown>) || {};
      const from = String((body.params?.["_meta"] as { from?: string } | undefined)?.from || "unknown");

      const result = await runMcpTool(token, name, args, from);
      if ("error" in result) {
        // MCP tool errors are returned as a result with isError, not a protocol error.
        return ok(body.id, { content: [{ type: "text", text: result.error }], isError: true });
      }
      return ok(body.id, { content: [{ type: "text", text: result.text }] });
    }

    default:
      return rpcError(body.id ?? null, -32601, `Method not found: ${body.method}`);
  }
}

// Some MCP clients probe with GET (SSE). We don't stream, so advertise that.
export async function GET() {
  return new NextResponse("MCP endpoint — POST JSON-RPC", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

function parseSkills(raw: unknown): AgentSkill[] {
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as AgentSkill[]) : [];
  } catch {
    return [];
  }
}
