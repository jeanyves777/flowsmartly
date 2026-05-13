import { prisma } from "@/lib/db/client";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";

const WORKABLE_STATUSES = ["missing", "unverified", "needs_update"];
const DAILY_AUTOPILOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTOPILOT_FETCH_TIMEOUT_MS = 10000;
const AUTOPILOT_USER_AGENT = "Mozilla/5.0 (compatible; FlowSmartlyListSmartly/1.0)";
const MIN_DIRECTORY_MATCH_SCORE = 5;

type AutopilotAction =
  | "prepare_queue"
  | "run_next"
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
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
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
  userActionTitle: string;
  userActionMessage: string;
  userActionButtonLabel: string;
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

function taskPriority(status: string, tier: number): number {
  const statusWeight: Record<string, number> = {
    missing: 0,
    needs_update: 10,
    unverified: 20,
  };
  return (statusWeight[status] ?? 30) + tier;
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
    return "Autopilot will create or claim this listing and pause only if the directory requires email, SMS, phone, payment, or CAPTCHA verification.";
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
    name: string;
    url: string;
    submitUrl: string | null;
    claimUrl: string | null;
    tier: number;
    apiAvailable: boolean;
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
      name: listing.directory.name,
      url: listing.directory.url,
      submitUrl: listing.directory.submitUrl,
      claimUrl: listing.directory.claimUrl,
      tier: listing.directory.tier,
      apiAvailable: listing.directory.apiAvailable,
    },
    safety: {
      mode: listing.directory.apiAvailable ? "api_or_web_workflow" : "web_workflow",
      policy:
        "Use official APIs when available, otherwise use public directory pages, submit/claim URLs, and low-rate web research. Do not bypass login protections, CAPTCHAs, email/SMS/phone verification, rate limits, payment requirements, or directory terms.",
      pacing: "One account or listing workflow per day with verification checkpoints.",
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
  const next = appendProgress(
    {
      ...current,
      ...extra,
      stage,
      statusMessage,
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

async function probeDirectoryPortal(url: string | null): Promise<{ reachable: boolean; links: string[]; error?: string }> {
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
      const linkPattern = /href=["']([^"']+)["'][^>]*>([^<]{0,80})/gi;
      for (const match of html.matchAll(linkPattern)) {
        const href = match[1] || "";
        const label = normalizeText(match[2] || "");
        const combined = normalizeText(`${href} ${label}`);
        if (!/(claim|add|submit|business|listing|profile|login|sign in|sign up|register)/.test(combined)) {
          continue;
        }
        try {
          links.push(new URL(href, res.url).toString());
        } catch {
          // Ignore malformed page links; the portal probe itself still succeeded.
        }
        if (links.length >= 8) break;
      }
    }

    return { reachable: res.ok || res.status < 500, links: Array.from(new Set(links)) };
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
  const preferred = research.discoveredLinks.find((link) => {
    return /(sign.?up|signup|free.?trial|register|create|claim|add.?business|add.?listing|submit)/i.test(link);
  });
  return (
    preferred ||
    normalizeUrl(listing.directory.submitUrl) ||
    normalizeUrl(listing.directory.claimUrl) ||
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
    const hasSso = /(single sign on|single sign-on|sso|google|office 365|microsoft)/i.test(html);
    const hasEmailField = /type=["']email["']|name=["'][^"']*(email|user(name)?)["']/i.test(html);
    const hasSignupLanguage = /(sign up|signup|free trial|create account|register|claim)/.test(page);

    if (!res.ok && res.status >= 400) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
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
        blocker: "captcha_required",
        blockerMessage: `${directoryName} requires CAPTCHA or bot-protection before account creation can continue.`,
        userActionTitle: `${directoryName} CAPTCHA required`,
        userActionMessage:
          `The agent reached the ${directoryName} account creation path, but the page requires CAPTCHA or bot-protection. ` +
          "Complete that challenge in the portal, then return so the agent can continue.",
        userActionButtonLabel: "I completed the CAPTCHA",
      };
    }

    if (hasPassword || hasSso) {
      return {
        attempted: true,
        accountCreated: false,
        credentialSaved: false,
        emailSentByFlowSmartly: false,
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
    `Trying the ${listing.directory.name} create, sign-up, or claim path before asking the user for help.`,
    {
      label: "Account creation attempt",
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
      label: "Account creation blocked",
      status: "waiting",
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
  const portalUrl =
    normalizeUrl(listing.directory.claimUrl) ||
    normalizeUrl(listing.directory.submitUrl) ||
    normalizeUrl(listing.directory.url);

  const [portal, search] = await Promise.all([
    probeDirectoryPortal(portalUrl),
    findPublicDirectoryMatch(profile, listing.directory),
  ]);

  return {
    portalUrl,
    portalReachable: portal.reachable,
    discoveredLinks: portal.links,
    searched: search.searched,
    match: search.match,
    error: portal.error || search.error,
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

export async function getAutopilotState(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
  });
  if (!profile) return null;

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
      where: { profileId: profile.id },
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
      where: { profileId: profile.id },
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
      where: { profileId: profile.id },
      _count: { status: true },
    }),
    prisma.listSmartlyAutopilotTask.groupBy({
      by: ["status"],
      where: { profileId: profile.id },
      _count: { status: true },
    }),
    prisma.listSmartlyAccountCredential.count({
      where: { profileId: profile.id },
    }),
    prisma.listSmartlyAutopilotTask.findFirst({
      where: { profileId: profile.id, status: "in_progress" },
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
      where: { profileId: profile.id, startedAt: { not: null } },
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
      canPrepareQueue: queuedCount === 0 && waitingCount === 0 && !activeTask,
      canRun: queuedCount > 0 && waitingCount === 0 && !activeTask && !dailyLimitActive,
      activeTask: activeTaskSummary,
      lastStartedAt: lastStartedTask?.startedAt || null,
      nextRunAt,
      message: activeTask
        ? `${activeTask.title} is already running. Status refreshes automatically.`
        : waitingCount > 0
          ? "Autopilot is waiting for user validation before starting another listing workflow."
        : dailyLimitActive && nextRunAt
          ? `Daily limit reached. Next autopilot run is available ${nextRunAt.toISOString()}.`
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
      secureNotes: credential.secureNotes,
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

  const listings = await prisma.businessListing.findMany({
    where: {
      profileId: profile.id,
      status: { in: WORKABLE_STATUSES },
    },
    include: {
      directory: {
        select: {
          name: true,
          url: true,
          submitUrl: true,
          claimUrl: true,
          tier: true,
          apiAvailable: true,
        },
      },
    },
    orderBy: [{ directory: { tier: "asc" } }, { updatedAt: "desc" }],
  });

  let created = 0;
  for (const listing of listings) {
    const type = taskTypeForStatus(listing.status);
    const existing = await prisma.listSmartlyAutopilotTask.findFirst({
      where: {
        profileId: profile.id,
        listingId: listing.id,
        type,
        status: { in: ["queued", "in_progress", "needs_user", "blocked"] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      await prisma.listSmartlyAutopilotTask.update({
        where: { id: existing.id },
        data: {
          payload: safeJson(buildDirectoryPayload(profile, listing)),
          ...(existing.status === "queued"
            ? {
                assignedTo: "agent",
                requiredAction: requiredActionForStatus(listing.status),
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
        priority: taskPriority(listing.status, listing.directory.tier),
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

export async function processAutopilotTask(userId: string, taskId?: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

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

  const research = await researchDirectoryWorkflow(profile, task.listing);

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

  const creationAttempt = await attemptAccountCreation(task.id, profile, task.listing, research);
  const current = parseJsonObject((await prisma.listSmartlyAutopilotTask.findUnique({
    where: { id: task.id },
    select: { result: true },
  }))?.result);

  const validationMessage =
    `${task.listing.directory.name} account creation was attempted but not completed. ${creationAttempt.blockerMessage} ` +
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

  const activeTask = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, status: { in: ["in_progress", "needs_user"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (activeTask) {
    const isWaiting = activeTask.status === "needs_user";
    return {
      status: isWaiting ? "waiting_for_user" : "already_running",
      message: isWaiting
        ? `${activeTask.title} is waiting for user validation. Autopilot will continue after the user completes that step.`
        : `${activeTask.title} is already running. Autopilot will not start another workflow at the same time.`,
      task: activeTask,
    };
  }

  const lastStartedTask = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, startedAt: { not: null } },
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
    where: { profileId: profile.id, status: "queued" },
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
        "Autopilot is running a compliant directory web workflow. It will pause only if email, SMS, phone, CAPTCHA, payment, or owner approval is required.",
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

  const processed = await processAutopilotTask(userId, updated.id);

  return {
    status: "started",
    message: processed.message || `${task.title} started. Autopilot runs one listing workflow per day.`,
    task: processed.task || updated,
    nextRunAt: addMs(new Date(), DAILY_AUTOPILOT_INTERVAL_MS),
  };
}

export async function continueAutopilotTask(userId: string, taskId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: {
      id: taskId,
      profileId: profile.id,
      status: "needs_user",
    },
    select: { id: true, result: true, title: true },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  const result = appendProgress(
    {
      ...parseJsonObject(task.result),
      stage: "validation_received",
      statusMessage: "User confirmed the validation step is complete. The agent is checking the directory again.",
      userConfirmedAt: new Date().toISOString(),
    },
    {
      stage: "validation_received",
      label: "Validation confirmed",
      status: "done",
      detail: "The agent is resuming the listing check.",
    }
  );

  await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "in_progress",
      assignedTo: "agent",
      result: safeJson(result),
      requiredAction:
        "Validation was confirmed. Autopilot is re-checking the directory and will complete the listing or ask for the next real validation step.",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  return processAutopilotTask(userId, task.id);
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
        where: { id: input.listingId, profileId: profile.id },
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
          secureNotes: input.secureNotes || null,
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
          secureNotes: input.secureNotes || null,
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
          secureNotes: input.secureNotes || null,
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
  if (action === "continue_task") return continueAutopilotTask(userId, String(body.taskId));
  if (action === "complete_task") return completeAutopilotTask(userId, String(body.taskId), body.result as Record<string, unknown>);
  if (action === "block_task") return blockAutopilotTask(userId, String(body.taskId), String(body.reason || ""));
  if (action === "request_validation") return requestAutopilotValidation(userId, String(body.taskId), String(body.reason || ""));
  if (action === "save_credential") return saveAutopilotCredential(userId, body.credential as SaveCredentialInput);
  throw new Error("UNKNOWN_ACTION");
}
