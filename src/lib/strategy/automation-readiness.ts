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
}

export interface AutomationReadiness {
  qualified: boolean;
  type: "post" | "email" | "visual" | "video" | "sms" | "manual";
  requirements: string[];
  blockers: string[];
  warnings: string[];
}

const POST_CATEGORIES = new Set(["content", "social"]);
const EMAIL_TERMS = /\b(email|newsletter|drip|inbox|subscriber|campaign)\b/i;
const SMS_TERMS = /\b(sms|text message|text blast|twilio|whatsapp)\b/i;
const VIDEO_TERMS = /\b(video|reel|short|youtube|tiktok|animation|animated|story)\b/i;
const VISUAL_TERMS = /\b(visual|image|photo|graphic|flyer|poster|creative|pinterest|pin|carousel|banner)\b/i;

function taskText(task: AutomationReadinessTask) {
  return `${task.title || ""} ${task.description || ""}`;
}

export function isAutomationCandidate(task: AutomationReadinessTask) {
  const category = normalizeTaskCategory(task.category);
  return POST_CATEGORIES.has(category) || category === "email";
}

export function inferAutomationType(task: AutomationReadinessTask): AutomationReadiness["type"] {
  const category = normalizeTaskCategory(task.category);
  const text = taskText(task);

  if (SMS_TERMS.test(text)) return "sms";
  if (category === "email" || EMAIL_TERMS.test(text)) return "email";
  if (VIDEO_TERMS.test(text)) return "video";
  if (VISUAL_TERMS.test(text)) return "visual";
  if (POST_CATEGORIES.has(category)) return "post";
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
  const selectedPlatforms = options.selectedPlatforms || ["feed"];
  const connectedPlatforms = options.connectedPlatforms || [];
  const category = normalizeTaskCategory(task.category);

  if (task.status === "DONE") blockers.push("Already completed");
  if (task.automationId || task.automationStatus === "AUTOMATED") {
    blockers.push("Already automated");
  }
  if (!isAutomationCandidate(task)) {
    blockers.push(`${category} items need manual review before automation`);
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

  if (POST_CATEGORIES.has(category) && type !== "email" && type !== "sms") {
    const publishTargets = selectedPlatforms.filter((platform) => platform !== "feed");
    const missingConnections = publishTargets.filter(
      (platform) => !connectedPlatforms.includes(platform)
    );
    if (selectedPlatforms.length === 0) {
      blockers.push("Select a publishing destination");
    }
    if (missingConnections.length > 0) {
      blockers.push(`Connect ${missingConnections.join(", ")} before scheduling`);
    }
    if (selectedPlatforms.length === 1 && selectedPlatforms[0] === "feed") {
      warnings.push("This will publish only to the FlowSmartly feed");
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
