import type { FlowAgentTool } from "../registry";

/**
 * write_compose_post — write a drafted caption (and optionally pre-select the
 * target platforms) straight INTO the Compose surface's caption box, instead of
 * pasting it in the chat. The "Ask AI to write it" chip on the Compose caption
 * asks the agent to draft a post; the agent gathers goal / vibe / platforms
 * (via ask_choice cards) then calls this so the caption lands live in the editor
 * for the user to review and post — never a chat dump.
 * [[agent-writes-into-ui-element-not-chat]]
 */
export const writeComposePost: FlowAgentTool = {
  name: "write_compose_post",
  description:
    "Write a drafted social post caption straight INTO the Compose editor's caption box (NEVER paste the caption in the chat). Use this whenever the user is on Compose / clicked 'Ask AI to write it' and you've drafted a caption. Pass the full `caption` exactly as it should appear (with hashtags and any emojis). Optionally pass `platforms` — the base platform names the user picked (e.g. [\"instagram\",\"facebook\",\"feed\"]) — to pre-select those destinations in the composer. The caption appears live in the editor for the user to review, tweak and post. After calling this, do NOT repeat the caption text in chat — just tell the user it's in the composer, ready to review.",
  input_schema: {
    type: "object",
    properties: {
      caption: {
        type: "string",
        description: "The full post caption to place in the editor, including hashtags and any emojis.",
      },
      platforms: {
        type: "array",
        description:
          "Optional base platform names to pre-select as destinations, e.g. [\"instagram\",\"facebook\",\"feed\"]. 'feed' is the always-on in-app feed. Only include platforms the user chose.",
        items: { type: "string" },
      },
    },
    required: ["caption"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    const caption = typeof input.caption === "string" ? input.caption.trim() : "";
    if (!caption) return { ok: false, error_code: "missing_input", message: "caption is required." };
    const platforms = Array.isArray(input.platforms)
      ? input.platforms
          .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
          .map((p) => p.trim().toLowerCase())
      : undefined;

    // Route the caption into the open Compose surface (no DB write — this is the
    // user's in-progress draft; they review and hit Post themselves).
    ctx.emit({ type: "canvas_update", patch: { __compose: { caption, platforms } } });

    return {
      ok: true,
      data: {
        chars: caption.length,
        platforms: platforms ?? null,
        userMessage: `Wrote the caption into the Compose editor${platforms?.length ? ` and pre-selected ${platforms.join(", ")}` : ""} — it's in the caption box now. Do NOT repeat the caption in chat; just tell the user it's ready to review and post.`,
      },
    };
  },
};
