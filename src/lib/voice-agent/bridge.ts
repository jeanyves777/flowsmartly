/**
 * The live-call bridge.
 *
 * xAI terminates the SIP leg and bridges the caller's audio itself, so this
 * doesn't proxy audio — it holds the control socket for the call: it configures
 * the session from OUR agent row, answers, runs the tool loop, meters by the
 * minute, and writes the call to the back office.
 *
 * The app runs as a long-lived `next start` process (not serverless), so the
 * webhook can `void runCall(...)` and this keeps running after the HTTP
 * response returns, for the whole call. A deploy/reload ends in-flight calls —
 * acceptable for now; a dedicated sidecar is the scale answer.
 */

// Node 22+ ships a global WebSocket, so no `ws` package (and no @types/ws churn on
// the shared lockfile). It's the WHATWG API — addEventListener + ev.data, NOT the
// ws package's .on(msg)/raw. Getting that wrong = a socket that connects then goes
// deaf, so this type pins the browser shape.
type WsLike = {
  send: (d: string) => void;
  close: () => void;
  addEventListener: (ev: string, cb: (e: never) => void) => void;
};

/** The global WS delivers a MessageEvent in Node; strings/Buffers elsewhere. */
function msgText(raw: unknown): string {
  const d = (raw && typeof raw === "object" && "data" in raw) ? (raw as { data: unknown }).data : raw;
  if (typeof d === "string") return d;
  if (d && typeof (d as { toString?: () => string }).toString === "function") return String(d);
  return "";
}

import { getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { prisma } from "@/lib/db/client";
import { executeTool, type ToolContext } from "@/lib/voice-agent/call-tools";
import { buildSessionUpdate, type AgentForSession } from "@/lib/voice-agent/session-config";
import { realtimeCallUrl, hangupCall } from "@/lib/voice-agent/xai-phone";

interface StartCall {
  callId: string;
  agentId: string;
  userId: string;
  fromE164: string;
  toE164: string;
}

interface TurnLog {
  role: "agent" | "caller";
  at: number;
  text: string;
}

/** Parse a stored agent row into the structural shape the builders want. */
function toSessionAgent(row: Record<string, unknown>): AgentForSession {
  const j = <T,>(v: unknown, f: T): T => {
    try {
      return typeof v === "string" ? (JSON.parse(v) as T) : f;
    } catch {
      return f;
    }
  };
  return {
    name: String(row.name || "the business"),
    business: String(row.business || ""),
    greeting: String(row.greeting || ""),
    knowledge: j(row.knowledge, []),
    voiceId: String(row.voiceId || "eve"),
    speakingSpeed: Number(row.speakingSpeed ?? 1),
    languageHint: String(row.languageHint || "auto"),
    keyterms: j(row.keyterms, []),
    pronunciations: j(row.pronunciations, {}),
    reasoningEffort: String(row.reasoningEffort || "high"),
    allowInterrupt: Boolean(row.allowInterrupt ?? true),
    idleTimeoutMs: Number(row.idleTimeoutMs ?? 0),
    vadThreshold: Number(row.vadThreshold ?? 0.85),
    vadSilenceMs: Number(row.vadSilenceMs ?? 500),
    escalateTo: (row.escalateTo as string) || null,
    escalateOnUpset: Boolean(row.escalateOnUpset ?? true),
    escalateOnUnsure: Boolean(row.escalateOnUnsure ?? true),
    escalateOnAsk: Boolean(row.escalateOnAsk ?? true),
    noAnswerAction: String(row.noAnswerAction || "message"),
    discloseAi: Boolean(row.discloseAi ?? true),
    announceRecording: Boolean(row.announceRecording ?? true),
    recordCalls: Boolean(row.recordCalls ?? true),
    answerMode: String(row.answerMode || "always"),
    hours: j(row.hours, {}),
    timezone: String(row.timezone || "UTC"),
    skills: j(row.skills, []),
    orderConfig: j(row.orderConfig, { menuSource: "manual", items: [] }),
  } as unknown as AgentForSession;
}

/**
 * Run a call end to end. Returns when the call closes. Errors are swallowed into
 * the call log rather than thrown — a bridge crash must never take the server
 * with it.
 */
export async function runCall(call: StartCall): Promise<void> {
  const started = Date.now();
  const perMinute = await getDynamicCreditCost("VOICE_AGENT_MINUTE").catch(() => 9);

  const agentRow = await prisma.voiceAgent.findUnique({ where: { id: call.agentId } });
  if (!agentRow) {
    console.error("[bridge] no agent for call", call.agentId);
    return;
  }
  const agent = toSessionAgent(agentRow as unknown as Record<string, unknown>);

  // Spend cap: how much room is left this period.
  const capLeft = Math.max(0, (agentRow.spendCapCredits ?? 5000) - (agentRow.spentThisPeriod ?? 0));

  // Open the call row immediately so a dropped connection still leaves a record.
  const callRow = await prisma.voiceCall.create({
    data: {
      userId: call.userId,
      agentId: call.agentId,
      phoneNumberId: agentRow.phoneNumberId,
      twilioCallSid: call.callId, // reused column: the provider call id
      direction: "inbound",
      fromE164: call.fromE164,
      toE164: call.toE164,
      status: "in-progress",
    },
    select: { id: true },
  });

  const transcript: TurnLog[] = [];
  let charged = 0;
  let lastBilledMinute = 0;
  const result: { outcome?: string; detail?: string; linkedType?: string; linkedId?: string } = {};
  let closed = false;

  // undici's WebSocket (Node global) accepts headers via the options bag.
  const ws = new WebSocket(realtimeCallUrl(call.callId), {
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
  } as unknown as string[]) as unknown as WsLike;

  const toolCtx = (): ToolContext => ({
    userId: call.userId,
    agentId: call.agentId,
    callId: call.callId,
    callDbId: callRow.id,
    fromE164: call.fromE164,
    escalateTo: agent.escalateTo,
    orderConfig: agent.orderConfig,
  });

  const secs = () => Math.round((Date.now() - started) / 1000);

  // Per-minute metering. Charge each STARTED minute so a dropped call can't run
  // up an unbilled tab, and stop the call the moment the cap is hit.
  const meter = setInterval(async () => {
    const minute = Math.floor(secs() / 60) + 1; // minute 1 from t=0
    if (minute <= lastBilledMinute) return;
    lastBilledMinute = minute;
    const wouldBe = charged + perMinute;
    if (wouldBe > capLeft) {
      // Out of budget — say goodbye and end.
      say(ws, "I'm sorry, I have to go now. Please call back soon. Goodbye.");
      setTimeout(() => endCall(), 2500);
      return;
    }
    try {
      const r = await creditService.deductCredits({
        userId: call.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: perMinute,
        description: `Voice call minute ${minute}`,
        referenceType: "voice_call",
        referenceId: callRow.id,
      });
      if (r.success) {
        charged = wouldBe;
        await prisma.voiceAgent.update({
          where: { id: call.agentId },
          data: { spentThisPeriod: { increment: perMinute } },
        }).catch(() => {});
      }
    } catch {
      /* a metering blip must not drop the call */
    }
  }, 15000);

  function endCall() {
    if (closed) return;
    hangupCall(call.callId).catch(() => {});
    try {
      ws.close();
    } catch {
      /* already closing */
    }
  }

  await new Promise<void>((resolve) => {
    const finish = async () => {
      if (closed) return;
      closed = true;
      clearInterval(meter);
      const duration = secs();
      await prisma.voiceCall.update({
        where: { id: callRow.id },
        data: {
          status: "completed",
          endedAt: new Date(),
          durationSec: duration,
          creditsCharged: charged,
          transcript: JSON.stringify(transcript),
          outcome: result.outcome || "answered",
          outcomeDetail: result.detail || null,
          linkedType: result.linkedType || null,
          linkedId: result.linkedId || null,
        },
      }).catch((e) => console.error("[bridge] finalize failed:", e));
      resolve();
    };

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(buildSessionUpdate(agent)));
    });

    ws.addEventListener("message", async (ev: { data: unknown }) => {
      let m: { type?: string; [k: string]: unknown };
      try {
        m = JSON.parse(msgText(ev.data));
      } catch {
        return;
      }

      switch (m.type) {
        case "session.updated":
          // Configured — greet the caller.
          if (agent.greeting) {
            ws.send(JSON.stringify({
              type: "conversation.item.create",
              item: { type: "message", role: "assistant", content: [{ type: "text", text: agent.greeting }] },
            }));
          }
          ws.send(JSON.stringify({ type: "response.create" }));
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (typeof m.transcript === "string" && m.transcript.trim()) {
            transcript.push({ role: "caller", at: secs(), text: m.transcript.trim() });
          }
          break;

        case "response.output_audio_transcript.done":
          if (typeof m.transcript === "string" && m.transcript.trim()) {
            transcript.push({ role: "agent", at: secs(), text: m.transcript.trim() });
          }
          break;

        case "response.function_call_arguments.done": {
          const name = String(m.name || "");
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(String(m.arguments || "{}"));
          } catch {
            /* keep empty */
          }
          let tr;
          try {
            tr = await executeTool(name, args, toolCtx());
          } catch (e) {
            console.error("[bridge] tool failed:", name, e);
            tr = { output: { ok: false, error: "That didn't go through." } };
          }
          if (tr.outcome) result.outcome = tr.outcome;
          if (tr.outcomeDetail) result.detail = tr.outcomeDetail;
          if (tr.linkedType) result.linkedType = tr.linkedType;
          if (tr.linkedId) result.linkedId = tr.linkedId;

          ws.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: m.call_id, output: JSON.stringify(tr.output) },
          }));
          if (tr.hangup) {
            setTimeout(() => endCall(), 1500);
          } else {
            ws.send(JSON.stringify({ type: "response.create" }));
          }
          break;
        }

        case "error":
          console.error("[bridge] realtime error:", JSON.stringify(m).slice(0, 200));
          break;
      }
    });

    ws.addEventListener("close", () => void finish());
    ws.addEventListener("error", (e: unknown) => {
      console.error("[bridge] ws error:", String((e as { message?: string })?.message || e));
      void finish();
    });

    // Hard cap so a hung socket can't run forever (and can't over-bill).
    setTimeout(() => endCall(), 20 * 60 * 1000);
  });
}

/** Speak a line immediately (used for the budget-cutoff goodbye). */
function say(ws: WsLike, text: string) {
  try {
    ws.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "message", role: "assistant", content: [{ type: "text", text }] },
    }));
    ws.send(JSON.stringify({ type: "response.create" }));
  } catch {
    /* socket already gone */
  }
}
