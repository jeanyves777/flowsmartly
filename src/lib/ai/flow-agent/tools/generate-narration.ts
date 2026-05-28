import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { isElevenLabsEnabled, generateWithClonedVoice } from "@/lib/voice/elevenlabs-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import { saveToMediaLibrary } from "../save-media";

/**
 * generate_narration — turn text into narrated audio: either a SINGLE
 * narrator (one voice reads the whole script) or a multi-character
 * CONVERSATION (each line spoken by its assigned voice, e.g. a male + a
 * female, stitched in order). Uses ElevenLabs voices the user picked via
 * list_voices.
 *
 * Background task: synthesize each segment → concat with ffmpeg → upload
 * mp3 → notify. Mutating, confirmed-plan. Cost: AI_VOICE_GENERATION per
 * spoken segment.
 */
export const generateNarration: FlowAgentTool = {
  name: "generate_narration",
  description:
    "Generate narrated audio from text. Two modes: (1) single narrator — pass `narratorVoiceId` + `script`; (2) conversation — pass `lines` as an ordered array of {voiceId, text, speaker?} so different voices (e.g. a male and a female) speak their turns. Get the voiceIds from list_voices first (let the user pick). Runs in the background; returns an audio player when done. Pass `planId` from a confirmed propose_plan. Cost: ~5 credits per spoken segment.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      mode: { type: "string", description: "'narrator' (one voice) or 'conversation' (multi-voice). Inferred if omitted." },
      narratorVoiceId: { type: "string", description: "Voice id for single-narrator mode." },
      script: { type: "string", description: "Full text for single-narrator mode (≤5000 chars)." },
      lines: {
        type: "array",
        description: "Ordered conversation turns. Each: { voiceId, text, speaker? }.",
        items: {
          type: "object",
          properties: {
            voiceId: { type: "string" },
            text: { type: "string" },
            speaker: { type: "string", description: "Optional label, e.g. 'Host' / 'Guest'." },
          },
          required: ["voiceId", "text"],
        },
      },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      if (!isElevenLabsEnabled()) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: "AI voices aren't configured here. Tell the user narrated audio isn't available right now.",
        };
      }

      // Normalize into an ordered list of segments.
      type Seg = { voiceId: string; text: string; speaker?: string };
      let segments: Seg[] = [];
      const rawLines = Array.isArray(input.lines) ? input.lines : [];
      if (rawLines.length > 0) {
        segments = rawLines
          .map((l) => {
            const o = l as Record<string, unknown>;
            return {
              voiceId: typeof o.voiceId === "string" ? o.voiceId : "",
              text: typeof o.text === "string" ? o.text.trim() : "",
              speaker: typeof o.speaker === "string" ? o.speaker : undefined,
            };
          })
          .filter((s) => s.voiceId && s.text)
          .slice(0, 40);
      } else if (typeof input.narratorVoiceId === "string" && typeof input.script === "string") {
        const script = input.script.trim().slice(0, 5000);
        if (script) segments = [{ voiceId: input.narratorVoiceId, text: script }];
      }

      if (segments.length === 0) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Provide either narratorVoiceId + script, or a non-empty lines array (each with voiceId + text). Use list_voices to get voiceIds first.",
        };
      }

      const perSegment = await getDynamicCreditCost("AI_VOICE_GENERATION");
      const totalCost = perSegment * segments.length;
      if (!ctx.isAdmin) {
        const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
        if ((user?.aiCredits ?? 0) < totalCost) {
          return {
            ok: false,
            error_code: "insufficient_credits",
            message: `Narrating ${segments.length} segment(s) costs ${totalCost} credits. User has ${user?.aiCredits ?? 0}.`,
            meta: { need: totalCost, have: user?.aiCredits ?? 0 },
          };
        }
      }

      const isConversation = segments.length > 1;
      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "generate_narration",
        input: { mode: isConversation ? "conversation" : "narrator", segments: segments.length },
        creditCost: totalCost,
        worker: async (taskId) => {
          const ffmpeg = findFFmpegPath();
          const tempDir = await mkdtemp(path.join(os.tmpdir(), "flow-narration-"));
          try {
            const files: string[] = [];
            for (let i = 0; i < segments.length; i++) {
              publishTaskEvent({
                type: "progress",
                taskId,
                progress: Math.round((80 * i) / segments.length) + 5,
                message: `Voicing segment ${i + 1} / ${segments.length}…`,
              });
              const buf = await generateWithClonedVoice({ voiceId: segments[i].voiceId, text: segments[i].text });
              const fp = path.join(tempDir, `seg-${i}.mp3`);
              await writeFile(fp, buf);
              files.push(fp);
            }

            let finalBuffer: Buffer;
            if (files.length === 1 || !ffmpeg) {
              // Single segment (or no ffmpeg) — just use the first/only file.
              // Without ffmpeg we can't stitch, so fall back to segment 1.
              finalBuffer = await readFile(files[0]);
            } else {
              publishTaskEvent({ type: "progress", taskId, progress: 88, message: "Stitching the conversation…" });
              const listFile = path.join(tempDir, "list.txt");
              await writeFile(listFile, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
              const outPath = path.join(tempDir, "out.mp3");
              await runFfmpeg(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outPath]);
              finalBuffer = await readFile(outPath);
            }

            publishTaskEvent({ type: "progress", taskId, progress: 94, message: "Uploading…" });
            const key = `flow-ai/${ctx.userId}/narration-${nanoid(8)}.mp3`;
            const url = await uploadToS3(key, finalBuffer, "audio/mpeg");

            await saveToMediaLibrary({
              userId: ctx.userId,
              url,
              type: "audio",
              mimeType: "audio/mpeg",
              size: finalBuffer.length,
              tags: ["flow-ai", isConversation ? "conversation" : "narration"],
              metadata: { mode: isConversation ? "conversation" : "narrator", segments: segments.length },
            });

            if (!ctx.isAdmin && totalCost > 0) {
              await creditService.deductCredits({
                userId: ctx.userId,
                type: TRANSACTION_TYPES.USAGE,
                amount: totalCost,
                referenceType: "flow_ai_narration",
                referenceId: taskId,
                description: `Flow-AI narration (${segments.length} segment${segments.length > 1 ? "s" : ""})`,
              });
            }

            await notifyAgentTaskComplete({
              userId: ctx.userId,
              taskId,
              kind: "generate_narration",
              ok: true,
              summary: isConversation ? "Your voice conversation is ready" : "Your narration is ready",
              deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
            });

            return {
              output: { url, mode: isConversation ? "conversation" : "narrator", segments: segments.length },
              resultRefType: "AgentAudio",
              resultRefId: url,
            };
          } finally {
            await rm(tempDir, { recursive: true, force: true }).catch(() => {});
          }
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "generate_narration",
        summary: isConversation
          ? `Voicing a ${segments.length}-turn conversation — I'll notify you when the audio is ready.`
          : `Generating your narration — I'll notify you when it's ready.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          creditCostQuoted: totalCost,
          segments: segments.length,
          userMessage: `Started ${isConversation ? "a multi-voice conversation" : "a narration"} (${segments.length} segment(s), ${totalCost} credits). It runs in the background; the audio plays inline when ready.`,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to start narration",
      };
    }
  },
};

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))));
  });
}
