import { normalizeTaskCategory } from "@/lib/strategy/categories";

export type AutomationMediaType = "image" | "video";

export interface AutomationReadinessTask {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status?: string;
  automationId?: string | null;
  automationStatus?: string | null;
}

export interface AutomationReadinessOptions {
  includeMedia?: boolean;
  mediaType?: AutomationMediaType;
  selectedPlatforms?: string[];
  connectedPlatforms?: string[];
  emailReady?: boolean;
  smsReady?: boolean;
  requireDestination?: boolean;
}

export interface AutomationReadiness {
  qualified: boolean;
  type: "post" | "email" | "visual" | "video" | "sms" | "manual";
  requirements: string[];
  blockers: string[];
  warnings: string[];
}

const POST_CATEGORIES = new Set(["content", "social"]);
const EMAIL_TERMS = /\b(email|newsletter|drip|inbox|subscriber|email campaign|welcome series|cart recovery)\b/i;
const SMS_TERMS = /\b(sms|text message|text blast|twilio|whatsapp)\b/i;
const VIDEO_TERMS = /\b(video|reel|short|youtube|tiktok|animation|animated|story)\b/i;
const VISUAL_TERMS = /\b(visual|image|photo|graphic|flyer|poster|creative|carousel|banner)\b/i;
const SOCIAL_PLATFORM_TERMS = /\b(instagram|facebook|linkedin|twitter|x\/twitter|x post|tiktok|youtube|threads|pinterest|social)\b/i;
const POST_OUTPUT_TERMS = /\b(post|posts|caption|captions|copy|thread|tweet|publish|schedule|scheduled|social media|audience post|call to action|cta)\b/i;
const MEDIA_OUTPUT_TERMS = /\b(generate|create|publish|schedule|post|caption|ad copy|campaign creative)\b/i;
const FEED_ONLY_TERMS = /\b(flowsmartly feed|internal feed|feed post|post to feed)\b/i;
const MANUAL_WORK_TERMS =
  /\b(audit|optimi[sz]e|setup|set up|configure|install|connect|review|research|planning|plan|recommendation|framework|content calendar|infrastructure|tracking|pixel|ga4|conversion|a\/b test|ab test|layout|layouts|product pages?|website|web pages?|landing pages?|faq|bios?|business account|boards?|channel setup|transparency|customer review sections?|ugc galleries?)\b/i;

function taskText(task: AutomationReadinessTask) {
  return `${task.title || ""} ${task.description || ""}`;
}

export function isAutomationCandidate(task: AutomationReadinessTask) {
  return inferAutomationType(task) !== "manual";
}

export function inferAutomationType(task: AutomationReadinessTask): AutomationReadiness["type"] {
  const category = normalizeTaskCategory(task.category);
  const text = taskText(task);
  const manualWork = MANUAL_WORK_TERMS.test(text);
  const hasPostIntent =
    POST_OUTPUT_TERMS.test(text) ||
    (category === "social" && SOCIAL_PLATFORM_TERMS.test(text) && !manualWork);
  const hasMediaIntent = MEDIA_OUTPUT_TERMS.test(text) && !manualWork;

  if (SMS_TERMS.test(text)) return "sms";
  if (category === "email" || EMAIL_TERMS.test(text)) return "email";
  if (VIDEO_TERMS.test(text) && hasMediaIntent) return "video";
  if (VISUAL_TERMS.test(text) && hasMediaIntent) return "visual";
  if (POST_CATEGORIES.has(category) && hasPostIntent) return "post";
  return "manual";
}

export function qualifyStrategyTaskForAutomation(
  task: AutomationReadinessTask,
  options: AutomationReadinessOptions = {}
): AutomationReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requirements: string[] = [];
  const type = inferAutomationType(task);
  const selectedPlatforms = options.selectedPlatforms || [];
  const connectedPlatforms = options.connectedPlatforms || [];
  const category = normalizeTaskCategory(task.category);
  const requireDestination = options.requireDestination !== false;

  if (task.status === "DONE") blockers.push("Already completed");
  if (task.automationId || task.automationStatus === "AUTOMATED") {
    blockers.push("Already automated");
  }
  if (type === "manual") {
    blockers.push(
      "This is manual/setup work. Automation can only create or schedule supported outputs: social posts, email campaigns, generated media/video, or SMS when enabled."
    );
  }

  if (type === "email") {
    requirements.push("Verified email sender");
    if (!options.emailReady) blockers.push("Email sender is not verified");
  }

  if (type === "sms") {
    requirements.push("Approved SMS setup");
    blockers.push(options.smsReady ? "SMS strategy automation is not enabled yet" : "SMS setup is not approved");
  }

  if (type === "visual" || type === "video") {
    requirements.push(type === "video" ? "Video generation" : "Visual generation");
    if (!options.includeMedia) {
      blockers.push(type === "video" ? "Enable video media for this item" : "Enable generated media for this item");
    } else if (type === "video" && options.mediaType !== "video") {
      blockers.push("Set media type to video");
    }
  }

  if (POST_CATEGORIES.has(category) && type !== "email" && type !== "sms" && requireDestination) {
    const publishTargets = selectedPlatforms.filter((platform) => platform !== "feed");
    const missingConnections = publishTargets.filter(
      (platform) => !connectedPlatforms.includes(platform)
    );
    if (selectedPlatforms.length === 0) {
      blockers.push("Select at least one connected publishing destination");
    }
    if (missingConnections.length > 0) {
      blockers.push(`Connect ${missingConnections.join(", ")} before scheduling`);
    }
    if (
      selectedPlatforms.length === 1 &&
      selectedPlatforms[0] === "feed" &&
      !FEED_ONLY_TERMS.test(taskText(task))
    ) {
      blockers.push("Internal Feed alone does not automate this task. Select a real connected channel or rewrite the item as an explicit feed post.");
    }
  }

  return {
    qualified: blockers.length === 0,
    type,
    requirements,
    blockers,
    warnings,
  };
}
