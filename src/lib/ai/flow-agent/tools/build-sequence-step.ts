import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * build_sequence_step — write the copy for ONE step of the user's outreach
 * automation and deliver it INTO the builder card (never as a chat dump). The
 * agent composes the message itself (brand voice, personalized to the target
 * list's industry), then calls this with the list/sequence + stepId + subject +
 * body. It persists onto the OutreachSequence step and nudges the Lead studio to
 * reload, so the draft appears in the step's card in the playground.
 * [[lead-studio-redesign-approved]]
 */
export const buildSequenceStep: FlowAgentTool = {
  name: "build_sequence_step",
  description:
    "Write/draft the copy for ONE step of the user's outreach AUTOMATION and deliver it into the builder (the step's card), NOT as a chat message. Use whenever the user asks you to write or improve a step (initial pitch, a follow-up, the WhatsApp/SMS nudge, the booking ask). Compose the message yourself in the user's brand voice, personalized to the target list's industry/clients, then call this with the automation's `listId` (from the surface context) and the `stepId`, plus the `subject` (email only) + `body`. The draft then shows in the step card for the user to edit + approve. Do NOT paste the full email into the chat.",
  input_schema: {
    type: "object",
    properties: {
      listId: { type: "string", description: "The lead list the automation runs on (from the Lead studio surface context)." },
      sequenceId: { type: "string", description: "The sequence id, if known (alternative to listId)." },
      stepId: { type: "string", description: "The id of the step to write (from the surface context)." },
      subject: { type: "string", description: "Email subject line (omit for SMS/WhatsApp)." },
      body: { type: "string", description: "The message body you composed, in the user's brand voice, personalized to the audience." },
    },
    required: ["stepId", "body"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const stepId = typeof input.stepId === "string" ? input.stepId : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!stepId || !body) return { ok: false, error_code: "missing_input", message: "stepId and body are required." };

    const seq = typeof input.sequenceId === "string" && input.sequenceId
      ? await prisma.outreachSequence.findFirst({ where: { id: input.sequenceId, userId: ctx.userId } })
      : typeof input.listId === "string" && input.listId
        ? await prisma.outreachSequence.findFirst({ where: { userId: ctx.userId, listId: input.listId }, orderBy: { updatedAt: "desc" } })
        : null;
    if (!seq) return { ok: false, error_code: "not_found", message: "No automation found for that list yet — ask the user to open the list's automation first." };

    let steps: Record<string, unknown>[] = [];
    try { const p = JSON.parse(seq.steps || "[]"); if (Array.isArray(p)) steps = p; } catch { /* ignore */ }
    const idx = steps.findIndex((s) => s?.id === stepId);
    if (idx < 0) return { ok: false, error_code: "not_found", message: `Step "${stepId}" is not in this automation.` };

    steps[idx] = {
      ...steps[idx],
      subject: typeof input.subject === "string" ? input.subject.slice(0, 200) : steps[idx].subject,
      body: body.slice(0, 4000),
      status: "ready",
    };
    await prisma.outreachSequence.update({ where: { id: seq.id }, data: { steps: JSON.stringify(steps) } });
    ctx.emit({ type: "canvas_update", patch: { __leads: { sequenceStep: stepId } } });

    return {
      ok: true,
      data: { stepId, title: steps[idx].title, userMessage: `Wrote "${steps[idx].title as string}" into the automation builder — the user can review + edit it on the step card.` },
      resultRefType: "OutreachSequence",
      resultRefId: seq.id,
    };
  },
};
