/**
 * Video Agent — produces a short-form video for social/promo use.
 *
 * Built on the Claude Agent SDK. The agent:
 *  - Plans the shot (subject, camera move, mood) given the brief.
 *  - Optionally generates a "first frame" via gpt-image-1 to anchor
 *    the look (when no reference image is provided).
 *  - Calls generate_video (Google Veo 3.1) with prompt + reference.
 *  - Critiques the result against the brief.
 *  - Finalizes.
 *
 * Per user direction: "full sdk: editable agent, gbp and video google".
 *
 * Status: Veo 3.1 wiring is STUBBED until GOOGLE_APPLICATION_CREDENTIALS
 * is confirmed in this env. Set VEO_ENABLED=true to flip on. The agent
 * shape is fully built and testable now — only the Veo network call
 * is the placeholder.
 */

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import sharp from "sharp";
import {
  ImageStore,
  resolveToBuffer,
  generateImage as genImage,
  editImage as edImage,
  removeImageBackground,
  compositeImages,
  colorGrade,
  getClaudeCodeBinaryPath,
} from "./design-tools";
import { generateVideoVeo } from "./design-tools/video-tools";

export interface VideoBrief {
  topic: string;
  /** Free-form storyboard / shot description. The agent expands this. */
  shotDescription: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationSeconds: number;
  brand?: {
    name?: string;
    voiceTone?: string;
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  /** Optional reference image to use as the first frame. */
  referenceImageUrl?: string;
  vibe?: string;
  /** Optional voiceover text — Veo doesn't synthesise audio; we'd add it
   *  via a separate TTS pass after Veo returns. Captured here for the
   *  brief but not yet wired. */
  voiceoverScript?: string;
}

export interface VideoResult {
  videoUrl: string;
  jobId: string;
  model: string;
  durationSeconds: number;
  iterations: number;
  toolsUsed: string[];
  totalCostUsd?: number;
}

export async function runVideoAgent(brief: VideoBrief): Promise<VideoResult> {
  const store = new ImageStore();
  let finalVideo: VideoResult | null = null;

  // Pre-load reference image if any.
  let referenceHandle: string | null = null;
  if (brief.referenceImageUrl) {
    try {
      const buf = await resolveToBuffer(brief.referenceImageUrl);
      const meta = await sharp(buf).metadata();
      referenceHandle = store.register({
        buffer: buf,
        mimeType: "image/png",
        width: meta.width,
        height: meta.height,
        source: "user_reference",
        note: "user-uploaded reference (first frame anchor)",
      });
    } catch (err) {
      console.warn("[VideoAgent] failed to load reference image (continuing):", err);
    }
  }

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }],
  });

  const tools = [
    tool(
      "generate_first_frame",
      "Draft a 'first frame' image via gpt-image-1 to anchor the video's look. Use when no reference image was provided OR you want to compose a specific opening still. Returns image_id.",
      {
        prompt: z.string(),
        quality: z.enum(["low", "medium", "high"]).optional(),
      },
      async (args) => {
        const w = brief.aspectRatio === "9:16" ? 1080 : brief.aspectRatio === "16:9" ? 1920 : 1080;
        const h = brief.aspectRatio === "9:16" ? 1920 : brief.aspectRatio === "16:9" ? 1080 : 1080;
        return ok(await genImage(store, { prompt: args.prompt, width: w, height: h, quality: args.quality }));
      },
    ),
    tool(
      "edit_first_frame",
      "Revise an existing first-frame image via gpt-image-1.edit. Returns a new image_id.",
      {
        image_id: z.string(),
        instruction: z.string(),
      },
      async (args) => ok(await edImage(store, { image_id: args.image_id, instruction: args.instruction })),
    ),
    tool(
      "remove_background",
      "Strip the background from an image (rembg). Useful when compositing a subject onto a brand-coloured backdrop before video gen.",
      { image_id: z.string() },
      async (args) => ok(await removeImageBackground(store, args)),
    ),
    tool(
      "composite_images",
      "Layer images on top of a base. Use to assemble a tighter first frame from a cutout + a generated bg.",
      {
        base_id: z.string(),
        overlays: z.array(z.object({
          image_id: z.string(),
          x_pct: z.number(),
          y_pct: z.number(),
          width_pct: z.number().optional(),
          opacity: z.number().optional(),
        })),
      },
      async (args) => ok(await compositeImages(store, args)),
    ),
    tool(
      "color_grade",
      "Tweak saturation / brightness / hue on a still — useful for matching brand mood before sending to Veo.",
      {
        image_id: z.string(),
        saturation: z.number().optional(),
        brightness: z.number().optional(),
        hue: z.number().optional(),
      },
      async (args) => ok(await colorGrade(store, args)),
    ),
    tool(
      "generate_video",
      "Generate the actual video via Google Veo 3.1. Pass a detailed prompt (subject, action, camera move, mood, lighting). Optionally pass a first-frame image_id to anchor the opening shot. The system handles the long-running Veo job under the hood. Returns videoUrl.",
      {
        prompt: z.string().describe("Detailed video prompt: subject, action, camera move, mood, lighting."),
        first_frame_image_id: z.string().optional(),
        negative_prompt: z.string().optional(),
      },
      async (args) => {
        let firstFrameDataUrl: string | undefined;
        if (args.first_frame_image_id && store.has(args.first_frame_image_id)) {
          const img = store.get(args.first_frame_image_id);
          firstFrameDataUrl = `data:${img.mimeType};base64,${img.buffer.toString("base64")}`;
        }
        const veo = await generateVideoVeo({
          prompt: args.prompt,
          aspectRatio: brief.aspectRatio,
          durationSeconds: brief.durationSeconds,
          referenceImageUrl: firstFrameDataUrl,
          negativePrompt: args.negative_prompt,
        });
        return ok(veo);
      },
    ),
    tool(
      "finalize",
      "TERMINAL TOOL — call when the video is ready. Pass the videoUrl + jobId returned by generate_video. The system stops the loop. After finalize, do not call more tools or write text.",
      {
        video_url: z.string(),
        job_id: z.string(),
        model: z.string().optional(),
        duration_seconds: z.number().optional(),
      },
      async (args) => {
        finalVideo = {
          videoUrl: args.video_url,
          jobId: args.job_id,
          model: args.model || "veo-3.1-generate-001",
          durationSeconds: args.duration_seconds ?? brief.durationSeconds,
          iterations: 0,
          toolsUsed: [],
        };
        return ok({ ok: true, message: "Video finalized. Stop calling tools." });
      },
    ),
  ];

  const server = createSdkMcpServer({
    name: "video_engine",
    version: "1.0.0",
    tools,
    alwaysLoad: true,
  });

  const allowedTools = tools.map((t) => `mcp__video_engine__${t.name}`);

  const systemPrompt = buildVideoSystemPrompt(brief, referenceHandle);
  const userPrompt = buildVideoUserMessage(brief, referenceHandle, store);

  let iterations = 0;
  const toolsUsed: string[] = [];
  let totalCostUsd: number | undefined;

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      mcpServers: { video_engine: server },
      allowedTools,
      canUseTool: async () => ({ behavior: "allow" as const, updatedInput: {} }),
      maxTurns: 15,
      pathToClaudeCodeExecutable: getClaudeCodeBinaryPath(),
      stderr: (msg: string) => console.error(`[video-agent/cli] ${msg.trimEnd()}`),
    },
  })) {
    if (message.type === "assistant") {
      iterations++;
      const blocks = (message.message?.content ?? []) as Array<{ type?: string; name?: string }>;
      for (const b of blocks) {
        if (b.type === "tool_use" && typeof b.name === "string") toolsUsed.push(b.name);
      }
    } else if (message.type === "result") {
      const r = message as unknown as { total_cost_usd?: number };
      if (typeof r.total_cost_usd === "number") totalCostUsd = r.total_cost_usd;
    }
  }

  if (!finalVideo) {
    throw new Error(`Video agent finished without calling finalize (iterations=${iterations}, tools=${toolsUsed.join(",")})`);
  }
  const v = finalVideo as VideoResult;
  return { ...v, iterations, toolsUsed, totalCostUsd };
}

// ─── prompt builders ──────────────────────────────────────────────────

function buildVideoSystemPrompt(_brief: VideoBrief, hasReference: string | null): string {
  return `You are FlowAI Video Engine — a senior creative director producing one short-form video (5-8 seconds) via Google Veo 3.1.

Your job: read the brief, optionally compose a tighter first frame, then call generate_video with a strong cinematic prompt, and finalize.

Tool inventory (all reachable via the video_engine MCP server):
- generate_first_frame — gpt-image-1 still as a first-frame anchor.
- edit_first_frame — gpt-image-1.edit revisions.
- remove_background / composite_images / color_grade — image ops to compose a tighter first frame before video gen.
- generate_video — Google Veo 3.1 (the actual video model).
- finalize — TERMINAL.

Workflow latitude:
- If a reference photo is provided, you usually want to use it as the first frame. Optionally remove its background and composite onto a brand-colored backdrop.
- If no reference, generate_first_frame to anchor the look — then send that image_id along with the video prompt.
- Compose the video prompt thoughtfully: SUBJECT, ACTION, CAMERA MOVE (push-in, dolly, slow pan, static), MOOD, LIGHTING, COLOR PALETTE. Veo responds to specifics — "warm sunlight, slow dolly-in, shallow depth of field" beats "cool video".
- Then call finalize with the videoUrl + jobId returned by generate_video.

Constraints:
- Aspect ratio + duration are fixed by the brief — don't override.
- ${hasReference ? "Reference photo is pre-loaded. The user's actual subject MUST appear in the result." : "No reference photo. Compose from scratch."}
- No AI provider watermarks, no model branding.

Innovate. The brief is a brief, not a recipe.`;
}

function buildVideoUserMessage(brief: VideoBrief, refHandle: string | null, store: ImageStore): string {
  const lines: string[] = [];
  lines.push(`# Brief`);
  lines.push(`Topic: ${brief.topic}`);
  lines.push(`Aspect ratio: ${brief.aspectRatio}`);
  lines.push(`Duration: ${brief.durationSeconds}s`);
  if (brief.vibe) lines.push(`Vibe: ${brief.vibe}`);
  lines.push("");
  lines.push(`## Shot description`);
  lines.push(brief.shotDescription);
  lines.push("");
  if (brief.brand) {
    lines.push(`## Brand`);
    if (brief.brand.name) lines.push(`Name: ${brief.brand.name}`);
    if (brief.brand.voiceTone) lines.push(`Voice/tone: ${brief.brand.voiceTone}`);
    const palette = [brief.brand.primary, brief.brand.secondary, brief.brand.accent].filter(Boolean).join(", ");
    if (palette) lines.push(`Palette: ${palette}`);
    lines.push("");
  }
  if (brief.voiceoverScript) {
    lines.push(`## Voiceover script (audio is added separately, not in this pass)`);
    lines.push(brief.voiceoverScript);
    lines.push("");
  }
  if (refHandle) {
    lines.push(`## Pre-loaded image handles`);
    lines.push(store.describe(refHandle));
    lines.push("");
    lines.push(`Use this as the first-frame anchor. Strip the bg if needed and composite onto a brand backdrop before video gen.`);
    lines.push("");
  }
  lines.push(`## Your turn`);
  lines.push(`Plan the shot, optionally compose a first frame, call generate_video, then finalize.`);
  return lines.join("\n");
}
