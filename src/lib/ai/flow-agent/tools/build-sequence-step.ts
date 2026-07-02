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
    "Write/draft the copy for ONE step of the user's outreach AUTOMATION and deliver it into the builder (the step's card), NOT as a chat message. Use whenever the user asks you to write or improve a step (initial pitch, a follow-up, the WhatsApp/SMS nudge, the booking ask). Compose the message yourself in the user's brand voice, personalized to the target list's industry/clients, then call this with the automation's `listId` (from the surface context) and the `stepId`, plus the `subject` (email only) + `body`. ALSO use this to ATTACH a branded pitch PDF to an email step: after create_pitch returns a pitchId, call this with the stepId + that `pitchId` so the pitch lands on the step's card (the user can then edit/download it there). The draft/pitch then shows in the step card for the user to edit + approve. Do NOT paste the full email or pitch into the chat.",
  input_schema: {
    type: "object",
    properties: {
      listId: { type: "string", description: "The lead list the automation runs on (from the Lead studio surface context)." },
      sequenceId: { type: "string", description: "The sequence id, if known (alternative to listId)." },
      stepId: { type: "string", description: "The id of the step to write (from the surface context)." },
      subject: { type: "string", description: "Email subject line (omit for SMS/WhatsApp)." },
      body: { type: "string", description: "The message body you composed, in the user's brand voice, personalized to the audience. Omit if you're only attaching a pitch." },
      pitchId: { type: "string", description: "Id of a Pitch (from create_pitch) to ATTACH to this email step so the user can edit/download the PDF on the card." },
    },
    required: ["stepId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const stepId = typeof input.stepId === "string" ? input.stepId : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    if (!stepId) return { ok: false, error_code: "missing_input", message: "stepId is required." };
    if (!body && !pitchId) return { ok: false, error_code: "missing_input", message: "Provide the body (the copy you wrote) and/or a pitchId to attach." };

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

    // If a pitchId was given, verify it belongs to the user before attaching.
    if (pitchId) {
      const owned = await prisma.pitch.findFirst({ where: { id: pitchId, userId: ctx.userId }, select: { id: true } });
      if (!owned) return { ok: false, error_code: "not_found", message: `Pitch "${pitchId}" was not found — create it with create_pitch first, then attach its pitchId.` };
    }

    steps[idx] = {
      ...steps[idx],
      ...(typeof input.subject === "string" ? { subject: input.subject.slice(0, 200) } : {}),
      ...(body ? { body: body.slice(0, 4000), status: "ready" } : {}),
      ...(pitchId ? { pitchId } : {}),
    };
    await prisma.outreachSequence.update({ where: { id: seq.id }, data: { steps: JSON.stringify(steps) } });
    ctx.emit({ type: "canvas_update", patch: { __leads: { sequenceStep: stepId } } });

    const what = body && pitchId ? "wrote the copy and attached the pitch PDF to" : pitchId ? "attached the pitch PDF to" : "wrote";
    return {
      ok: true,
      data: { stepId, title: steps[idx].title, userMessage: `${what[0].toUpperCase()}${what.slice(1)} "${steps[idx].title as string}" in the automation builder — the user can review, edit + download it on the step card.` },
      resultRefType: "OutreachSequence",
      resultRefId: seq.id,
    };
  },
};
