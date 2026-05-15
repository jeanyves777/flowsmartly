import { prisma } from "@/lib/db/client";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";
import {
  getListSmartlyAgentBrowserStatus,
  hasActiveListSmartlyAgentSession,
  runClaudeListSmartlyBrowserAgent,
  type ListSmartlyAgentContinuation,
} from "@/lib/listsmartly/claude-browser-agent";
import {
  getListSmartlyDirectoryPriority,
  LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
} from "@/lib/constants/listsmartly";
import { seedDirectories } from "@/lib/listsmartly/directories";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";

const WORKABLE_STATUSES = ["missing", "unverified", "needs_update"];
const ACTIVE_AUTOPILOT_STATUSES = ["queued", "in_progress", "needs_user", "blocked"];
const DAILY_AUTOPILOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTOPILOT_FETCH_TIMEOUT_MS = 10000;
const AUTOPILOT_BROWSER_TIMEOUT_MS = 45000;
const AUTOPILOT_STALE_IN_PROGRESS_MS = 60 * 60 * 1000;
const AUTOPILOT_USER_AGENT = "Mozilla/5.0 (compatible; FlowSmartlyListSmartly/1.0)";
const MIN_DIRECTORY_MATCH_SCORE = 5;
const SECURE_NOTE_PREFIX = "fs-vault:v1:";
const RETRYABLE_AGENT_STAGES = new Set([
  "agent_sdk_retry_needed",
  "agent_browser_retry_needed",
  "agent_review_pending",
]);

type AutopilotAction =
  | "prepare_queue"
  | "run_next"
  | "run_extra"
  | "continue_task"
  | "complete_task"
  | "block_task"
  | "request_validation"
  | "save_credential";

type SaveCredentialInput = {
  listingId?: string;
  directoryName?: string;
  loginUrl?: string;
  accountEmail?: string;
  username?: string;
  recoveryEmail?: string;
  passwordHint?: string;
  secureNotes?: string;
  verificationStatus?: string;
};

type BusinessSignalInput = {
  businessName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  industry?: string | null;
  yearFounded?: string | null;
  description?: string | null;
};

type SearchCandidate = {
  link: string;
  title?: string;
  snippet?: string;
  score: number;
  source: string;
};

type DirectoryResearchResult = {
  portalUrl: string | null;
  portalReachable: boolean;
  discoveredLinks: string[];
  searched: boolean;
  match: SearchCandidate | null;
  error?: string;
};

type AccountCreationAttempt = {
  attempted: boolean;
  accountCreated: boolean;
  credentialSaved: boolean;
  emailSentByFlowSmartly: boolean;
  creationUrl: string | null;
  blocker: string;
  blockerMessage: string;
  requiresUserAction: boolean;
  userActionTitle: string;
  userActionMessage: string;
  userActionButtonLabel: string;
};

type BrowserWorkflowOutcome = {
  status: "submitted" | "needs_user" | "blocked" | "pending";
  stage: string;
  message: string;
  actionTitle: string;
  actionButtonLabel: string;
  actionInputKind?: "verification_code";
  actionInputLabel?: string;
  actionInputPlaceholder?: string;
  actionInputRequired?: boolean;
  portalUrl: string;
  accountCreated: boolean;
  credentialSaved: boolean;
  emailSentByFlowSmartly: boolean;
  generatedPassword?: string;
  passwordHint?: string;
  screenshotLabel?: string;
  diagnostics?: Record<string, unknown>;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value || {});
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRetryableAgentStage(value: unknown): boolean {
  return typeof value === "string" && RETRYABLE_AGENT_STAGES.has(value);
}

function isRetryableAgentResult(result: Record<string, unknown>): boolean {
  return (
    isRetryableAgentStage(result.stage) ||
    isRetryableAgentStage(result.accountCreationBlocker) ||
    isRetryableAgentStage((result.browserDiagnostics as { stage?: unknown } | undefined)?.stage)
  );
}

function getVaultKey(): Buffer | null {
  const secret =
    process.env.LISTSMARTLY_VAULT_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.STORE_CUSTOMER_JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  return createHash("sha256").update(secret).digest();
}

function encryptSecureNote(value: string | null | undefined): string | null {
  if (!value) return value || null;
  if (value.startsWith(SECURE_NOTE_PREFIX)) return value;
  const key = getVaultKey();
  if (!key) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECURE_NOTE_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecureNote(value: string | null | undefined): string | null {
  if (!value) return value || null;
  if (!value.startsWith(SECURE_NOTE_PREFIX)) return value;
  const key = getVaultKey();
  if (!key) return "Encrypted secure note is unavailable because the vault secret is not configured.";
  const payload = value.slice(SECURE_NOTE_PREFIX.length);
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "Encrypted secure note could not be decoded.";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "Encrypted secure note could not be decrypted.";
  }
}

function extractGeneratedPasswordFromSecureNote(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/Generated password:\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

async function getSavedDirectoryCredential(params: {
  profileId: string;
  listingId: string | null;
  directoryName: string;
}): Promise<{ email: string | null; password: string | null } | null> {
  const credentialMatches: Prisma.ListSmartlyAccountCredentialWhereInput[] = [
    { directoryName: params.directoryName },
  ];
  if (params.listingId) credentialMatches.unshift({ listingId: params.listingId });
  const credential = await prisma.listSmartlyAccountCredential.findFirst({
    where: {
      profileId: params.profileId,
      status: "active",
      OR: credentialMatches,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!credential) return null;

  const secureNotes = decryptSecureNote(credential.secureNotes);
  const password = extractGeneratedPasswordFromSecureNote(secureNotes);
  if (!password) return null;
  return {
    email: credential.accountEmail || credential.username || null,
    password,
  };
}

function generateAutopilotPassword(): string {
  const core = randomBytes(8).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return `Fs!${core}7Aa`;
}

function splitContactName(profile: BusinessSignalInput): { firstName: string; lastName: string } {
  const raw = normalizeText(profile.contactName || "").length > 2 ? profile.contactName : profile.businessName;
  const parts = (raw || profile.businessName || "Business Admin")
    .replace(/[^a-zA-Z0-9' -]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = parts[0] || "Business";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Admin";
  return { firstName, lastName };
}

function appendProgress(
  current: Record<string, unknown>,
  event: { stage: string; label: string; status: "done" | "active" | "waiting" | "failed"; detail?: string }
): Record<string, unknown> {
  const existing = Array.isArray(current.progress) ? current.progress : [];
  const progress = [
    ...existing.filter((item) => {
      return Boolean(item && typeof item === "object" && (item as { stage?: string }).stage !== event.stage);
    }),
    {
      ...event,
      at: new Date().toISOString(),
    },
  ];

  return {
    ...current,
    progress,
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function looksLikeAccountCreationUrl(value: string | null | undefined): boolean {
  return /(sign.?up|signup|free.?trial|register|create.?account|claim.?business|add.?business|add.?listing)/i.test(
    value || ""
  );
}

function hasSsoPrompt(html: string): boolean {
  const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  return /single sign[\s-]?on|\bsso\b|sign in with google|continue with google|log in with google|sign up with google|sign in with microsoft|continue with microsoft|log in with microsoft|office 365/i.test(
    withoutScripts
  );
}

function hasClaimWorkflowLanguage(value: string): boolean {
  return /(claim your|claim this|claim listing|claim profile|claim your free|register your business|add your business)/i.test(
    value
  );
}

function scoreSearchCandidate(profile: BusinessSignalInput, candidate: { link: string; title?: string; snippet?: string }): number {
  const rawHaystack = `${candidate.title || ""} ${candidate.snippet || ""} ${candidate.link}`;
  const haystack = normalizeText(rawHaystack);
  const normalizedName = normalizeText(profile.businessName);
  const nameTokens = normalizedName.split(" ").filter((token) => token.length > 2);
  const phone = normalizePhone(profile.phone);
  const haystackDigits = normalizePhone(rawHaystack);
  let score = 0;

  if (normalizedName && haystack.includes(normalizedName)) score += 6;
  score += Math.min(4, nameTokens.filter((token) => haystack.includes(token)).length);
  if (phone && (haystackDigits.includes(phone) || haystackDigits.includes(phone.slice(-7)))) score += 5;
  if (profile.website && haystack.includes(normalizeText(extractDomain(profile.website)))) score += 4;
  if (profile.address && haystack.includes(normalizeText(profile.address))) score += 4;
  if (profile.city && haystack.includes(normalizeText(profile.city))) score += 1;
  if (profile.state && haystack.includes(normalizeText(profile.state))) score += 1;

  return score;
}

function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
}

function getGoogleSearchCx(): string | undefined {
  return (
    process.env.GOOGLE_SEARCH_CX ||
    process.env.GOOGLE_CSE_ID ||
    process.env.GOOGLE_CUSTOM_SEARCH_CX ||
    process.env.GOOGLE_SEARCH_ENGINE_ID
  );
}

function taskPriority(
  status: string,
  directory: { slug: string; tier: number; category: string; isActive?: boolean }
): number {
  const statusWeight: Record<string, number> = {
    missing: 0,
    needs_update: 1000,
    unverified: 2000,
  };
  return (statusWeight[status] ?? 3000) + getListSmartlyDirectoryPriority(directory);
}

function taskTypeForStatus(status: string): string {
  if (status === "missing") return "create_or_claim_listing";
  if (status === "needs_update") return "fix_inconsistency";
  return "verify_presence";
}

function taskTitle(status: string, directoryName: string): string {
  if (status === "missing") return `Create or claim ${directoryName}`;
  if (status === "needs_update") return `Fix ${directoryName} listing`;
  return `Verify ${directoryName}`;
}

function requiredActionForStatus(status: string): string {
  if (status === "missing") {
    return "Autopilot will use the public web submit or claim flow and pause only if the directory requires email, SMS, phone, payment, or CAPTCHA verification.";
  }
  if (status === "needs_update") {
    return "Autopilot will update the listing with the approved business profile and pause only if the directory requires user validation.";
  }
  return "Autopilot will verify the public listing state through the directory workflow, then create, claim, or pause if user validation is required.";
}

function buildDirectoryPayload(profile: {
  businessName: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  description: string | null;
}, listing: {
  id: string;
  status: string;
  directory: {
    slug: string;
    name: string;
    url: string;
    submitUrl: string | null;
    claimUrl: string | null;
    tier: number;
    category: string;
    apiAvailable: boolean;
    isActive?: boolean;
  };
}) {
  const businessProfile = {
    name: profile.businessName,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    country: profile.country || "US",
    description: profile.description,
  };

  return {
    businessProfile,
    directory: {
      slug: listing.directory.slug,
      name: listing.directory.name,
      url: listing.directory.url,
      submitUrl: listing.directory.submitUrl,
      claimUrl: listing.directory.claimUrl,
      tier: listing.directory.tier,
      category: listing.directory.category,
      localPriority: getListSmartlyDirectoryPriority(listing.directory),
    },
    agentGoal: {
      mode: "public_web_workflow",
      objective:
        "Find, create, claim, or update the local business listing using the visible public workflow and the raw business profile data.",
      stopForUserOnlyWhen:
        "The live portal asks for email/SMS/phone verification, bot validation, payment, owner approval, or a required profile field that is not in the business profile/defaults.",
      pacing: "One account or listing workflow per day unless the user buys an extra run.",
    },
    steps: [
      "Research the directory requirements and public business listing state.",
      "Use the submit, claim, or public directory workflow.",
      "Create or claim the account using the approved business contact when allowed.",
      "Pause for email, SMS, or phone verification when required.",
      "Save the account details and verification status in ListSmartly.",
      "Validate the public listing URL after approval.",
    ],
  };
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

async function updateTaskProgress(
  taskId: string,
  stage: string,
  statusMessage: string,
  progressEvent: { label: string; status: "done" | "active" | "waiting" | "failed"; detail?: string },
  extra: Record<string, unknown> = {}
) {
  const task = await prisma.listSmartlyAutopilotTask.findUnique({
    where: { id: taskId },
    select: { result: true },
  });
  const current = parseJsonObject(task?.result);
  const preserveRetryState =
    isRetryableAgentResult(current) && progressEvent.status === "active" && stage !== "agent_browser_workflow_running";
  const next = appendProgress(
    {
      ...current,
      ...extra,
      ...(preserveRetryState ? {} : { stage, statusMessage }),
    },
    {
      stage,
      label: progressEvent.label,
      status: progressEvent.status,
      detail: progressEvent.detail,
    }
  );

  return prisma.listSmartlyAutopilotTask.update({
    where: { id: taskId },
    data: {
      result: safeJson(next),
      lastAttemptAt: new Date(),
    },
  });
}

async function probeDirectoryPortal(
  url: string | null
): Promise<{ reachable: boolean; links: string[]; finalUrl?: string; error?: string }> {
  if (!url) return { reachable: false, links: [] };

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(AUTOPILOT_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": AUTOPILOT_USER_AGENT },
    });
    const contentType = res.headers.get("content-type") || "";
    const links: string[] = [];

    if (contentType.includes("text/html")) {
      const html = (await res.text()).slice(0, 120000);
      const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
      for (const match of html.matchAll(linkPattern)) {
        const href = match[1] || "";
        const label = normalizeText((match[2] || "").replace(/<[^>]*>/g, " "));
        const combined = normalizeText(`${href} ${label}`);
        if (!/(claim|add|submit|business|listing|profile|login|sign in|sign up|register)/.test(combined)) {
          continue;
        }
        try {
          links.push(new URL(href, res.url).toString());
        } catch {
          // Ignore malformed page links; the portal probe itself still succeeded.
        }
        if (links.length >= 20) break;
      }
    }

    return { reachable: res.ok || res.status < 500, links: Array.from(new Set(links)), finalUrl: res.url };
  } catch (error) {
    return {
      reachable: false,
      links: [],
      error: error instanceof Error ? error.message : "Portal request failed",
    };
  }
}

function chooseAccountCreationUrl(
  listing: {
    directory: {
      name: string;
      url: string;
      submitUrl: string | null;
      claimUrl: string | null;
    };
  },
  research: DirectoryResearchResult
): string | null {
  const usableLinks = research.discoveredLinks.filter((link) => {
    return !/(privacy|legal|terms|cookie|status|blog|resources|learn|press|security|compliance)/i.test(link);
  });
  const preferred = usableLinks.find((link) => {
    return looksLikeAccountCreationUrl(link);
  });
  const secondary = usableLinks.find((link) => {
    return /(claim|submit|add)/i.test(link);
  });
  return (
    normalizeUrl(listing.directory.submitUrl) ||
    preferred ||
    normalizeUrl(listing.directory.claimUrl) ||
    secondary ||
    research.portalUrl ||
    normalizeUrl(listing.directory.url)
  );
}

async function inspectAccountCreationPage(
  url: string | null,
  profile: BusinessSignalInput,
  directoryName: string
): Promise<Omit<AccountCreationAttempt, "creationUrl">> {
  if (!url) {
    return {
      attempted: false,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      requiresUserAction: false,
      blocker: "missing_creation_url",
      blockerMessage: `No public create, claim, or sign-up URL was found for ${directoryName}.`,
      userActionTitle: `${directoryName} account creation path not found`,
      userActionMessage:
        `The agent could not find a safe public account-creation path for ${directoryName}. ` +
        "An admin needs to add the correct submit or claim URL before automation can continue.",
      userActionButtonLabel: "I added the portal URL",
    };
  }

  if (!profile.email) {
    return {
      attempted: true,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      requiresUserAction: true,
      blocker: "business_email_missing",
      blockerMessage: "The business profile does not have an email address for account creation.",
      userActionTitle: "Business email needed",
      userActionMessage:
        `Add the business email to ListSmartly so the agent can create or claim the ${directoryName} account with the approved business contact.`,
      userActionButtonLabel: "I added the business email",
    };
  }

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(AUTOPILOT_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": AUTOPILOT_USER_AGENT },
    });
    const html = (await res.text()).slice(0, 160000);
    const page = normalizeText(html);
    const hasCaptcha = /(captcha|recaptcha|hcaptcha|turnstile|cloudflare)/i.test(html);
    const hasPassword = /type=["']password["']|name=["'][^"']*password/i.test(html);
    const hasSso = hasSsoPrompt(html);
    const hasEmailField = /type=["']email["']|name=["'][^"']*(email|user(name)?)["']/i.test(html);
    const hasSignupLanguage = /(sign up|signup|free trial|create account|register|claim)/.test(page);
    const isSignupPath = looksLikeAccountCreationUrl(url);
    const hasClaimWorkflow = hasClaimWorkflowLanguage(`${url} ${page}`);

    if (!res.ok && res.status >= 400) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        requiresUserAction: false,
        blocker: "creation_page_unreachable",
        blockerMessage: `${directoryName} returned HTTP ${res.status} for the account creation page.`,
        userActionTitle: `${directoryName} account creation blocked`,
        userActionMessage:
          `${directoryName} did not return a usable account creation page to the agent. ` +
          "Open the portal manually once, then let the agent continue after access is confirmed.",
        userActionButtonLabel: "I confirmed portal access",
      };
    }

    if (hasCaptcha) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        requiresUserAction: false,
        blocker: "agent_browser_required",
        blockerMessage: `${directoryName} has protection-related markup. The AI browser agent must inspect the visible page before asking the user for anything.`,
        userActionTitle: `${directoryName} browser agent required`,
        userActionMessage:
          `The server fetch saw protection-related markup for ${directoryName}, but only the browser agent can confirm whether a real visible challenge exists.`,
        userActionButtonLabel: "Agent should continue",
      };
    }

    if ((hasEmailField && (hasSignupLanguage || isSignupPath)) || (isSignupPath && hasSignupLanguage)) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        requiresUserAction: false,
        blocker: "agent_browser_required",
        blockerMessage:
          `${directoryName} exposes an account creation flow. The AI browser agent should fill and submit it before asking for any verification code.`,
        userActionTitle: `${directoryName} browser agent ready`,
        userActionMessage:
          `The agent found the ${directoryName} sign-up flow and will continue with the approved business profile. It will ask only if the site sends a verification code or shows another real blocker.`,
        userActionButtonLabel: "Agent should continue",
      };
    }

    if (hasClaimWorkflow || (isSignupPath && hasSignupLanguage)) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        requiresUserAction: false,
        blocker: "browser_claim_workflow_required",
        blockerMessage:
          `${directoryName} exposes a public claim or sign-up workflow, but the form is dynamic and must be handled by the agent browser workflow before asking the user for anything.`,
        userActionTitle: `${directoryName} claim workflow found`,
        userActionMessage:
          `The agent found the ${directoryName} public claim or sign-up path. No account has been created yet, and no user action is required at this step. ` +
          "The next step belongs to the agent browser workflow; it should only ask you if the directory later requires email, SMS, phone, CAPTCHA, payment, or owner approval.",
        userActionButtonLabel: "Agent should continue",
      };
    }

    if (hasPassword || hasSso) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        requiresUserAction: true,
        blocker: hasPassword ? "account_credentials_required" : "sso_required",
        blockerMessage: `${directoryName} requires account credentials or SSO before an account can be created or claimed.`,
        userActionTitle: `${directoryName} credentials required`,
        userActionMessage:
          `The agent reached ${directoryName}, but account creation requires credentials, SSO, or a password flow. ` +
          "Provide approved account access in the ListSmartly portal or complete the directory step, then let the agent continue.",
        userActionButtonLabel: "I provided access",
      };
    }

    if (hasEmailField || hasSignupLanguage) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        requiresUserAction: true,
        blocker: "email_confirmation_required",
        blockerMessage:
          `${directoryName} exposes an account creation flow, but completing it can send email verification to ${profile.email}.`,
        userActionTitle: `${directoryName} email verification likely`,
        userActionMessage:
          `The agent found the ${directoryName} sign-up flow. To avoid creating an unverifiable account, confirm that ${profile.email} is monitored and ready for verification, then let the agent continue.`,
        userActionButtonLabel: "Email is ready",
      };
    }

    return {
      attempted: true,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      requiresUserAction: false,
      blocker: "manual_portal_review_required",
      blockerMessage: `${directoryName} did not expose a safe standard account creation form to the agent.`,
      userActionTitle: `${directoryName} portal review needed`,
      userActionMessage:
        `The agent opened the ${directoryName} portal, but the account creation controls are protected or dynamic. ` +
        "Confirm the portal access once, then let the agent continue.",
      userActionButtonLabel: "I reviewed the portal",
    };
  } catch (error) {
    return {
      attempted: true,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      requiresUserAction: false,
      blocker: "account_creation_request_failed",
      blockerMessage: error instanceof Error ? error.message : `${directoryName} account creation request failed.`,
      userActionTitle: `${directoryName} account creation could not continue`,
      userActionMessage:
        `The agent tried to open the ${directoryName} account creation path, but the request failed. ` +
        "Try the portal manually once, then let the agent continue.",
      userActionButtonLabel: "Portal is accessible now",
    };
  }
}

async function attemptAccountCreation(
  taskId: string,
  profile: BusinessSignalInput,
  listing: {
    directory: {
      name: string;
      url: string;
      submitUrl: string | null;
      claimUrl: string | null;
    };
  },
  research: DirectoryResearchResult
): Promise<AccountCreationAttempt> {
  const creationUrl = chooseAccountCreationUrl(listing, research);
  await updateTaskProgress(
    taskId,
    "attempting_account_creation",
    `Inspecting the ${listing.directory.name} create, sign-up, or claim path before asking the user for help.`,
    {
      label: "Portal workflow inspection",
      status: "active",
      detail: creationUrl || "No account creation URL found yet.",
    },
    {
      creationUrl,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
    }
  );

  const inspection = await inspectAccountCreationPage(creationUrl, profile, listing.directory.name);

  await updateTaskProgress(
    taskId,
    "account_creation_blocked",
    inspection.blockerMessage,
    {
      label: inspection.requiresUserAction ? "User validation required" : "Agent follow-up needed",
      status: inspection.requiresUserAction ? "waiting" : "active",
      detail: inspection.blockerMessage,
    },
    {
      creationUrl,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      accountCreationBlocker: inspection.blocker,
    }
  );

  return { ...inspection, creationUrl };
}

async function waitForBrowserSettled(page: any, timeout = 12000) {
  try {
    await page.waitForNetworkIdle({ idleTime: 700, timeout });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
}

async function getBrowserSnapshot(page: any) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const controlLabel = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
      const id = el.getAttribute("id");
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
      const parentLabel = el.closest("label")?.textContent || "";
      return [
        label,
        parentLabel,
        el.getAttribute("aria-label") || "",
        el.getAttribute("placeholder") || "",
        el.getAttribute("name") || "",
        el.getAttribute("autocomplete") || "",
        id || "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    };
    const controls = Array.from(document.querySelectorAll("input, textarea, select"))
      .filter((el) => visible(el))
      .map((el: any, index) => ({
        index,
        tag: el.tagName,
        type: (el.getAttribute("type") || "").toLowerCase(),
        name: el.getAttribute("name") || "",
        id: el.getAttribute("id") || "",
        placeholder: el.getAttribute("placeholder") || "",
        autocomplete: el.getAttribute("autocomplete") || "",
        label: controlLabel(el),
        value: el.value || "",
        required: Boolean(el.required || el.getAttribute("aria-required") === "true"),
      }));
    const buttons = Array.from(document.querySelectorAll("button, a, input[type=submit], input[type=button]"))
      .filter((el) => visible(el))
      .map((el: any, index) => ({
        index,
        tag: el.tagName,
        text: (el.innerText || el.getAttribute("value") || el.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim(),
        href: el.href || "",
        type: el.getAttribute("type") || "",
      }))
      .filter((item) => item.text || item.href);
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    return {
      url: location.href,
      title: document.title,
      text: text.slice(0, 6000),
      controls,
      buttons,
      hasCaptcha: /(captcha|recaptcha|hcaptcha|turnstile|cloudflare challenge)/i.test(text + " " + document.body.innerHTML),
      hasEmailVerification: /(verify your email|verification code|check your email|confirmation email|email has been sent|enter the code)/i.test(text),
      hasPhoneVerification: /(verify your phone|sms code|text message|phone verification|call you)/i.test(text),
      hasPayment: /(payment|credit card|checkout|billing information|expedite)/i.test(text),
      hasInvalidBusinessEmail: /(business email|required.*business email|valid business email|work email|company email|invalid email)/i.test(text),
      hasRequiredError: /(required|missing|invalid|please enter|please select)/i.test(text),
    };
  });
}

async function clickBrowserControl(page: any, patterns: RegExp[], options: { avoid?: RegExp[] } = {}) {
  return page.evaluate(
    ({ patternSources, avoidSources }: { patternSources: string[]; avoidSources: string[] }) => {
      const patterns = patternSources.map((source) => new RegExp(source, "i"));
      const avoid = avoidSources.map((source) => new RegExp(source, "i"));
      const visible = (el: Element) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const candidates = Array.from(document.querySelectorAll("button, a, input[type=submit], input[type=button]")) as HTMLElement[];
      for (const el of candidates) {
        if (!visible(el)) continue;
        const text = (
          el.innerText ||
          el.getAttribute("value") ||
          el.getAttribute("aria-label") ||
          (el as HTMLAnchorElement).href ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim();
        if (!text) continue;
        if (avoid.some((pattern) => pattern.test(text))) continue;
        if (!patterns.some((pattern) => pattern.test(text))) continue;
        el.click();
        return { clicked: true, text, href: (el as HTMLAnchorElement).href || "" };
      }
      return { clicked: false, text: "", href: "" };
    },
    {
      patternSources: patterns.map((pattern) => pattern.source),
      avoidSources: (options.avoid || []).map((pattern) => pattern.source),
    }
  );
}

async function fillBrowserForm(page: any, profile: BusinessSignalInput, generatedPassword: string) {
  const { firstName, lastName } = splitContactName(profile);
  return page.evaluate(
    ({ values }: { values: Record<string, string> }) => {
      const visible = (el: Element) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
        const prototype = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const labelFor = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
        const id = el.getAttribute("id");
        const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
        const implicit = el.closest("label")?.textContent || "";
        return [
          explicit,
          implicit,
          el.getAttribute("aria-label") || "",
          el.getAttribute("placeholder") || "",
          el.getAttribute("name") || "",
          el.getAttribute("id") || "",
          el.getAttribute("autocomplete") || "",
        ]
          .join(" ")
          .toLowerCase();
      };
      const filled: string[] = [];
      const missingRequired: string[] = [];
      const inputs = Array.from(document.querySelectorAll("input, textarea")) as Array<HTMLInputElement | HTMLTextAreaElement>;
      for (const input of inputs) {
        if (!visible(input) || input.disabled || input.readOnly) continue;
        const type = (input.getAttribute("type") || "text").toLowerCase();
        if (["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type)) continue;
        if (input.value) continue;
        const label = labelFor(input);
        let value = "";
        if (type === "email" || /\b(e-?mail|email address|business email|work email)\b/.test(label)) value = values.email;
        else if (type === "password" || /password/.test(label)) value = values.password;
        else if (/first name|given name/.test(label)) value = values.firstName;
        else if (/last name|surname|family name/.test(label)) value = values.lastName;
        else if (/full name|your name|contact name|owner name|president|ceo/.test(label)) value = values.fullName;
        else if (/business name|company name|organization|legal name|business legal/.test(label)) value = values.businessName;
        else if (/phone|telephone|mobile/.test(label)) value = values.phone;
        else if (/street|address line 1|business address|mailing address/.test(label)) value = values.address;
        else if (/\bcity\b/.test(label)) value = values.city;
        else if (/\bstate\b|province|region/.test(label)) value = values.state;
        else if (/zip|postal/.test(label)) value = values.zip;
        else if (/website|url|domain/.test(label)) value = values.website;
        else if (/industry|category|business type/.test(label)) value = values.industry;
        else if (/year founded|founded|established/.test(label)) value = values.yearFounded;
        else if (/description|about|summary/.test(label)) value = values.description;

        if (value) {
          setValue(input, value);
          filled.push(label.replace(/\s+/g, " ").trim().slice(0, 80));
        } else if (input.required || input.getAttribute("aria-required") === "true") {
          missingRequired.push(label.replace(/\s+/g, " ").trim().slice(0, 80) || type);
        }
      }

      const selects = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
      for (const select of selects) {
        if (!visible(select) || select.disabled || select.value) continue;
        const label = labelFor(select);
        let desired = "";
        if (/country/.test(label)) desired = values.country || "United States";
        else if (/state|province|region/.test(label)) desired = values.state;
        else if (/industry|category|business type/.test(label)) desired = values.industry;
        if (!desired) continue;
        const option = Array.from(select.options).find((item) => {
          const text = `${item.textContent || ""} ${item.value || ""}`.toLowerCase();
          return text.includes(desired.toLowerCase()) || (desired === "US" && /united states|usa|\bus\b/.test(text));
        });
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          filled.push(label.replace(/\s+/g, " ").trim().slice(0, 80));
        }
      }
      return { filled, missingRequired };
    },
    {
      values: {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        businessName: profile.businessName || "",
        email: profile.email || "",
        password: generatedPassword,
        phone: profile.phone || "",
        website: profile.website || "",
        address: profile.address || "",
        city: profile.city || "",
        state: profile.state || "",
        zip: profile.zip || "",
        country: profile.country || "United States",
        industry: profile.industry || "",
        yearFounded: profile.yearFounded || "",
        description: profile.description || "",
      },
    }
  );
}

function browserOutcomeForValidation(params: {
  status: BrowserWorkflowOutcome["status"];
  stage: string;
  portalUrl: string;
  message: string;
  actionTitle: string;
  actionButtonLabel: string;
  accountCreated?: boolean;
  generatedPassword?: string;
  passwordHint?: string;
  diagnostics?: Record<string, unknown>;
}): BrowserWorkflowOutcome {
  return {
    status: params.status,
    stage: params.stage,
    portalUrl: params.portalUrl,
    message: params.message,
    actionTitle: params.actionTitle,
    actionButtonLabel: params.actionButtonLabel,
    accountCreated: Boolean(params.accountCreated),
    credentialSaved: Boolean(params.generatedPassword),
    emailSentByFlowSmartly: false,
    generatedPassword: params.generatedPassword,
    passwordHint: params.passwordHint,
    diagnostics: params.diagnostics,
  };
}

async function runBrowserSignupWorkflow(params: {
  profile: BusinessSignalInput;
  directoryName: string;
  directorySlug?: string | null;
  startUrl: string;
}): Promise<BrowserWorkflowOutcome> {
  const { profile, directoryName, directorySlug, startUrl } = params;
  const generatedPassword = generateAutopilotPassword();
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(AUTOPILOT_BROWSER_TIMEOUT_MS);
    await page.setViewport({ width: 1365, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    );
    await page.evaluateOnNewDocument("window.__name = function(fn) { return fn; };");
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: AUTOPILOT_BROWSER_TIMEOUT_MS });
    await page.addScriptTag({ content: "window.__name = function(fn) { return fn; };" }).catch(() => undefined);
    await waitForBrowserSettled(page);

    await clickBrowserControl(page, [/agree.+proceed|required only|accept/i]);
    await waitForBrowserSettled(page, 5000);

    void directorySlug;
    const signupClick = await clickBrowserControl(
      page,
      [/sign up with email|sign up|create account|register|claim|add business|add listing|get started/i],
      { avoid: [/google|microsoft|office|facebook|apple|sign in|log in|login|sso|back/i] }
    );
    if (signupClick.clicked) await waitForBrowserSettled(page, 12000);

    let lastSnapshot = await getBrowserSnapshot(page);
    const filledSteps: Array<Record<string, unknown>> = [];

    for (let step = 0; step < 3; step++) {
      lastSnapshot = await getBrowserSnapshot(page);

      if (lastSnapshot.hasCaptcha) {
        return browserOutcomeForValidation({
          status: "needs_user",
          stage: "waiting_for_captcha",
          portalUrl: lastSnapshot.url,
          message: `${directoryName} is showing CAPTCHA or bot protection. The agent stopped and needs the user to complete that challenge in the portal before it continues.`,
          actionTitle: `${directoryName} CAPTCHA required`,
          actionButtonLabel: "I completed the CAPTCHA",
          generatedPassword: step > 0 ? generatedPassword : undefined,
          passwordHint: step > 0 ? "Generated by FlowSmartly for this directory sign-up." : undefined,
          diagnostics: { title: lastSnapshot.title, step },
        });
      }

      if (lastSnapshot.hasEmailVerification) {
        return browserOutcomeForValidation({
          status: "needs_user",
          stage: "waiting_for_email_verification",
          portalUrl: lastSnapshot.url,
          message: `${directoryName} accepted the sign-up step and is asking for email verification. Check ${profile.email}, complete the verification, then return to ListSmartly so the agent can continue.`,
          actionTitle: `Verify ${directoryName} email`,
          actionButtonLabel: "I verified the email",
          accountCreated: true,
          generatedPassword,
          passwordHint: "Generated by FlowSmartly for this directory sign-up.",
          diagnostics: { title: lastSnapshot.title, step },
        });
      }

      const fill = await fillBrowserForm(page, profile, generatedPassword);
      filledSteps.push({ step, url: lastSnapshot.url, filled: fill.filled, missingRequired: fill.missingRequired });
      await waitForBrowserSettled(page, 3000);

      const hasVisibleControls = lastSnapshot.controls.some((control: { type?: string; tag?: string }) => {
        const type = (control.type || "").toLowerCase();
        return !["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type);
      });

      if (fill.filled.length === 0 && !hasVisibleControls) {
        const nextClick = await clickBrowserControl(
          page,
          [/continue|next|submit|start|create account|sign up|get started|claim|apply/i],
          { avoid: [/back|cancel|sign in|log in|login|google|microsoft|office|apple|facebook/i] }
        );
        if (!nextClick.clicked) break;
        await waitForBrowserSettled(page, 12000);
        continue;
      }

      const submit = await clickBrowserControl(
        page,
        [/continue|next|submit|create account|sign up|start application|apply|get started|claim/i],
        { avoid: [/back|cancel|sign in|log in|login|google|microsoft|office|apple|facebook/i] }
      );
      if (!submit.clicked) {
        if (fill.missingRequired.length > 0) {
          return browserOutcomeForValidation({
            status: "needs_user",
            stage: "waiting_for_missing_business_data",
            portalUrl: lastSnapshot.url,
            message: `${directoryName} needs additional required fields that are not saved in the ListSmartly profile: ${fill.missingRequired.join(", ")}.`,
            actionTitle: `${directoryName} needs profile data`,
            actionButtonLabel: "I added the missing data",
            generatedPassword,
            passwordHint: "Generated by FlowSmartly for this directory sign-up.",
            diagnostics: { title: lastSnapshot.title, filledSteps },
          });
        }
        break;
      }

      await waitForBrowserSettled(page, 15000);
      const afterSubmit = await getBrowserSnapshot(page);

      if (afterSubmit.hasInvalidBusinessEmail) {
        return browserOutcomeForValidation({
          status: "needs_user",
          stage: "waiting_for_business_email",
          portalUrl: afterSubmit.url,
          message: `${directoryName} rejected or requested a valid business/work email. Update the ListSmartly business email, then the agent can retry the sign-up.`,
          actionTitle: `${directoryName} needs a business email`,
          actionButtonLabel: "I updated the email",
          generatedPassword,
          passwordHint: "Generated by FlowSmartly for this directory sign-up.",
          diagnostics: { title: afterSubmit.title, filledSteps },
        });
      }

      if (afterSubmit.hasEmailVerification) {
        return browserOutcomeForValidation({
          status: "needs_user",
          stage: "waiting_for_email_verification",
          portalUrl: afterSubmit.url,
          message: `${directoryName} accepted the sign-up step and is asking for email verification. Check ${profile.email}, complete the verification, then return to ListSmartly so the agent can continue.`,
          actionTitle: `Verify ${directoryName} email`,
          actionButtonLabel: "I verified the email",
          accountCreated: true,
          generatedPassword,
          passwordHint: "Generated by FlowSmartly for this directory sign-up.",
          diagnostics: { title: afterSubmit.title, filledSteps },
        });
      }

      if (afterSubmit.hasPhoneVerification) {
        return browserOutcomeForValidation({
          status: "needs_user",
          stage: "waiting_for_phone_verification",
          portalUrl: afterSubmit.url,
          message: `${directoryName} advanced to phone or SMS verification. Complete that validation, then the agent can continue.`,
          actionTitle: `${directoryName} phone verification`,
          actionButtonLabel: "I completed phone verification",
          accountCreated: true,
          generatedPassword,
          passwordHint: "Generated by FlowSmartly for this directory sign-up.",
          diagnostics: { title: afterSubmit.title, filledSteps },
        });
      }

      if (afterSubmit.hasPayment) {
        return browserOutcomeForValidation({
          status: "needs_user",
          stage: "waiting_for_payment_or_owner_choice",
          portalUrl: afterSubmit.url,
          message: `${directoryName} advanced to a payment, expedite, or owner approval choice. The agent stopped so the user can make that decision.`,
          actionTitle: `${directoryName} user decision needed`,
          actionButtonLabel: "I completed the decision",
          accountCreated: true,
          generatedPassword,
          passwordHint: "Generated by FlowSmartly for this directory sign-up.",
          diagnostics: { title: afterSubmit.title, filledSteps },
        });
      }
    }

    const finalSnapshot = await getBrowserSnapshot(page);
    return browserOutcomeForValidation({
      status: "pending",
      stage: "agent_browser_workflow_running",
      portalUrl: finalSnapshot.url,
      message: `${directoryName} was opened in the agent browser and the available public fields were processed. The workflow is still on a dynamic directory step, so the agent will keep it in progress instead of asking the user for fake credentials.`,
      actionTitle: `${directoryName} browser workflow running`,
      actionButtonLabel: "Agent should continue",
      generatedPassword,
      passwordHint: "Generated by FlowSmartly for this directory sign-up.",
      diagnostics: { title: finalSnapshot.title, filledSteps },
    });
  } catch (error) {
    return browserOutcomeForValidation({
      status: "pending",
      stage: "agent_browser_retry_needed",
      portalUrl: startUrl,
      message:
        `${directoryName} could not finish the browser step in this run: ` +
        (error instanceof Error ? error.message : "Unknown browser workflow error") +
        ". The task remains assigned to the agent for a later retry; no user action is required yet.",
      actionTitle: `${directoryName} browser retry queued`,
      actionButtonLabel: "Agent should retry",
      diagnostics: { error: error instanceof Error ? error.message : String(error) },
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function saveAgentGeneratedCredential(params: {
  profileId: string;
  listingId: string | null;
  directoryName: string;
  loginUrl: string;
  accountEmail: string | null | undefined;
  generatedPassword: string;
  passwordHint?: string;
  verificationStatus: string;
}) {
  const secureNotes = encryptSecureNote(
    [
      `Generated password: ${params.generatedPassword}`,
      `Generated by FlowSmartly ListSmartly Autopilot on ${new Date().toISOString()}.`,
      "Use only for the associated directory account. Rotate it in the directory portal when ownership is fully verified.",
    ].join("\n")
  );

  if (params.listingId) {
    return prisma.listSmartlyAccountCredential.upsert({
      where: { listingId: params.listingId },
      update: {
        directoryName: params.directoryName,
        loginUrl: params.loginUrl,
        accountEmail: params.accountEmail || null,
        username: params.accountEmail || null,
        passwordHint: params.passwordHint || "Generated by FlowSmartly Autopilot.",
        secureNotes,
        verificationStatus: params.verificationStatus,
        status: "active",
        createdBy: "agent",
      },
      create: {
        profileId: params.profileId,
        listingId: params.listingId,
        directoryName: params.directoryName,
        loginUrl: params.loginUrl,
        accountEmail: params.accountEmail || null,
        username: params.accountEmail || null,
        passwordHint: params.passwordHint || "Generated by FlowSmartly Autopilot.",
        secureNotes,
        verificationStatus: params.verificationStatus,
        status: "active",
        createdBy: "agent",
      },
    });
  }

  return prisma.listSmartlyAccountCredential.create({
    data: {
      profileId: params.profileId,
      directoryName: params.directoryName,
      loginUrl: params.loginUrl,
      accountEmail: params.accountEmail || null,
      username: params.accountEmail || null,
      passwordHint: params.passwordHint || "Generated by FlowSmartly Autopilot.",
      secureNotes,
      verificationStatus: params.verificationStatus,
      status: "active",
      createdBy: "agent",
    },
  });
}

async function runAgentBrowserWorkflow(
  userId: string,
  profile: BusinessSignalInput & { id: string },
  task: {
    id: string;
    title: string;
    result: string;
    listingId: string | null;
    listing: {
      id: string;
      status: string;
      directory: {
        name: string;
        url: string;
        submitUrl: string | null;
        claimUrl: string | null;
        slug?: string | null;
      };
    } | null;
  },
  existingResult: Record<string, unknown>,
  continuation: ListSmartlyAgentContinuation = {}
) {
  if (!task.listing) {
    return { status: "failed", message: "Listing record missing.", task };
  }

  const startUrl =
    (typeof existingResult.portalUrl === "string" && existingResult.portalUrl) ||
    (typeof existingResult.creationUrl === "string" && existingResult.creationUrl) ||
    normalizeUrl(task.listing.directory.submitUrl) ||
    normalizeUrl(task.listing.directory.claimUrl) ||
    normalizeUrl(task.listing.directory.url);

  if (!startUrl) {
    const message = `${task.listing.directory.name} has no usable public workflow URL configured.`;
    const result = appendProgress(
      {
        ...existingResult,
        stage: "blocked_missing_portal_url",
        statusMessage: message,
      },
      {
        stage: "blocked_missing_portal_url",
        label: "Portal URL missing",
        status: "failed",
        detail: message,
      }
    );
    const blocked = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "blocked",
        assignedTo: "admin",
        requiredAction: message,
        failureReason: message,
        result: safeJson(result),
      },
    });
    return { status: "blocked", message, task: blocked };
  }

  await updateTaskProgress(
    task.id,
    "agent_browser_workflow_running",
    `Opening ${task.listing.directory.name} in the agent browser and processing the public submit or claim workflow.`,
    {
      label: "Agent browser opened",
      status: "active",
      detail: startUrl,
    },
    {
      portalUrl: startUrl,
      agentAttemptedAccountCreation: true,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      accountCreationBlocker: null,
      userActionTitle: null,
      userActionMessage: null,
      userActionButtonLabel: null,
      browserDiagnostics: null,
    }
  );

  const savedCredential = await getSavedDirectoryCredential({
    profileId: profile.id,
    listingId: task.listingId,
    directoryName: task.listing.directory.name,
  });
  const agentContinuation: ListSmartlyAgentContinuation = {
    ...continuation,
    savedLoginEmail: savedCredential?.email || profile.email || null,
    savedLoginPassword: savedCredential?.password || null,
  };

  let outcome = await runClaudeListSmartlyBrowserAgent({
    profile,
    directoryName: task.listing.directory.name,
    directorySlug: task.listing.directory.slug,
    startUrl,
    workflowId: task.id,
    continuation: agentContinuation,
    onProgress: async (event) => {
      await updateTaskProgress(
        task.id,
        event.stage,
        event.detail || `ListSmartly agent is working on ${task.listing?.directory.name}.`,
        {
          label: event.label,
          status: event.status,
          detail: event.detail,
        },
        {
          ...(event.extra || {}),
          agentEngine: "claude_agent_sdk",
          agentAttemptedAccountCreation: true,
        }
      );
    },
  });
  if (
    outcome.status === "blocked" &&
    /(sign in|reset your password|already has|existing account|account creation restriction)/i.test(outcome.message)
  ) {
    outcome = {
      ...outcome,
      status: "needs_user",
      stage: "waiting_for_approved_access",
      actionTitle: `${task.listing.directory.name} account access needed`,
      actionButtonLabel: "I provided access",
      message:
        `${task.listing.directory.name} says this email already has an account or requires password reset. ` +
        "The agent tried the saved credential when one was available. Reset or approve access for this directory account, then continue in ListSmartly and the agent will resume the listing workflow.",
    };
  }

  const current = parseJsonObject((await prisma.listSmartlyAutopilotTask.findUnique({
    where: { id: task.id },
    select: { result: true },
  }))?.result);

  let credentialSaved = false;
  if (outcome.accountCreated && outcome.generatedPassword) {
    await saveAgentGeneratedCredential({
      profileId: profile.id,
      listingId: task.listingId,
      directoryName: task.listing.directory.name,
      loginUrl: outcome.portalUrl || task.listing.directory.url,
      accountEmail: profile.email,
      generatedPassword: outcome.generatedPassword,
      passwordHint: outcome.passwordHint,
      verificationStatus: outcome.stage === "waiting_for_email_verification" ? "email_required" : "pending",
    });
    credentialSaved = true;
  }

  if (outcome.status === "needs_user") {
    const previousVerificationAttempts =
      typeof current.verificationCodeAttemptCount === "number" ? current.verificationCodeAttemptCount : 0;
    const verificationCodeAttemptCount = outcome.verificationCodeAttempted
      ? previousVerificationAttempts + 1
      : previousVerificationAttempts;
    const diagnostics =
      outcome.diagnostics && typeof outcome.diagnostics === "object" ? outcome.diagnostics : {};
    const waitingResult = appendProgress(
      {
        ...current,
        stage: outcome.stage,
        statusMessage: outcome.message,
        agentAttemptedAccountCreation: true,
        accountCreated: outcome.accountCreated,
        credentialSaved,
        emailSentByFlowSmartly: outcome.emailSentByFlowSmartly,
        verificationCodeAttempted: outcome.verificationCodeAttempted,
        verificationCodeAttemptCount,
        accountCreationBlocker: outcome.stage,
        userActionTitle: outcome.actionTitle,
        userActionMessage: outcome.message,
        userActionButtonLabel: outcome.actionButtonLabel,
        userActionInputKind: outcome.actionInputKind,
        userActionInputLabel: outcome.actionInputLabel,
        userActionInputPlaceholder: outcome.actionInputPlaceholder,
        userActionInputRequired: outcome.actionInputRequired,
        browserSessionHeld: Boolean((diagnostics as { browserSessionHeld?: unknown }).browserSessionHeld),
        browserSessionResumed: Boolean((diagnostics as { browserSessionResumed?: unknown }).browserSessionResumed),
        browserSessionExpiresAt:
          typeof (diagnostics as { browserSessionExpiresAt?: unknown }).browserSessionExpiresAt === "string"
            ? (diagnostics as { browserSessionExpiresAt: string }).browserSessionExpiresAt
            : undefined,
        portalUrl: outcome.portalUrl,
        browserDiagnostics: outcome.diagnostics,
      },
      {
        stage: outcome.stage,
        label:
          outcome.stage === "waiting_for_email_verification"
            ? "Email verification needed"
            : outcome.stage === "waiting_for_business_email"
              ? "Business email needed"
              : "User validation needed",
        status: "waiting",
        detail: outcome.message,
      }
    );

    const needsUser = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "needs_user",
        assignedTo: "user",
        requiredAction: outcome.message,
        failureReason: null,
        result: safeJson(waitingResult),
      },
    });

    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: outcome.actionTitle,
      message: outcome.message,
      actionUrl: "/listsmartly/dashboard",
      data: { feature: "listsmartly", taskId: task.id, portalUrl: outcome.portalUrl },
    });

    return { status: "needs_user", message: outcome.message, task: needsUser };
  }

  if (outcome.status === "blocked") {
    const blockedResult = appendProgress(
      {
        ...current,
        stage: outcome.stage,
        statusMessage: outcome.message,
        agentAttemptedAccountCreation: true,
        accountCreated: outcome.accountCreated,
        credentialSaved,
        emailSentByFlowSmartly: outcome.emailSentByFlowSmartly,
        verificationCodeAttempted: outcome.verificationCodeAttempted,
        accountCreationBlocker: outcome.stage,
        userActionTitle: outcome.actionTitle,
        userActionMessage: outcome.message,
        userActionButtonLabel: outcome.actionButtonLabel,
        userActionInputKind: outcome.actionInputKind,
        userActionInputLabel: outcome.actionInputLabel,
        userActionInputPlaceholder: outcome.actionInputPlaceholder,
        userActionInputRequired: outcome.actionInputRequired,
        portalUrl: outcome.portalUrl,
        browserDiagnostics: outcome.diagnostics,
      },
      {
        stage: outcome.stage,
        label: "Agent blocked",
        status: "failed",
        detail: outcome.message,
      }
    );

    const blocked = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "blocked",
        assignedTo: "admin",
        requiredAction: outcome.message,
        failureReason: outcome.message,
        result: safeJson(blockedResult),
      },
    });

    return { status: "blocked", message: outcome.message, task: blocked };
  }

  if (outcome.status === "submitted") {
    if (task.listingId) {
      await prisma.businessListing.update({
        where: { id: task.listingId },
        data: {
          status: "submitted",
          listingUrl: outcome.portalUrl,
          submittedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
      });
    }

    const completedResult = appendProgress(
      {
        ...current,
        stage: "completed",
        statusMessage: outcome.message,
        agentAttemptedAccountCreation: true,
        accountCreated: outcome.accountCreated,
        credentialSaved,
        emailSentByFlowSmartly: false,
        verificationCodeAttempted: outcome.verificationCodeAttempted,
        portalUrl: outcome.portalUrl,
        browserDiagnostics: outcome.diagnostics,
        completedAt: new Date().toISOString(),
      },
      {
        stage: "completed",
        label: "Submission complete",
        status: "done",
        detail: outcome.message,
      }
    );

    const completed = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        assignedTo: "agent",
        requiredAction: null,
        failureReason: null,
        completedAt: new Date(),
        result: safeJson(completedResult),
      },
    });

    return { status: "completed", message: outcome.message, task: completed };
  }

  const pendingDiagnostics =
    outcome.diagnostics && typeof outcome.diagnostics === "object" ? outcome.diagnostics : {};
  const pendingNeedsRetry = isRetryableAgentStage(outcome.stage);
  const pendingResult = appendProgress(
    {
      ...current,
      stage: outcome.stage,
      statusMessage: outcome.message,
      agentAttemptedAccountCreation: true,
      accountCreated: false,
      credentialSaved: false,
      emailSentByFlowSmartly: false,
      verificationCodeAttempted: outcome.verificationCodeAttempted,
      accountCreationBlocker: outcome.stage,
      userActionTitle: outcome.actionTitle,
      userActionMessage: outcome.message,
      userActionButtonLabel: outcome.actionButtonLabel,
      userActionInputKind: outcome.actionInputKind,
      userActionInputLabel: outcome.actionInputLabel,
      userActionInputPlaceholder: outcome.actionInputPlaceholder,
      userActionInputRequired: outcome.actionInputRequired,
      browserSessionHeld: Boolean((pendingDiagnostics as { browserSessionHeld?: unknown }).browserSessionHeld),
      browserSessionResumed: Boolean((pendingDiagnostics as { browserSessionResumed?: unknown }).browserSessionResumed),
      browserSessionExpiresAt:
        typeof (pendingDiagnostics as { browserSessionExpiresAt?: unknown }).browserSessionExpiresAt === "string"
          ? (pendingDiagnostics as { browserSessionExpiresAt: string }).browserSessionExpiresAt
          : null,
      portalUrl: outcome.portalUrl,
      browserDiagnostics: outcome.diagnostics,
    },
    {
      stage: outcome.stage,
      label: pendingNeedsRetry ? "Agent retry needed" : "Agent browser working",
      status: pendingNeedsRetry ? "waiting" : "active",
      detail: outcome.message,
    }
  );

  const pending = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "in_progress",
      assignedTo: "agent",
      requiredAction:
        pendingNeedsRetry
          ? "The browser agent run ended before a final decision. Retry the agent to continue from the live browser state."
          : "The agent browser workflow is still responsible for this directory. No user action is required yet.",
      failureReason: null,
      result: safeJson(pendingResult),
    },
  });

  return { status: "pending_agent_browser", message: outcome.message, task: pending };
}

async function findPublicDirectoryMatch(
  profile: BusinessSignalInput,
  directory: { name: string; url: string }
): Promise<{ searched: boolean; match: SearchCandidate | null; error?: string }> {
  const apiKey = getGoogleApiKey();
  const searchCx = getGoogleSearchCx();
  const domain = extractDomain(directory.url);
  if (!apiKey || !searchCx || !domain) {
    return { searched: false, match: null, error: "Google Custom Search is not configured for directory lookup." };
  }

  const phone = normalizePhone(profile.phone);
  const websiteDomain = profile.website ? extractDomain(profile.website) : "";
  const queries = [
    `site:${domain} "${profile.businessName}"`,
    phone ? `site:${domain} "${phone}"` : "",
    websiteDomain ? `site:${domain} "${websiteDomain}"` : "",
    profile.address ? `site:${domain} "${profile.address}" "${profile.city || ""}"` : "",
  ].filter(Boolean);

  const candidates: SearchCandidate[] = [];
  for (const query of queries) {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", searchCx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "5");

    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(AUTOPILOT_FETCH_TIMEOUT_MS),
        headers: { "User-Agent": AUTOPILOT_USER_AGENT },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: Array<{ link: string; title?: string; snippet?: string }> };
      for (const item of data.items || []) {
        if (!item.link || !extractDomain(item.link).endsWith(domain)) continue;
        candidates.push({
          ...item,
          score: scoreSearchCandidate(profile, item),
          source: "google_custom_search",
        });
      }
    } catch (error) {
      return {
        searched: candidates.length > 0,
        match: candidates.sort((a, b) => b.score - a.score)[0] || null,
        error: error instanceof Error ? error.message : "Directory search failed",
      };
    }
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0] || null;
  return { searched: true, match: best && best.score >= MIN_DIRECTORY_MATCH_SCORE ? best : null };
}

async function researchDirectoryWorkflow(profile: BusinessSignalInput, listing: {
  directory: {
    name: string;
    url: string;
    submitUrl: string | null;
    claimUrl: string | null;
  };
}): Promise<DirectoryResearchResult> {
  const portalCandidates = Array.from(
    new Set(
      [
        normalizeUrl(listing.directory.submitUrl),
        normalizeUrl(listing.directory.claimUrl),
        normalizeUrl(listing.directory.url),
      ].filter((url): url is string => Boolean(url))
    )
  );
  const fallbackPortalUrl = portalCandidates[0] || null;

  const [portalResults, search] = await Promise.all([
    Promise.all(portalCandidates.map((url) => probeDirectoryPortal(url))),
    findPublicDirectoryMatch(profile, listing.directory),
  ]);
  const reachablePortalIndex = portalResults.findIndex((portal) => portal.reachable);
  const primaryPortal = reachablePortalIndex >= 0 ? portalResults[reachablePortalIndex] : portalResults[0];
  const portalUrl =
    primaryPortal?.finalUrl ||
    (reachablePortalIndex >= 0 ? portalCandidates[reachablePortalIndex] : fallbackPortalUrl);
  const discoveredLinks = Array.from(new Set(portalResults.flatMap((portal) => portal.links)));

  return {
    portalUrl,
    portalReachable: portalResults.some((portal) => portal.reachable),
    discoveredLinks,
    searched: search.searched,
    match: search.match,
    error: portalResults.find((portal) => portal.error)?.error || search.error,
  };
}

async function markListingLiveFromAutopilot(
  listingId: string,
  listingUrl: string,
  oldStatus: string | null,
  source: string
) {
  await prisma.businessListing.update({
    where: { id: listingId },
    data: {
      status: "live",
      listingUrl,
      isConsistent: true,
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  });

  if (oldStatus !== "live") {
    await prisma.listingChange.create({
      data: {
        listingId,
        changeType: "autopilot",
        fieldChanged: "status",
        oldValue: oldStatus,
        newValue: "live",
        changedBy: source,
      },
    });
  }
}

async function markListingMissingFromAutopilot(listingId: string, oldStatus: string | null, source: string) {
  await prisma.businessListing.update({
    where: { id: listingId },
    data: {
      status: "missing",
      lastCheckedAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  });

  if (oldStatus !== "missing") {
    await prisma.listingChange.create({
      data: {
        listingId,
        changeType: "autopilot",
        fieldChanged: "status",
        oldValue: oldStatus,
        newValue: "missing",
        changedBy: source,
      },
    });
  }
}

async function pauseStaleAutopilotTasks(profileId: string, visibleTaskWhere: Prisma.ListSmartlyAutopilotTaskWhereInput) {
  const staleBefore = new Date(Date.now() - AUTOPILOT_STALE_IN_PROGRESS_MS);
  const staleTasks = await prisma.listSmartlyAutopilotTask.findMany({
    where: {
      ...visibleTaskWhere,
      profileId,
      status: "in_progress",
      updatedAt: { lt: staleBefore },
    },
    select: { id: true, title: true, result: true, updatedAt: true },
    take: 10,
  });

  if (staleTasks.length === 0) return 0;

  await Promise.all(
    staleTasks.map((task) => {
      const existingResult = parseJsonObject(task.result);
      const progress = Array.isArray(existingResult.progress) ? existingResult.progress : [];
      const pausedAt = new Date().toISOString();

      return prisma.listSmartlyAutopilotTask.update({
        where: { id: task.id },
        data: {
          status: "blocked",
          assignedTo: "admin",
          failureReason: "The agent workflow stopped updating and was paused for admin review.",
          requiredAction:
            "FlowSmartly paused this workflow because the browser agent did not update it for more than 60 minutes. Support can retry it or provide manual next steps.",
          result: safeJson({
            ...existingResult,
            stage: "agent_review_needed",
            statusMessage:
              "Paused for admin review because the workflow stopped updating for more than 60 minutes.",
            stalePausedAt: pausedAt,
            staleLastUpdatedAt: task.updatedAt.toISOString(),
            progress: [
              ...progress,
              {
                stage: "agent_review_needed",
                label: "Paused for admin review",
                status: "blocked",
                detail: "The workflow stopped updating for more than 60 minutes.",
                at: pausedAt,
              },
            ],
          }),
        },
      });
    })
  );

  return staleTasks.length;
}

async function completeInactiveDirectoryTasks(profileId: string): Promise<number> {
  const now = new Date();
  const result = await prisma.listSmartlyAutopilotTask.updateMany({
    where: {
      profileId,
      status: { in: ["queued", "in_progress", "needs_user", "blocked", "completed"] },
      listing: { directory: { isActive: false } },
    },
    data: {
      status: "skipped",
      assignedTo: "agent",
      requiredAction: null,
      failureReason: null,
      completedAt: now,
      result: safeJson({
        stage: "skipped_inactive_directory",
        statusMessage:
          "Skipped because this target is no longer an active ListSmartly listing directory.",
        completedAt: now.toISOString(),
        progress: [
          {
            stage: "skipped_inactive_directory",
            label: "Skipped inactive directory",
            status: "done",
            detail: "This target is not a supported listing directory.",
            at: now.toISOString(),
          },
        ],
      }),
    },
  });

  return result.count;
}

async function refreshQueuedAutopilotPriorities(profileId: string): Promise<number> {
  const tasks = await prisma.listSmartlyAutopilotTask.findMany({
    where: {
      profileId,
      status: "queued",
      listing: { directory: { isActive: true } },
    },
    select: {
      id: true,
      priority: true,
      type: true,
      listing: {
        select: {
          status: true,
          directory: {
            select: {
              slug: true,
              tier: true,
              category: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const updates = tasks
    .map((task) => {
      const listingStatus =
        task.listing?.status ||
        (task.type === "create_or_claim_listing"
          ? "missing"
          : task.type === "fix_inconsistency"
            ? "needs_update"
            : "unverified");
      const nextPriority = task.listing?.directory
        ? taskPriority(listingStatus, task.listing.directory)
        : task.priority;
      return nextPriority !== task.priority ? { id: task.id, priority: nextPriority } : null;
    })
    .filter((item): item is { id: string; priority: number } => Boolean(item));

  await Promise.all(
    updates.map((item) =>
      prisma.listSmartlyAutopilotTask.update({
        where: { id: item.id },
        data: { priority: item.priority },
      })
    )
  );

  return updates.length;
}

async function dedupeActiveAutopilotTasks(profileId: string): Promise<number> {
  const tasks = await prisma.listSmartlyAutopilotTask.findMany({
    where: {
      profileId,
      listingId: { not: null },
      status: { in: ACTIVE_AUTOPILOT_STATUSES },
    },
    include: {
      listing: {
        select: {
          status: true,
          directory: {
            select: {
              name: true,
              slug: true,
              tier: true,
              category: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const groups = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.listingId) continue;
    const group = groups.get(task.listingId) || [];
    group.push(task);
    groups.set(task.listingId, group);
  }

  let skipped = 0;
  const now = new Date();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const listing = group[0].listing;
    const desiredType = listing ? taskTypeForStatus(listing.status) : null;
    const statusRank = (status: string) => {
      if (status === "in_progress" || status === "needs_user") return 0;
      if (status === "blocked") return 1;
      if (status === "queued") return 2;
      return 3;
    };

    const ordered = [...group].sort((a, b) => {
      const aTypeRank = desiredType && a.type === desiredType ? 0 : 1;
      const bTypeRank = desiredType && b.type === desiredType ? 0 : 1;
      return (
        statusRank(a.status) - statusRank(b.status) ||
        aTypeRank - bTypeRank ||
        a.priority - b.priority ||
        a.createdAt.getTime() - b.createdAt.getTime()
      );
    });

    const keep = ordered[0];
    if (keep.status === "queued" && listing) {
      const priority = taskPriority(listing.status, listing.directory);
      await prisma.listSmartlyAutopilotTask.update({
        where: { id: keep.id },
        data: {
          type: taskTypeForStatus(listing.status),
          title: taskTitle(listing.status, listing.directory.name),
          description: `${listing.directory.name} is ${listing.status.replace("_", " ")} and needs a controlled listing workflow.`,
          requiredAction: requiredActionForStatus(listing.status),
          priority,
        },
      });
    }

    const duplicateIds = ordered.slice(1).map((task) => task.id);
    if (duplicateIds.length === 0) continue;
    const result = await prisma.listSmartlyAutopilotTask.updateMany({
      where: { id: { in: duplicateIds } },
      data: {
        status: "skipped",
        assignedTo: "agent",
        requiredAction: null,
        failureReason: null,
        completedAt: now,
        result: safeJson({
          stage: "duplicate_task_skipped",
          statusMessage:
            "Skipped because another active workflow already exists for this directory.",
          completedAt: now.toISOString(),
        }),
      },
    });
    skipped += result.count;
  }

  return skipped;
}

export async function getAutopilotState(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
    include: { user: { select: { aiCredits: true } } },
  });
  if (!profile) return null;

  await completeInactiveDirectoryTasks(profile.id);
  await dedupeActiveAutopilotTasks(profile.id);
  await refreshQueuedAutopilotPriorities(profile.id);

  const activeListings = await prisma.businessListing.findMany({
    where: { profileId: profile.id, directory: { isActive: true } },
    select: { id: true },
  });
  const visibleTaskWhere = {
    profileId: profile.id,
    OR: [{ listingId: null }, { listingId: { in: activeListings.map((listing) => listing.id) } }],
  };

  await pauseStaleAutopilotTasks(profile.id, visibleTaskWhere);

  const [
    tasks,
    credentials,
    statusCounts,
    taskStatusCounts,
    savedAccounts,
    activeTask,
    lastStartedTask,
  ] = await Promise.all([
    prisma.listSmartlyAutopilotTask.findMany({
      where: visibleTaskWhere,
      include: {
        listing: {
          include: {
            directory: {
              select: { name: true, url: true, tier: true, slug: true },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.listSmartlyAccountCredential.findMany({
      where: visibleTaskWhere,
      include: {
        listing: {
          include: { directory: { select: { slug: true, name: true, url: true, tier: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    prisma.businessListing.groupBy({
      by: ["status"],
      where: { profileId: profile.id, directory: { isActive: true } },
      _count: { status: true },
    }),
    prisma.listSmartlyAutopilotTask.groupBy({
      by: ["status"],
      where: visibleTaskWhere,
      _count: { status: true },
    }),
    prisma.listSmartlyAccountCredential.count({
      where: visibleTaskWhere,
    }),
    prisma.listSmartlyAutopilotTask.findFirst({
      where: { ...visibleTaskWhere, status: "in_progress" },
      orderBy: { updatedAt: "desc" },
      include: {
        listing: {
          include: {
            directory: {
              select: { name: true, url: true, tier: true, slug: true },
            },
          },
        },
      },
    }),
    prisma.listSmartlyAutopilotTask.findFirst({
      where: { ...visibleTaskWhere, startedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, title: true },
    }),
  ]);

  const taskCounts = taskStatusCounts.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count.status;
    return acc;
  }, {});

  const now = new Date();
  const nextRunAt = lastStartedTask?.startedAt
    ? addMs(lastStartedTask.startedAt, DAILY_AUTOPILOT_INTERVAL_MS)
    : null;
  const dailyLimitActive = Boolean(nextRunAt && nextRunAt > now);
  const queuedCount = taskCounts.queued || 0;
  const waitingCount = taskCounts.needs_user || 0;
  const activeTaskResult = activeTask ? parseJsonObject(activeTask.result) : {};
  const activeTaskCanRetry = activeTask ? isRetryableAgentResult(activeTaskResult) : false;
  const activeTaskSummary = activeTask
    ? {
        id: activeTask.id,
        title: activeTask.title,
        status: activeTask.status,
        stage:
          typeof activeTaskResult.stage === "string"
            ? activeTaskResult.stage
            : activeTask.status === "needs_user"
              ? "waiting_for_user_validation"
              : "running_directory_workflow",
        statusMessage:
          typeof activeTaskResult.statusMessage === "string"
            ? activeTaskResult.statusMessage
            : activeTask.status === "needs_user"
              ? activeTask.requiredAction || "Waiting for user validation."
              : "Researching the directory workflow and preparing the next safe action.",
        progress: Array.isArray(activeTaskResult.progress) ? activeTaskResult.progress : [],
        canRetry: activeTaskCanRetry,
        retryLabel:
          typeof activeTaskResult.userActionButtonLabel === "string"
            ? activeTaskResult.userActionButtonLabel
            : "Retry agent",
        retryMessage: activeTaskCanRetry
          ? activeTask.requiredAction ||
            "The last browser-agent run ended before a final decision. Retry to continue from the live browser."
          : null,
        directory: activeTask.listing?.directory || null,
        updatedAt: activeTask.updatedAt,
      }
    : null;

  return {
    settings: {
      enabled: profile.listSmartlyAutopilotEnabled,
      autoFix: profile.listSmartlyAutoFixEnabled,
      autoDescriptions: profile.listSmartlyAutoDescriptionEnabled,
      mode: profile.listSmartlyAutopilotMode,
      lastRunAt: profile.listSmartlyAutopilotLastRunAt,
    },
    stats: {
      listingStatusCounts: statusCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      taskCounts,
      savedAccounts,
    },
    runtime: {
      queueReady: queuedCount > 0 || waitingCount > 0 || Boolean(activeTask),
      canPrepareQueue: queuedCount === 0 && !activeTask,
      canRun: queuedCount > 0 && !activeTask && !dailyLimitActive,
      canRunExtra:
        queuedCount > 0 &&
        !activeTask &&
        dailyLimitActive &&
        (profile.user?.aiCredits || 0) >= LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
      extraRunCost: LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
      creditsAvailable: profile.user?.aiCredits || 0,
      activeTask: activeTaskSummary,
      lastStartedAt: lastStartedTask?.startedAt || null,
      nextRunAt,
      message: activeTask
        ? activeTaskCanRetry
          ? `${activeTask.title} needs an agent retry.`
          : `${activeTask.title} is already running. Status refreshes automatically.`
        : dailyLimitActive && nextRunAt
          ? `Daily limit reached. Next autopilot run is available ${nextRunAt.toISOString()}.`
        : queuedCount > 0 && waitingCount > 0
          ? `${waitingCount} listing workflow${waitingCount === 1 ? "" : "s"} need user validation. Autopilot can still run one queued workflow per day.`
        : waitingCount > 0
          ? "Autopilot is waiting for user validation."
        : queuedCount > 0
          ? "Queue is ready. Autopilot runs one listing workflow per day."
          : "No prepared listing workflow is waiting.",
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      listingId: task.listingId,
      type: task.type,
      status: task.status,
      priority: task.priority,
      title: task.title,
      description: task.description,
      requiredAction: task.requiredAction,
      assignedTo: task.assignedTo,
      payload: parseJsonObject(task.payload),
      result: parseJsonObject(task.result),
      failureReason: task.failureReason,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      dueAt: task.dueAt,
      directory: task.listing?.directory || null,
      listingStatus: task.listing?.status || null,
      listingUrl: task.listing?.listingUrl || null,
    })),
    credentials: credentials.map((credential) => ({
      id: credential.id,
      listingId: credential.listingId,
      directoryName: credential.directoryName,
      directory: credential.listing?.directory || null,
      loginUrl: credential.loginUrl,
      accountEmail: credential.accountEmail,
      username: credential.username,
      recoveryEmail: credential.recoveryEmail,
      passwordHint: credential.passwordHint,
      secureNotes: decryptSecureNote(credential.secureNotes),
      status: credential.status,
      verificationStatus: credential.verificationStatus,
      lastVerifiedAt: credential.lastVerifiedAt,
      updatedAt: credential.updatedAt,
    })),
  };
}

export async function updateAutopilotSettings(
  userId: string,
  data: {
    enabled?: boolean;
    autoFix?: boolean;
    autoDescriptions?: boolean;
    mode?: string;
  }
) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  return prisma.listSmartlyProfile.update({
    where: { id: profile.id },
    data: {
      ...(data.enabled !== undefined ? { listSmartlyAutopilotEnabled: data.enabled } : {}),
      ...(data.autoFix !== undefined ? { listSmartlyAutoFixEnabled: data.autoFix } : {}),
      ...(data.autoDescriptions !== undefined
        ? { listSmartlyAutoDescriptionEnabled: data.autoDescriptions }
        : {}),
      ...(data.mode ? { listSmartlyAutopilotMode: data.mode } : {}),
    },
  });
}

export async function prepareAutopilotQueue(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  await seedDirectories();
  await completeInactiveDirectoryTasks(profile.id);
  await dedupeActiveAutopilotTasks(profile.id);

  const listings = await prisma.businessListing.findMany({
    where: {
      profileId: profile.id,
      status: { in: WORKABLE_STATUSES },
      directory: { isActive: true },
    },
    include: {
      directory: {
        select: {
          slug: true,
          name: true,
          url: true,
          submitUrl: true,
          claimUrl: true,
          tier: true,
          category: true,
          apiAvailable: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ directory: { tier: "asc" } }, { updatedAt: "desc" }],
  });

  let created = 0;
  const prioritizedListings = listings.sort(
    (a, b) =>
      taskPriority(a.status, a.directory) - taskPriority(b.status, b.directory) ||
      a.directory.name.localeCompare(b.directory.name)
  );
  for (const listing of prioritizedListings) {
    const type = taskTypeForStatus(listing.status);
    const priority = taskPriority(listing.status, listing.directory);
    const existing = await prisma.listSmartlyAutopilotTask.findFirst({
      where: {
        profileId: profile.id,
        listingId: listing.id,
        status: { in: ACTIVE_AUTOPILOT_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true, type: true },
    });
    if (existing) {
      await prisma.listSmartlyAutopilotTask.update({
        where: { id: existing.id },
        data: {
          payload: safeJson(buildDirectoryPayload(profile, listing)),
          ...(existing.status === "queued"
            ? {
                type,
                title: taskTitle(listing.status, listing.directory.name),
                description: `${listing.directory.name} is ${listing.status.replace("_", " ")} and needs a controlled listing workflow.`,
                assignedTo: "agent",
                requiredAction: requiredActionForStatus(listing.status),
                priority,
              }
            : {}),
        },
      });
      continue;
    }

    await prisma.listSmartlyAutopilotTask.create({
      data: {
        profileId: profile.id,
        listingId: listing.id,
        type,
        status: "queued",
        priority,
        title: taskTitle(listing.status, listing.directory.name),
        description: `${listing.directory.name} is ${listing.status.replace("_", " ")} and needs a controlled listing workflow.`,
        requiredAction: requiredActionForStatus(listing.status),
        assignedTo: "agent",
        payload: safeJson(buildDirectoryPayload(profile, listing)),
      },
    });
    created++;
  }

  await prisma.listSmartlyProfile.update({
    where: { id: profile.id },
    data: {
      listSmartlyAutopilotEnabled: true,
      listSmartlyAutopilotLastRunAt: new Date(),
    },
  });

  if (created > 0) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "ListSmartly autopilot queue prepared",
      message: `${created} listing workflow${created === 1 ? "" : "s"} are ready for guided action.`,
      actionUrl: "/listsmartly/dashboard",
      data: { feature: "listsmartly", created },
    });
  }

  return {
    created,
    considered: listings.length,
    status: created > 0 ? "prepared" : "ready",
    message:
      created > 0
        ? `${created} listing workflow${created === 1 ? "" : "s"} prepared.`
        : "Agent queue is already ready.",
  };
}

export async function processAutopilotTask(
  userId: string,
  taskId?: string,
  continuation: ListSmartlyAgentContinuation = {}
) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  const businessSignal: BusinessSignalInput & { id: string } = {
    ...profile,
    contactName: profile.user?.name || profile.businessName,
    email: profile.email || profile.user?.email || null,
  };

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: {
      profileId: profile.id,
      status: "in_progress",
      ...(taskId ? { id: taskId } : {}),
    },
    include: {
      listing: {
        include: {
          directory: {
            select: {
              name: true,
              url: true,
              submitUrl: true,
              claimUrl: true,
              tier: true,
              slug: true,
              isActive: true,
              apiAvailable: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  if (!task) {
    return { status: "idle", message: "No in-progress ListSmartly autopilot task is waiting.", task: null };
  }

  const existingResult = parseJsonObject(task.result);

  if (!task.listing) {
    const failed = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        assignedTo: "admin",
        failureReason: "The listing record for this autopilot task no longer exists.",
        result: safeJson(
          appendProgress(parseJsonObject(task.result), {
            stage: "failed",
            label: "Listing record missing",
            status: "failed",
            detail: "The task could not continue because the linked listing was removed.",
          })
        ),
      },
    });
    return { status: "failed", message: failed.failureReason || "Task failed.", task: failed };
  }

  if (!task.listing.directory.isActive) {
    const completedMessage =
      `${task.listing.directory.name} is no longer an active ListSmartly directory, so the agent skipped this workflow.`;
    const skipped = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "skipped",
        assignedTo: "agent",
        requiredAction: null,
        failureReason: null,
        completedAt: new Date(),
        result: safeJson(
          appendProgress(
            {
              ...parseJsonObject(task.result),
              stage: "skipped_inactive_directory",
              statusMessage: completedMessage,
              completedAt: new Date().toISOString(),
            },
            {
              stage: "skipped_inactive_directory",
              label: "Skipped inactive directory",
              status: "done",
              detail: completedMessage,
            }
          )
        ),
      },
    });
    return { status: "skipped", message: completedMessage, task: skipped };
  }

  const existingStage = typeof existingResult.stage === "string" ? existingResult.stage : "";
  if (
    existingStage.startsWith("agent_browser_") ||
    existingStage === "agent_sdk_retry_needed" ||
    existingStage === "agent_review_pending" ||
    isRetryableAgentResult(existingResult) ||
    (existingStage.startsWith("agent_") && existingResult.agentAttemptedAccountCreation === true)
  ) {
    return runAgentBrowserWorkflow(userId, businessSignal, task, existingResult, continuation);
  }

  console.log(`ListSmartly autopilot: processing ${task.title} for ${profile.businessName}`);

  await updateTaskProgress(
    task.id,
    "checking_public_presence",
    `Checking public search results and ${task.listing.directory.name} pages for an existing business profile.`,
    {
      label: "Public listing check",
      status: "active",
      detail: `Searching ${task.listing.directory.name} for ${profile.businessName}.`,
    },
    { startedAt: task.startedAt?.toISOString() || new Date().toISOString() }
  );

  const research = await researchDirectoryWorkflow(businessSignal, task.listing);

  if (research.match) {
    await updateTaskProgress(
      task.id,
      "public_listing_verified",
      `Found a matching ${task.listing.directory.name} public listing.`,
      {
        label: "Public listing found",
        status: "done",
        detail: research.match.link,
      },
      {
        portalUrl: research.portalUrl,
        discoveredLinks: research.discoveredLinks,
        match: research.match,
      }
    );

    await markListingLiveFromAutopilot(
      task.listing.id,
      research.match.link,
      task.listing.status,
      "autopilot_public_research"
    );

    const current = parseJsonObject((await prisma.listSmartlyAutopilotTask.findUnique({
      where: { id: task.id },
      select: { result: true },
    }))?.result);
    const completedResult = appendProgress(
      {
        ...current,
        stage: "completed",
        statusMessage: `${task.listing.directory.name} was verified from public search results.`,
        listingUrl: research.match.link,
        completedAt: new Date().toISOString(),
      },
      {
        stage: "completed",
        label: "Verification complete",
        status: "done",
        detail: `${task.listing.directory.name} is now marked live.`,
      }
    );

    const completed = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        result: safeJson(completedResult),
        completedAt: new Date(),
      },
    });

    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "ListSmartly listing verified",
      message: `${task.listing.directory.name} was verified and marked live.`,
      actionUrl: "/listsmartly/dashboard",
      data: { feature: "listsmartly", taskId: task.id, listingUrl: research.match.link },
    });

    return {
      status: "completed",
      message: `${task.listing.directory.name} was verified and marked live.`,
      task: completed,
    };
  }

  const handoffUrl = research.discoveredLinks[0] || research.portalUrl || task.listing.directory.url;

  if (research.searched) {
    await markListingMissingFromAutopilot(task.listing.id, task.listing.status, "autopilot_public_research");
  } else {
    await prisma.businessListing.update({
      where: { id: task.listing.id },
      data: {
        lastCheckedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  }

  if (!research.portalReachable) {
    const current = parseJsonObject((await prisma.listSmartlyAutopilotTask.findUnique({
      where: { id: task.id },
      select: { result: true },
    }))?.result);
    const blockedMessage =
      `${task.listing.directory.name} could not be safely reached from the server today. ` +
      "The agent recorded the failed portal check and will leave the workflow blocked instead of retrying aggressively.";
    const blockedResult = appendProgress(
      {
        ...current,
        stage: "blocked_directory_unreachable",
        statusMessage: blockedMessage,
        portalUrl: research.portalUrl,
        discoveredLinks: research.discoveredLinks,
        searched: research.searched,
        error: research.error,
      },
      {
        stage: "blocked_directory_unreachable",
        label: "Portal check blocked",
        status: "failed",
        detail: research.error || "Directory portal did not return a reachable response.",
      }
    );

    const blocked = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "blocked",
        assignedTo: "admin",
        failureReason: blockedMessage,
        requiredAction: blockedMessage,
        result: safeJson(blockedResult),
      },
    });

    return { status: "blocked", message: blockedMessage, task: blocked };
  }

  const creationAttempt = await attemptAccountCreation(task.id, businessSignal, task.listing, research);
  const current = parseJsonObject((await prisma.listSmartlyAutopilotTask.findUnique({
    where: { id: task.id },
    select: { result: true },
  }))?.result);

  if (!creationAttempt.requiresUserAction) {
    const agentMessage =
      `${task.listing.directory.name} was inspected. ${creationAttempt.blockerMessage} ` +
      "No account was created by FlowSmartly, no credentials were saved, and FlowSmartly did not send an email. " +
      "No user action is required yet.";
    const agentResult = appendProgress(
      {
        ...current,
        stage: "agent_browser_workflow_pending",
        statusMessage: agentMessage,
        agentAttemptedAccountCreation: false,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
        accountCreationBlocker: creationAttempt.blocker,
        userActionTitle: creationAttempt.userActionTitle,
        userActionMessage: creationAttempt.userActionMessage,
        userActionButtonLabel: creationAttempt.userActionButtonLabel,
        portalUrl: creationAttempt.creationUrl || handoffUrl,
        discoveredLinks: research.discoveredLinks,
        searched: research.searched,
        match: null,
        error: research.error,
      },
      {
        stage: "agent_browser_workflow_pending",
        label: "Agent browser step queued",
        status: "active",
        detail: creationAttempt.blockerMessage,
      }
    );

    const pendingAgent = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "in_progress",
        assignedTo: "agent",
        requiredAction:
          "The public directory workflow was found. The next step belongs to the agent browser workflow; user validation is not required yet.",
        failureReason: null,
        result: safeJson(agentResult),
      },
    });

    return runAgentBrowserWorkflow(
      userId,
      businessSignal,
      {
        id: pendingAgent.id,
        title: pendingAgent.title,
        result: pendingAgent.result,
        listingId: pendingAgent.listingId,
        listing: task.listing,
      },
      agentResult
    );
  }

  const validationMessage =
    `${task.listing.directory.name} portal workflow was inspected but not completed. ${creationAttempt.blockerMessage} ` +
    "No account was created by FlowSmartly, no credentials were saved, and FlowSmartly did not send an email. " +
    (research.searched
      ? "No confirmed public listing was found from the directory search. "
      : "Public search is not fully configured for this directory, so the agent checked the portal path instead. ") +
    "The agent will continue after the listed blocker is handled.";

  const waitingResult = appendProgress(
    {
      ...current,
      stage: "waiting_for_user_validation",
      statusMessage: validationMessage,
      agentAttemptedAccountCreation: creationAttempt.attempted,
      accountCreated: creationAttempt.accountCreated,
      credentialSaved: creationAttempt.credentialSaved,
      emailSentByFlowSmartly: creationAttempt.emailSentByFlowSmartly,
      accountCreationBlocker: creationAttempt.blocker,
      userActionTitle: creationAttempt.userActionTitle,
      userActionMessage: creationAttempt.userActionMessage,
      userActionButtonLabel: creationAttempt.userActionButtonLabel,
      portalUrl: creationAttempt.creationUrl || handoffUrl,
      discoveredLinks: research.discoveredLinks,
      searched: research.searched,
      match: null,
      error: research.error,
    },
    {
      stage: "waiting_for_user_validation",
      label: "Waiting for real validation",
      status: "waiting",
      detail: creationAttempt.blockerMessage,
    }
  );

  const needsUser = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "needs_user",
      assignedTo: "user",
      requiredAction: validationMessage,
      failureReason: null,
      result: safeJson(waitingResult),
    },
  });

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "ListSmartly validation needed",
    message: validationMessage,
    actionUrl: "/listsmartly/dashboard",
    data: { feature: "listsmartly", taskId: task.id, portalUrl: handoffUrl },
  });

  return { status: "needs_user", message: validationMessage, task: needsUser };
}

export async function runNextAutopilotStep(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  await completeInactiveDirectoryTasks(profile.id);
  await refreshQueuedAutopilotPriorities(profile.id);
  await pauseStaleAutopilotTasks(profile.id, {
    profileId: profile.id,
    listing: { directory: { isActive: true } },
  });

  const activeTask = await prisma.listSmartlyAutopilotTask.findFirst({
    where: {
      profileId: profile.id,
      status: "in_progress",
      listing: { directory: { isActive: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (activeTask) {
    return {
      status: "already_running",
      message: `${activeTask.title} is already running. Autopilot will not start another workflow at the same time.`,
      task: activeTask,
    };
  }

  const lastStartedTask = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, startedAt: { not: null }, listing: { directory: { isActive: true } } },
    orderBy: { startedAt: "desc" },
    select: { id: true, title: true, startedAt: true },
  });
  if (lastStartedTask?.startedAt) {
    const nextRunAt = addMs(lastStartedTask.startedAt, DAILY_AUTOPILOT_INTERVAL_MS);
    if (nextRunAt > new Date()) {
      return {
        status: "daily_limit",
        message: `Autopilot is limited to one account or listing workflow per day. Next run is available ${nextRunAt.toISOString()}.`,
        task: null,
        nextRunAt,
      };
    }
  }

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, status: "queued", listing: { directory: { isActive: true } } },
    include: {
      listing: {
        include: {
          directory: {
            select: { name: true, url: true, submitUrl: true, claimUrl: true, apiAvailable: true },
          },
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (!task) {
    return { status: "empty", message: "No prepared listing workflow is waiting.", task: null };
  }

  const updated = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "in_progress",
      assignedTo: "agent",
      result: safeJson({
        stage: "running_directory_workflow",
        statusMessage:
          "Researching the public directory workflow, submit/claim path, and validation requirements.",
        cadence: "one_workflow_per_day",
        startedAt: new Date().toISOString(),
        progress: [
          {
            stage: "running_directory_workflow",
            label: "Agent started",
            status: "active",
            detail: "Preparing the directory workflow.",
            at: new Date().toISOString(),
          },
        ],
      }),
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      startedAt: task.startedAt || new Date(),
      requiredAction:
        "Autopilot is running a compliant public directory web workflow. It will pause only if email, SMS, phone, CAPTCHA, payment, or owner approval is required.",
    },
  });

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "ListSmartly autopilot started",
    message: `${task.title} started. The agent will run one listing workflow today and pause only if user validation is required.`,
    actionUrl: "/listsmartly/dashboard",
    data: { feature: "listsmartly", taskId: task.id },
  });

  return {
    status: "started",
    message: `${task.title} started. Autopilot is inspecting the directory workflow and the status panel will refresh automatically.`,
    task: updated,
    nextRunAt: addMs(new Date(), DAILY_AUTOPILOT_INTERVAL_MS),
  };
}

export async function runPaidExtraAutopilotStep(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  await completeInactiveDirectoryTasks(profile.id);
  await refreshQueuedAutopilotPriorities(profile.id);
  await pauseStaleAutopilotTasks(profile.id, {
    profileId: profile.id,
    listing: { directory: { isActive: true } },
  });

  const result = await prisma.$transaction(async (tx) => {
    const activeTask = await tx.listSmartlyAutopilotTask.findFirst({
      where: {
        profileId: profile.id,
        status: "in_progress",
        listing: { directory: { isActive: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (activeTask) {
      return {
        status: "already_running",
        message: `${activeTask.title} is already running. Finish or pause that workflow before buying another extra run.`,
        task: activeTask,
        creditsCharged: 0,
        creditsRemaining: null,
      };
    }

    const lastStartedTask = await tx.listSmartlyAutopilotTask.findFirst({
      where: { profileId: profile.id, startedAt: { not: null }, listing: { directory: { isActive: true } } },
      orderBy: { startedAt: "desc" },
      select: { id: true, title: true, startedAt: true },
    });
    const nextRunAt = lastStartedTask?.startedAt
      ? addMs(lastStartedTask.startedAt, DAILY_AUTOPILOT_INTERVAL_MS)
      : null;
    if (!nextRunAt || nextRunAt <= new Date()) {
      return {
        status: "daily_available",
        message: "Your included daily autopilot run is available. Use Run Autopilot; no credits were charged.",
        task: null,
        creditsCharged: 0,
        creditsRemaining: null,
      };
    }

    const task = await tx.listSmartlyAutopilotTask.findFirst({
      where: { profileId: profile.id, status: "queued", listing: { directory: { isActive: true } } },
      include: {
        listing: {
          include: {
            directory: {
              select: { name: true, url: true, submitUrl: true, claimUrl: true, apiAvailable: true },
            },
          },
        },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    if (!task) {
      return {
        status: "empty",
        message: "No prepared listing workflow is waiting, so no credits were charged.",
        task: null,
        creditsCharged: 0,
        creditsRemaining: null,
      };
    }

    const charged = await tx.user.updateMany({
      where: { id: userId, aiCredits: { gte: LISTSMARTLY_EXTRA_RUN_CREDIT_COST } },
      data: { aiCredits: { decrement: LISTSMARTLY_EXTRA_RUN_CREDIT_COST } },
    });
    if (charged.count !== 1) throw new Error("INSUFFICIENT_CREDITS");

    const now = new Date();
    const claim = await tx.listSmartlyAutopilotTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: {
        status: "in_progress",
        assignedTo: "agent",
        result: safeJson({
          stage: "running_directory_workflow",
          statusMessage:
            "Paid extra run started. The agent is inspecting the directory workflow now.",
          cadence: "paid_extra_run",
          creditsCharged: LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
          startedAt: now.toISOString(),
          progress: [
            {
              stage: "running_directory_workflow",
              label: "Paid extra run started",
              status: "active",
              detail: `${LISTSMARTLY_EXTRA_RUN_CREDIT_COST} credits charged for an immediate additional workflow.`,
              at: now.toISOString(),
            },
          ],
        }),
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        requiredAction:
          "Paid extra autopilot run is active. The agent will pause only if the directory shows a real validation requirement.",
      },
    });
    if (claim.count !== 1) throw new Error("TASK_ALREADY_CLAIMED");

    const [updatedTask, updatedUser] = await Promise.all([
      tx.listSmartlyAutopilotTask.findUnique({ where: { id: task.id } }),
      tx.user.findUnique({ where: { id: userId }, select: { aiCredits: true } }),
    ]);

    if (!updatedUser || !updatedTask) throw new Error("EXTRA_RUN_START_FAILED");

    const creditTransaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: "USAGE",
        amount: -LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
        balanceAfter: updatedUser.aiCredits,
        description: `ListSmartly paid extra autopilot run: ${task.title}`,
        referenceType: "listsmartly_extra_run",
        referenceId: task.id,
        metadata: safeJson({
          profileId: profile.id,
          taskId: task.id,
          listingId: task.listingId,
          directoryName: task.listing?.directory?.name || null,
          cost: LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
        }),
      },
    });

    return {
      status: "started",
      message: `${task.title} started as a paid extra run. ${LISTSMARTLY_EXTRA_RUN_CREDIT_COST} credits were charged.`,
      task: updatedTask,
      creditsCharged: LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
      creditsRemaining: updatedUser.aiCredits,
      creditTransactionId: creditTransaction.id,
    };
  });

  if (result.status === "started" && result.task) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "ListSmartly paid extra run started",
      message: `${result.task.title} started immediately. ${LISTSMARTLY_EXTRA_RUN_CREDIT_COST} credits were charged.`,
      actionUrl: "/listsmartly/dashboard",
      data: {
        feature: "listsmartly",
        taskId: result.task.id,
        creditsCharged: LISTSMARTLY_EXTRA_RUN_CREDIT_COST,
        creditsRemaining: result.creditsRemaining,
      },
    });
  }

  return result;
}

export async function continueAutopilotTask(
  userId: string,
  taskId: string,
  continuation: ListSmartlyAgentContinuation = {}
) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: {
      id: taskId,
      profileId: profile.id,
      status: { in: ["needs_user", "in_progress"] },
      listing: { directory: { isActive: true } },
    },
    select: {
      id: true,
      status: true,
      result: true,
      title: true,
      listing: {
        select: {
          directory: {
            select: { name: true, url: true, submitUrl: true, claimUrl: true },
          },
        },
      },
    },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  const existingResult = parseJsonObject(task.result);
  const retryingAgentRun = task.status === "in_progress" && isRetryableAgentResult(existingResult);
  if (task.status === "in_progress" && !retryingAgentRun) {
    throw new Error("TASK_ALREADY_CLAIMED");
  }
  const isEmailVerificationStep =
    existingResult.accountCreationBlocker === "waiting_for_email_verification" ||
    existingResult.stage === "waiting_for_email_verification";
  const needsLiveEmailSession = Boolean(continuation.verificationCode && isEmailVerificationStep);

  if (needsLiveEmailSession && !hasActiveListSmartlyAgentSession(task.id)) {
    const restartUrl =
      normalizeUrl(task.listing?.directory.submitUrl) ||
      normalizeUrl(task.listing?.directory.claimUrl) ||
      normalizeUrl(task.listing?.directory.url) ||
      (typeof existingResult.portalUrl === "string" ? existingResult.portalUrl : undefined);
    const restartResult = appendProgress(
      {
        ...existingResult,
        stage: "agent_browser_workflow_running",
        statusMessage:
          "The previous email verification browser session expired. The AI listing agent is reopening the directory sign-up flow and will ask for a new code only after the directory sends it.",
        userConfirmedAt: new Date().toISOString(),
        verificationCodeProvided: false,
        verificationCodeNotSubmittedAt: new Date().toISOString(),
        browserSessionHeld: false,
        browserSessionResumed: false,
        browserSessionExpired: true,
        portalUrl: restartUrl,
      },
      {
        stage: "agent_browser_session_expired",
        label: "Verification session reopened",
        status: "active",
        detail:
          "The submitted code was not sent to a stale verification page. The agent is reopening the sign-up flow so the next code belongs to the live browser session.",
      }
    );

    const updated = await prisma.listSmartlyAutopilotTask.update({
      where: { id: task.id },
      data: {
        status: "in_progress",
        assignedTo: "agent",
        result: safeJson(restartResult),
        requiredAction:
          "The previous email verification page expired. The AI listing agent is reopening the directory flow; wait for the next fresh code prompt before entering another code.",
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    return {
      status: "continuing",
      verificationCodeForwarded: false,
      message:
        "The live verification session had expired, so the agent is reopening the directory flow instead of submitting the code to a stale page.",
      task: updated,
    };
  }

  const result = appendProgress(
    {
      ...existingResult,
      stage: "agent_browser_workflow_running",
      statusMessage: continuation.verificationCode
        ? "Verification code received. The AI listing agent is submitting it in the live directory browser session."
        : retryingAgentRun
          ? "The previous browser-agent run ended before a final decision. The AI listing agent is retrying from the current directory state."
          : "User confirmed the validation step is complete. The AI listing agent is resuming the directory workflow.",
      userConfirmedAt: new Date().toISOString(),
      agentRetryRequestedAt: retryingAgentRun ? new Date().toISOString() : undefined,
      verificationCodeProvided: Boolean(continuation.verificationCode),
      verificationCodeSubmittedAt: continuation.verificationCode ? new Date().toISOString() : undefined,
      accountCreationBlocker: null,
      browserDiagnostics: null,
    },
    {
      stage: continuation.verificationCode
        ? "verification_code_received"
        : retryingAgentRun
          ? "agent_retry_requested"
          : "validation_received",
      label: continuation.verificationCode
        ? "Verification code handed to agent"
        : retryingAgentRun
          ? "Agent retry requested"
          : "Validation confirmed",
      status: continuation.verificationCode ? "active" : "done",
      detail: continuation.verificationCode
        ? "The agent is submitting the code in the same live browser session."
        : retryingAgentRun
          ? "The agent is retrying the browser workflow now."
          : "The agent is resuming the listing check.",
    }
  );

  const updated = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "in_progress",
      assignedTo: "agent",
      result: safeJson(result),
      requiredAction:
        continuation.verificationCode
          ? "The AI listing agent is submitting the email code in the live directory browser session. Status will refresh automatically."
          : retryingAgentRun
            ? "The AI listing agent is retrying the browser workflow and will complete the listing or ask for the next real validation step."
            : "Validation was confirmed. The AI listing agent is continuing the directory workflow and will complete the listing or ask for the next real validation step.",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  return {
    status: "continuing",
    verificationCodeForwarded: Boolean(continuation.verificationCode),
    message: continuation.verificationCode
      ? "Code received. The agent is submitting it in the live browser session now."
      : retryingAgentRun
        ? "Agent retry started. The workflow is continuing now."
        : "Validation confirmed. The agent is continuing the workflow now.",
    task: updated,
  };
}

export async function resumeAutopilotTaskAfterBrowserControl(userId: string, taskId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: {
      id: taskId,
      profileId: profile.id,
      status: "needs_user",
      listing: { directory: { isActive: true } },
    },
    select: { id: true, result: true },
  });
  if (!task) return { resumed: false, task: null, reason: "task_not_waiting_for_user" };

  const existingResult = parseJsonObject(task.result);
  const previousStage = String(existingResult.accountCreationBlocker || existingResult.stage || "");
  const wasUserValidation =
    previousStage.startsWith("waiting_for_") ||
    /(captcha|verification|validation|phone|sms|payment|owner|business_email|approved_access)/i.test(previousStage);
  const snapshot = await getListSmartlyAgentBrowserStatus(task.id);
  if (!snapshot.active) return { resumed: false, task: null, reason: snapshot.reason };

  const snapshotContext = `${snapshot.url} ${snapshot.title} ${snapshot.text}`;
  const stillNeedsUser =
    snapshot.blockers.captcha ||
    snapshot.blockers.emailVerification ||
    snapshot.blockers.phoneVerification ||
    snapshot.blockers.payment ||
    snapshot.blockers.businessEmailRejected;
  const ordinarySignupDetails = /(add some details|birthdate|birth date|date of birth|country\/region|country region|create your microsoft account|what'?s your name|first name|last name|your name)/i.test(
    snapshotContext
  );

  if (!wasUserValidation || (stillNeedsUser && !ordinarySignupDetails)) {
    return { resumed: false, task: null, reason: "browser_still_requires_user_validation" };
  }

  const result = appendProgress(
    {
      ...existingResult,
      stage: "agent_browser_workflow_running",
      statusMessage:
        "The live browser moved past the user validation step. The AI listing agent is filling the remaining ordinary signup fields.",
      userValidationCompletedAt: new Date().toISOString(),
      browserValidationAutoDetected: true,
      portalUrl: snapshot.url,
    },
    {
      stage: "validation_auto_detected",
      label: "Validation completed",
      status: "done",
      detail: "The live browser is past the verification page, so the agent is taking over again.",
    }
  );

  const updated = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "in_progress",
      assignedTo: "agent",
      result: safeJson(result),
      requiredAction:
        "Validation completed in the live browser. The AI listing agent is continuing with the remaining signup fields.",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  return { resumed: true, task: updated, reason: "browser_ready_for_agent" };
}

export async function completeAutopilotTask(userId: string, taskId: string, result: Record<string, unknown> = {}) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { id: taskId, profileId: profile.id },
    include: { listing: true },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  if (task.listingId && result.listingUrl) {
    await prisma.businessListing.update({
      where: { id: task.listingId },
      data: {
        status: "submitted",
        listingUrl: String(result.listingUrl),
        submittedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  }

  return prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "completed",
      result: safeJson(result),
      completedAt: new Date(),
    },
  });
}

export async function blockAutopilotTask(userId: string, taskId: string, reason: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  return prisma.listSmartlyAutopilotTask.updateMany({
    where: { id: taskId, profileId: profile.id },
    data: {
      status: "blocked",
      assignedTo: "user",
      failureReason: reason || "Manual intervention required",
      requiredAction: reason || "Manual intervention required",
    },
  });
}

export async function requestAutopilotValidation(userId: string, taskId: string, reason: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const message = reason || "Manual verification is required before this listing can continue.";

  const result = await prisma.listSmartlyAutopilotTask.updateMany({
    where: { id: taskId, profileId: profile.id },
    data: {
      status: "needs_user",
      assignedTo: "user",
      requiredAction: message,
      failureReason: null,
    },
  });

  if (result.count > 0) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "ListSmartly verification needed",
      message,
      actionUrl: "/listsmartly/dashboard",
      data: { feature: "listsmartly", taskId },
    });
  }

  return result;
}

export async function saveAutopilotCredential(userId: string, input: SaveCredentialInput) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const listing = input.listingId
    ? await prisma.businessListing.findFirst({
        where: { id: input.listingId, profileId: profile.id, directory: { isActive: true } },
        include: { directory: { select: { name: true, url: true } } },
      })
    : null;

  if (input.listingId && !listing) throw new Error("LISTING_NOT_FOUND");

  const directoryName = input.directoryName || listing?.directory.name;
  if (!directoryName) throw new Error("DIRECTORY_REQUIRED");

  const credential = input.listingId
    ? await prisma.listSmartlyAccountCredential.upsert({
        where: { listingId: input.listingId },
        update: {
          directoryName,
          loginUrl: input.loginUrl || listing?.directory.url || null,
          accountEmail: input.accountEmail || null,
          username: input.username || null,
          recoveryEmail: input.recoveryEmail || null,
          passwordHint: input.passwordHint || null,
          secureNotes: encryptSecureNote(input.secureNotes),
          verificationStatus: input.verificationStatus || "pending",
          lastVerifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
        },
        create: {
          profileId: profile.id,
          listingId: input.listingId,
          directoryName,
          loginUrl: input.loginUrl || listing?.directory.url || null,
          accountEmail: input.accountEmail || null,
          username: input.username || null,
          recoveryEmail: input.recoveryEmail || null,
          passwordHint: input.passwordHint || null,
          secureNotes: encryptSecureNote(input.secureNotes),
          verificationStatus: input.verificationStatus || "pending",
          lastVerifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
          createdBy: "user",
        },
      })
    : await prisma.listSmartlyAccountCredential.create({
        data: {
          profileId: profile.id,
          directoryName,
          loginUrl: input.loginUrl || null,
          accountEmail: input.accountEmail || null,
          username: input.username || null,
          recoveryEmail: input.recoveryEmail || null,
          passwordHint: input.passwordHint || null,
          secureNotes: encryptSecureNote(input.secureNotes),
          verificationStatus: input.verificationStatus || "pending",
          lastVerifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
          createdBy: "user",
        },
      });

  if (input.listingId && input.verificationStatus === "verified") {
    await prisma.businessListing.update({
      where: { id: input.listingId },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  }

  return credential;
}

export async function handleAutopilotAction(userId: string, action: AutopilotAction, body: Record<string, unknown>) {
  if (action === "prepare_queue") return prepareAutopilotQueue(userId);
  if (action === "run_next") return runNextAutopilotStep(userId);
  if (action === "run_extra") return runPaidExtraAutopilotStep(userId);
  if (action === "continue_task") {
    return continueAutopilotTask(userId, String(body.taskId), {
      verificationCode:
        typeof body.verificationCode === "string" && body.verificationCode.trim()
          ? body.verificationCode.trim()
          : undefined,
    });
  }
  if (action === "complete_task") return completeAutopilotTask(userId, String(body.taskId), body.result as Record<string, unknown>);
  if (action === "block_task") return blockAutopilotTask(userId, String(body.taskId), String(body.reason || ""));
  if (action === "request_validation") return requestAutopilotValidation(userId, String(body.taskId), String(body.reason || ""));
  if (action === "save_credential") return saveAutopilotCredential(userId, body.credential as SaveCredentialInput);
  throw new Error("UNKNOWN_ACTION");
}
