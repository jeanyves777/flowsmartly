import OpenAI from "openai";
import type { ChatState, ChatTurn, DispatchEnvelope, RunChatTurnOpts, RunChatTurnResult } from "./studio-chat-agent";

type StudioSize = {
  name: string;
  width: number;
  height: number;
  category: string;
  style: string;
};

function isCasualOnly(message: string) {
  return /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|cool|nice|great)[.! ]*$/i.test(message.trim());
}

function isVideoPrompt(message: string) {
  return /\b(video|reel|short|tiktok|animation|motion|commercial|clip|veo)\b/i.test(message);
}

function isRemixPrompt(message: string, state: ChatState) {
  if (!state.lastResultImageUrl) return false;
  return /\b(change|edit|replace|revise|remix|fix|update|make it|adjust|remove|add)\b/i.test(message);
}

function inferStudioSize(message: string): StudioSize {
  const text = message.toLowerCase();
  if (/\b(story|reel|tiktok|short|vertical)\b/.test(text)) {
    return { name: "Vertical", width: 1024, height: 1536, category: "social_post", style: "polished" };
  }
  if (/\b(flyer|poster|invitation|church|event|service|conference|announcement)\b/.test(text)) {
    return { name: "Portrait", width: 1024, height: 1536, category: "flyer", style: "polished" };
  }
  if (/\b(banner|cover|hero|website|header|landscape)\b/.test(text)) {
    return { name: "Wide", width: 1536, height: 1024, category: "banner", style: "polished" };
  }
  if (/\b(business card|visit card)\b/.test(text)) {
    return { name: "Business Card", width: 1536, height: 1024, category: "business_card", style: "polished" };
  }
  return { name: "Square", width: 1024, height: 1024, category: "social_post", style: "polished" };
}

function compactBrandKit(brandKit: ChatState["brandKit"]) {
  if (!brandKit) return null;
  return Object.fromEntries(
    Object.entries(brandKit).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return false;
      return true;
    }),
  );
}

function referencesFrom(state: ChatState, attachments?: ChatTurn["attachments"]) {
  const urls = new Set<string>();
  for (const ref of state.references || []) {
    if (ref.url) urls.add(ref.url);
  }
  for (const att of attachments || []) {
    if (att.url) urls.add(att.url);
  }
  return Array.from(urls);
}

function buildVideoPrompt(message: string, state: ChatState, references: string[]) {
  return [
    "Brand identity:",
    JSON.stringify(compactBrandKit(state.brandKit), null, 2),
    references.length ? `Reference images:\n${references.join("\n")}` : null,
    "User prompt:",
    message,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function runOpenAITextReply(opts: RunChatTurnOpts): Promise<Pick<RunChatTurnResult, "text" | "usage">> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      text: "Tell me what you want to create and I will generate it with your brand kit.",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = opts.history.slice(-12).map((turn) => ({
    role: turn.role === "user" ? "user" as const : "assistant" as const,
    content: turn.content,
  }));
  messages.push({ role: "user", content: opts.userMessage });

  const response = await openai.chat.completions.create({
    model: process.env.FLOWAI_STUDIO_CHAT_MODEL || "gpt-4o-mini",
    temperature: 0.9,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content: [
          "You are FlowAI inside FlowSmartly Studio.",
          "Be natural, concise, and creative.",
          "Use the user's brand identity as context, but do not force a scripted wizard.",
          "Brand identity JSON:",
          JSON.stringify(compactBrandKit(opts.state.brandKit), null, 2),
        ].join("\n"),
      },
      ...messages,
    ],
  });

  return {
    text: response.choices[0]?.message?.content?.trim() || "Tell me what you want to create and I will generate it with your brand kit.",
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    },
  };
}

export async function runFreeStudioTurn(opts: RunChatTurnOpts): Promise<RunChatTurnResult> {
  const message = opts.userMessage.trim();
  const references = referencesFrom(opts.state, opts.attachments);

  if (!message && references.length === 0) {
    return {
      text: "Drop a prompt or reference image and I will create from it.",
      cards: [],
      dispatched: [],
      stateUpdate: {},
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      iterations: 1,
    };
  }

  if (isCasualOnly(message)) {
    const reply = await runOpenAITextReply(opts);
    return {
      text: reply.text,
      cards: [],
      dispatched: [],
      stateUpdate: {},
      toolCalls: [],
      usage: reply.usage,
      iterations: 1,
    };
  }

  const branchId = `main-${Date.now().toString(36)}`;
  const firstReference = references[references.length - 1];

  if (isVideoPrompt(message)) {
    const dispatched: DispatchEnvelope[] = [{
      kind: "video",
      status: "pending",
      args: {
        prompt: buildVideoPrompt(message, opts.state, references),
        aspectRatio: /\b(horizontal|landscape|youtube)\b/i.test(message) ? "16:9" : "9:16",
        durationSeconds: 8,
        voiceover: false,
        referenceImageUrl: firstReference,
      },
    }];
    return {
      text: "Sending your prompt to the video engine with your brand kit now.",
      cards: [],
      dispatched,
      stateUpdate: { mode: "video", prompt: message, references: opts.state.references },
      toolCalls: [{ name: "free_studio_video_dispatch", input: { message, references }, output: { branchId } }],
      usage: { inputTokens: 0, outputTokens: 0 },
      iterations: 1,
    };
  }

  if (isRemixPrompt(message, opts.state)) {
    const dispatched: DispatchEnvelope[] = [{
      kind: "remix",
      status: "pending",
      args: {
        sourceImageUrl: opts.state.lastResultImageUrl || "",
        customText: message,
        useBrandColors: true,
        fromBranchId: opts.state.lastResultBranchId || opts.state.currentBranchId || "main",
      },
    }];
    return {
      text: "Sending your edit to GPT Image now.",
      cards: [],
      dispatched,
      stateUpdate: { prompt: message },
      toolCalls: [{ name: "free_studio_remix_dispatch", input: { message }, output: { sourceImageUrl: opts.state.lastResultImageUrl } }],
      usage: { inputTokens: 0, outputTokens: 0 },
      iterations: 1,
    };
  }

  const size = inferStudioSize(message);
  const dispatched: DispatchEnvelope[] = [{
    kind: "design",
    status: "pending",
    args: {
      mode: "ai_image",
      prompt: message,
      width: size.width,
      height: size.height,
      category: size.category,
      style: size.style,
      referenceImageUrl: firstReference,
      useBrandColors: true,
      branchId,
    },
  }];

  return {
    text: "Sending your prompt to GPT Image with your brand kit now.",
    cards: [],
    dispatched,
    stateUpdate: {
      mode: "image",
      prompt: message,
      category: size.category,
      size: { name: size.name, width: size.width, height: size.height },
      style: size.style,
      outputMode: "flat",
      currentBranchId: branchId,
    },
    toolCalls: [{ name: "free_studio_design_dispatch", input: { message, references }, output: { branchId, size } }],
    usage: { inputTokens: 0, outputTokens: 0 },
    iterations: 1,
  };
}
