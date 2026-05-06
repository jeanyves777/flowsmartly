import OpenAI from "openai";
import type { CardSpec, ChatState, ChatTurn, DispatchEnvelope, RunChatTurnOpts, RunChatTurnResult } from "./studio-chat-agent";

type StudioSize = {
  name: string;
  width: number;
  height: number;
  category: string;
  style: string;
};

const DESIGN_SIZE_PRESETS = [
  { name: "Square social", w: 1024, h: 1024 },
  { name: "Portrait flyer", w: 1024, h: 1536 },
  { name: "Wide banner", w: 1536, h: 1024 },
];

const STYLE_OPTIONS = [
  { label: "Elegant", value: "Elegant, premium, polished, with strong readable type" },
  { label: "Warm", value: "Warm, welcoming, human, with soft visual details" },
  { label: "Bold", value: "Bold, high contrast, attention-grabbing, modern" },
  { label: "Minimal", value: "Clean, minimal, simple, with generous whitespace" },
];

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

function extractPickedSize(message: string): StudioSize | null {
  const text = message.toLowerCase();
  const explicit = message.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
  if (explicit) {
    const width = Number(explicit[1]);
    const height = Number(explicit[2]);
    const inferred = inferStudioSize(message);
    return {
      name: /portrait|flyer|vertical/i.test(message)
        ? "Portrait"
        : /wide|banner|landscape/i.test(message)
          ? "Wide"
          : /square/i.test(message)
            ? "Square"
            : inferred.name,
      width,
      height,
      category: inferred.category,
      style: inferred.style,
    };
  }
  if (/\bsquare\b/.test(text)) {
    return { name: "Square", width: 1024, height: 1024, category: "social_post", style: "polished" };
  }
  if (/\b(portrait|flyer|poster|vertical)\b/.test(text)) {
    return { name: "Portrait", width: 1024, height: 1536, category: "flyer", style: "polished" };
  }
  if (/\b(wide|banner|landscape|cover|header)\b/.test(text)) {
    return { name: "Wide", width: 1536, height: 1024, category: "banner", style: "polished" };
  }
  if (/\b(square|feed|post)\b/.test(text)) {
    return { name: "Square", width: 1024, height: 1024, category: "social_post", style: "polished" };
  }
  return null;
}

function extractStyle(message: string) {
  const text = message.toLowerCase();
  if (/\b(elegant|premium|luxury|classy)\b/.test(text)) return "Elegant, premium, polished, with strong readable type";
  if (/\b(warm|welcoming|friendly|soft|family)\b/.test(text)) return "Warm, welcoming, human, with soft visual details";
  if (/\b(bold|loud|bright|attention|modern)\b/.test(text)) return "Bold, high contrast, attention-grabbing, modern";
  if (/\b(minimal|simple|clean)\b/.test(text)) return "Clean, minimal, simple, with generous whitespace";
  return "";
}

function isGenerateConfirmation(message: string) {
  return /^(generate|generate now|create it|create now|go ahead|start|yes generate|make it)$/i.test(message.trim());
}

function isRegeneratePrompt(message: string) {
  return /^(regenerate this|try again|new variant|branch this)$/i.test(message.trim());
}

function isSyntheticPickerMessage(message: string) {
  return /^(use .+ size|elegant|warm|bold|minimal|.*polished.*readable.*type|.*welcoming.*soft.*visual|.*high contrast.*modern|.*clean.*minimal)/i.test(message.trim());
}

function isReferenceSignalMessage(message: string) {
  return /^here'?s a reference image to use\.?$/i.test(message.trim()) ||
    /^reference image attached\.?$/i.test(message.trim());
}

function lastAgentTurnHasCard(history: ChatTurn[], type: CardSpec["type"]) {
  const lastAgentTurn = [...history].reverse().find((turn) => turn.role === "agent");
  return lastAgentTurn?.cards?.some((card) => card.type === type) === true;
}

function hasNaturalAgentReply(history: ChatTurn[]) {
  return history.some(
    (turn) =>
      turn.role === "agent" &&
      turn.content.trim().length > 0 &&
      (!turn.cards || turn.cards.length === 0),
  );
}

function mergeBriefContext(existing: string | undefined, incoming: string) {
  const cleanIncoming = incoming.trim();
  if (!cleanIncoming) return existing || "";
  if (!existing?.trim()) return cleanIncoming;
  if (existing.toLowerCase().includes(cleanIncoming.toLowerCase())) return existing;
  return `${existing.trim()}\nAdditional instruction: ${cleanIncoming}`;
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
  const brief = state.briefContext || state.designText || state.prompt || state.originalRequest || message;
  return [
    "Brand identity:",
    JSON.stringify(compactBrandKit(state.brandKit), null, 2),
    references.length ? `Reference images:\n${references.join("\n")}` : null,
    "User prompt:",
    brief,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildUserFacingBrief(state: ChatState) {
  const size = state.size;
  return {
    type: state.mode === "video" ? "Video" : "Design",
    request: state.briefContext || state.designText || state.prompt || state.originalRequest || "New creative",
    format: size ? `${size.name || "Custom"} (${size.width}x${size.height})` : "Needs format",
    direction: state.style || "FlowAI creative direction",
    brand: state.brandKit?.name || "Brand kit",
  };
}

function buildClarifyingBriefReply(message: string, state: ChatState, references: string[]) {
  const lower = message.toLowerCase();
  const subject = state.mode === "video"
    ? "video"
    : /\b(flyer|poster|invitation|announcement|service|conference|event)\b/.test(lower)
      ? "design"
      : "creative";
  const brandLine = state.brandKit?.name
    ? `I will keep ${state.brandKit.name} in the mix.`
    : "I will keep it clean and on-brand once the idea is locked.";
  const referenceLine = references.length > 0
    ? "I can use the reference image as visual direction."
    : null;

  return [
    `That ${subject} can work.`,
    brandLine,
    referenceLine,
    "Before I show a Generate button, tell me the exact headline or must-have text, who this is for, and the feeling you want people to get.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildGenerationPrompt(state: ChatState, fallbackMessage: string, references: string[]) {
  const brand = compactBrandKit(state.brandKit);
  const brief = state.briefContext || state.designText || state.prompt || state.originalRequest || fallbackMessage;
  return [
    "Create a finished marketing design for FlowSmartly Studio.",
    "User brief:",
    brief,
    state.originalRequest && state.originalRequest !== brief ? `Original request: ${state.originalRequest}` : null,
    state.lastUserInstruction && !brief.includes(state.lastUserInstruction) ? `Latest instruction: ${state.lastUserInstruction}` : null,
    state.style ? `Creative direction: ${state.style}` : "Creative direction: polished, professional, readable.",
    state.category ? `Asset type: ${state.category}` : null,
    brand ? `Brand identity:\n${JSON.stringify(brand, null, 2)}` : null,
    references.length ? `Reference images:\n${references.join("\n")}` : null,
    "Make the result ready to use. Do not add AI/model/provider names, watermarks, or backend labels.",
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

  const pickedSize = extractPickedSize(message);
  const pickedStyle = extractStyle(message);
  const isPickerReply = isSyntheticPickerMessage(message);
  const isReferenceSignal = isReferenceSignalMessage(message);
  const latestAgentAskedForConfirmation = lastAgentTurnHasCard(opts.history, "confirm_summary");
  const conversationStarted = opts.state.briefConversationStarted === true || hasNaturalAgentReply(opts.history);
  const nextState: ChatState = {
    ...opts.state,
    references: opts.state.references,
  };

  if (isVideoPrompt(message) || nextState.mode === "video") {
    nextState.mode = "video";
  } else {
    nextState.mode = "image";
  }

  if (pickedSize) {
    nextState.size = { name: pickedSize.name, width: pickedSize.width, height: pickedSize.height };
    nextState.category = pickedSize.category;
  }
  if (pickedStyle) {
    nextState.style = pickedStyle;
  }

  if (!isGenerateConfirmation(message) && !isRegeneratePrompt(message) && !isPickerReply && !isReferenceSignal) {
    const inferred = inferStudioSize(message);
    nextState.originalRequest = nextState.originalRequest || message;
    nextState.prompt = nextState.prompt || message;
    nextState.lastUserInstruction = message;
    nextState.designText = mergeBriefContext(nextState.briefContext || nextState.designText || nextState.prompt, message);
    nextState.briefContext = nextState.designText;
    nextState.category = pickedSize?.category || nextState.category || inferred.category;
  }

  if (isRegeneratePrompt(message) && opts.state.prompt) {
    nextState.prompt = opts.state.prompt;
    nextState.designText = opts.state.briefContext || opts.state.designText || opts.state.prompt;
    nextState.briefContext = nextState.designText;
  }

  const needsPrompt = !nextState.prompt && !nextState.designText;
  const needsSize = nextState.mode !== "video" && !nextState.size;
  const generateRequested = isGenerateConfirmation(message);
  const isConfirmed = (generateRequested && latestAgentAskedForConfirmation && conversationStarted) || isRegeneratePrompt(message);

  if (
    !conversationStarted &&
    !needsPrompt &&
    !isRegeneratePrompt(message) &&
    !isReferenceSignal
  ) {
    nextState.briefConversationStarted = true;
    return {
      text: buildClarifyingBriefReply(message, nextState, references),
      cards: [],
      dispatched: [],
      stateUpdate: nextState,
      toolCalls: [{
        name: "free_studio_conversation_gate",
        input: { message, references, isPickerReply },
        output: { state: buildUserFacingBrief(nextState) },
      }],
      usage: { inputTokens: 0, outputTokens: 0 },
      iterations: 1,
    };
  }

  if (!isConfirmed || needsPrompt || needsSize) {
    const cards: CardSpec[] = [];
    const missing: string[] = [];
    if (needsPrompt) missing.push("what we are making");
    if (needsSize) missing.push("the final format");

    if (needsSize) {
      cards.push({ type: "size_picker" as const, presets: DESIGN_SIZE_PRESETS });
    }

    if (!nextState.style && !needsPrompt) {
      cards.push({
        type: "quick_reply" as const,
        question: "Choose the creative direction",
        options: STYLE_OPTIONS,
      });
    }

    if (!needsPrompt && !needsSize && nextState.style) {
      nextState.confirmationShown = true;
      cards.push({
        type: "confirm_summary" as const,
        collected: buildUserFacingBrief(nextState),
      });
    }

    const text = needsPrompt
      ? "Tell me what we are creating and the key details that must appear on it."
      : needsSize
        ? "I have the idea. Before I create it, choose the final format and add any must-have details like location, exact wording, or offer."
        : nextState.style
          ? "Great. Here is the brief I have. Confirm when you want FlowAI to create the first version."
          : "Good. Pick the visual direction, then I will show the final brief before generating.";

    return {
      text,
      cards,
      dispatched: [],
      stateUpdate: nextState,
      toolCalls: [{ name: "free_studio_brief_collection", input: { message, references }, output: { missing, state: buildUserFacingBrief(nextState) } }],
      usage: { inputTokens: 0, outputTokens: 0 },
      iterations: 1,
    };
  }

  const branchId = `main-${Date.now().toString(36)}`;
  const firstReference = references[references.length - 1];

  if (nextState.mode === "video") {
    const dispatched: DispatchEnvelope[] = [{
      kind: "video",
      status: "pending",
      args: {
        prompt: buildVideoPrompt(nextState.designText || nextState.prompt || message, nextState, references),
        aspectRatio: /\b(horizontal|landscape|youtube)\b/i.test(nextState.prompt || message) ? "16:9" : "9:16",
        durationSeconds: 8,
        voiceover: false,
        referenceImageUrl: firstReference,
      },
    }];
    return {
      text: "Creating the first video draft with your brand direction now.",
      cards: [],
      dispatched,
      stateUpdate: { ...nextState, mode: "video", references: opts.state.references },
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
      text: "Applying your edit now.",
      cards: [],
      dispatched,
      stateUpdate: { prompt: message },
      toolCalls: [{ name: "free_studio_remix_dispatch", input: { message }, output: { sourceImageUrl: opts.state.lastResultImageUrl } }],
      usage: { inputTokens: 0, outputTokens: 0 },
      iterations: 1,
    };
  }

  const size = nextState.size
    ? { name: nextState.size.name || "Custom", width: nextState.size.width, height: nextState.size.height, category: nextState.category || "social_post", style: nextState.style || "polished" }
    : inferStudioSize(message);
  const generationPrompt = buildGenerationPrompt(nextState, message, references);
  const dispatched: DispatchEnvelope[] = [{
    kind: "design",
    status: "pending",
    args: {
      mode: "ai_image",
      prompt: generationPrompt,
      width: size.width,
      height: size.height,
      category: size.category,
      style: nextState.style || size.style,
        referenceImageUrl: firstReference,
        useBrandColors: true,
        qualityCheckEnabled: nextState.qualityCheckEnabled === true,
        branchId,
      },
  }];

  return {
    text: "Creating the first design draft with your brand direction now.",
    cards: [],
    dispatched,
    stateUpdate: {
      mode: "image",
      prompt: nextState.prompt || message,
      designText: nextState.designText || nextState.briefContext || nextState.prompt || message,
      originalRequest: nextState.originalRequest || nextState.prompt || message,
      briefContext: nextState.briefContext || nextState.designText || nextState.prompt || message,
      lastUserInstruction: nextState.lastUserInstruction,
      qualityCheckEnabled: nextState.qualityCheckEnabled === true,
      category: size.category,
      size: { name: size.name, width: size.width, height: size.height },
      style: nextState.style || size.style,
      outputMode: "flat",
      currentBranchId: branchId,
    },
    toolCalls: [{ name: "free_studio_design_dispatch", input: { message, references }, output: { branchId, size } }],
    usage: { inputTokens: 0, outputTokens: 0 },
    iterations: 1,
  };
}
