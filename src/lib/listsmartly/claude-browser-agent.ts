import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { mkdirSync } from "fs";
import os from "os";
import path from "path";
import { getClaudeCodeBinaryPath } from "@/lib/ai/design-tools/sdk-binary-path";

const AGENT_BROWSER_TIMEOUT_MS = 60000;
const AGENT_SESSION_TTL_MS = 30 * 60 * 1000;
const AGENT_RUN_TIMEOUT_MS = Number(process.env.LISTSMARTLY_AGENT_RUN_TIMEOUT_MS || 420000);
const AGENT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const AGENT_BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ActiveAgentSession = {
  browser: any;
  page: any;
  generatedPassword: string;
  expiresAt: number;
  directoryName: string;
  remoteCursor?: { x: number; y: number; at: number };
  lastHumanActionAt?: number;
};

type AgentSessionStore = Map<string, ActiveAgentSession>;

const globalWithAgentSessions = globalThis as typeof globalThis & {
  __flowSmartlyListSmartlyAgentSessions?: AgentSessionStore;
};
const ACTIVE_AGENT_SESSIONS =
  globalWithAgentSessions.__flowSmartlyListSmartlyAgentSessions || new Map<string, ActiveAgentSession>();
globalWithAgentSessions.__flowSmartlyListSmartlyAgentSessions = ACTIVE_AGENT_SESSIONS;

function workflowSessionKey(workflowId?: string | null): string | null {
  return workflowId ? workflowId.replace(/[^a-zA-Z0-9_-]+/g, "_") : null;
}

function cleanupExpiredAgentSessions(now = Date.now()) {
  for (const [key, session] of ACTIVE_AGENT_SESSIONS.entries()) {
    if (session.expiresAt > now) continue;
    ACTIVE_AGENT_SESSIONS.delete(key);
    void session.browser?.close?.().catch(() => undefined);
  }
}

function shouldHoldAgentSession(outcome: ListSmartlyAgentOutcome | null): boolean {
  return Boolean(
    outcome?.status === "needs_user" ||
      (outcome?.status === "pending" &&
        (outcome.stage === "agent_sdk_retry_needed" || outcome.stage === "agent_review_pending"))
  );
}

export function hasActiveListSmartlyAgentSession(workflowId?: string | null): boolean {
  cleanupExpiredAgentSessions();
  const sessionKey = workflowSessionKey(workflowId);
  if (!sessionKey) return false;
  const session = ACTIVE_AGENT_SESSIONS.get(sessionKey);
  return Boolean(session && session.expiresAt > Date.now() && !session.page?.isClosed?.());
}

export type ListSmartlyAgentBrowserView = {
  active: boolean;
  url?: string;
  title?: string;
  image?: string;
  contentType?: string;
  viewport?: { width: number; height: number };
  expiresAt?: string;
  directoryName?: string;
  cursor?: { x: number; y: number; at: string };
  lastHumanActionAt?: string;
  reason?: string;
};

export type ListSmartlyAgentBrowserControl =
  | { action: "click"; x: number; y: number }
  | { action: "mouse_down"; x: number; y: number }
  | { action: "mouse_up"; x?: number; y?: number }
  | { action: "press_hold"; x?: number; y?: number; durationMs?: number }
  | { action: "type"; text: string }
  | { action: "key"; key: string }
  | { action: "scroll"; deltaY: number }
  | { action: "refresh" };

function getActiveAgentSession(workflowId?: string | null): ActiveAgentSession | null {
  cleanupExpiredAgentSessions();
  const sessionKey = workflowSessionKey(workflowId);
  if (!sessionKey) return null;
  const session = ACTIVE_AGENT_SESSIONS.get(sessionKey);
  if (!session || session.expiresAt <= Date.now() || session.page?.isClosed?.()) return null;
  session.expiresAt = Date.now() + AGENT_SESSION_TTL_MS;
  return session;
}

function publishActiveAgentSession(
  sessionKey: string | null,
  session: Omit<ActiveAgentSession, "expiresAt" | "remoteCursor" | "lastHumanActionAt">
) {
  if (!sessionKey) return;
  const previous = ACTIVE_AGENT_SESSIONS.get(sessionKey);
  ACTIVE_AGENT_SESSIONS.set(sessionKey, {
    ...session,
    expiresAt: Date.now() + AGENT_SESSION_TTL_MS,
    remoteCursor: previous?.remoteCursor,
    lastHumanActionAt: previous?.lastHumanActionAt,
  });
}

async function launchAgentBrowser(puppeteer: any, userDataDir?: string, sessionKey?: string | null) {
  const launchOptions = (dir?: string) => ({
    headless: true,
    userDataDir: dir,
    protocolTimeout: 180000,
    args: AGENT_BROWSER_ARGS,
  });

  try {
    return { browser: await puppeteer.launch(launchOptions(userDataDir)), userDataDir, recoveredStaleProfile: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const profileLocked = Boolean(userDataDir && /browser is already running|userDataDir|SingletonLock/i.test(message));
    if (!profileLocked) throw error;

    const fallbackDir = path.join(
      os.tmpdir(),
      "flowsmartly-listsmartly-agent",
      `${sessionKey || "workflow"}-${Date.now()}`
    );
    mkdirSync(fallbackDir, { recursive: true });
    return {
      browser: await puppeteer.launch(launchOptions(fallbackDir)),
      userDataDir: fallbackDir,
      recoveredStaleProfile: true,
    };
  }
}

export async function getListSmartlyAgentBrowserView(workflowId?: string | null): Promise<ListSmartlyAgentBrowserView> {
  const session = getActiveAgentSession(workflowId);
  if (!session) return { active: false, reason: "No live browser session is currently attached to this workflow." };

  const viewport = session.page.viewport?.() || { width: 1365, height: 900 };
  const screenshot = await Promise.race([
    session.page
      .screenshot({
        type: "jpeg",
        quality: 72,
        encoding: "base64",
        captureBeyondViewport: false,
      })
      .then((image: string) => ({ image }))
      .catch((error: unknown) => ({
        reason: error instanceof Error ? error.message : "Live browser screenshot failed.",
      })),
    delay(12000).then(() => ({ reason: "Live browser screenshot is busy; retrying." })),
  ]);

  return {
    active: true,
    url: session.page.url?.() || "",
    title: await session.page.title?.().catch(() => "") || "",
    image: "image" in screenshot ? screenshot.image : undefined,
    contentType: "image/jpeg",
    viewport: { width: viewport.width || 1365, height: viewport.height || 900 },
    expiresAt: new Date(session.expiresAt).toISOString(),
    directoryName: session.directoryName,
    reason: "reason" in screenshot ? screenshot.reason : undefined,
    cursor: session.remoteCursor
      ? { x: session.remoteCursor.x, y: session.remoteCursor.y, at: new Date(session.remoteCursor.at).toISOString() }
      : undefined,
    lastHumanActionAt: session.lastHumanActionAt ? new Date(session.lastHumanActionAt).toISOString() : undefined,
  };
}

export async function getListSmartlyAgentBrowserStatus(workflowId?: string | null): Promise<
  | {
      active: true;
      url: string;
      title: string;
      text: string;
      blockers: BrowserSnapshot["blockers"];
    }
  | { active: false; reason: string }
> {
  const session = getActiveAgentSession(workflowId);
  if (!session) return { active: false, reason: "No live browser session is currently attached to this workflow." };
  const snapshot = await observePage(session.page);
  return {
    active: true,
    url: snapshot.url,
    title: snapshot.title,
    text: snapshot.text,
    blockers: snapshot.blockers,
  };
}

export async function controlListSmartlyAgentBrowser(
  workflowId: string | null | undefined,
  control: ListSmartlyAgentBrowserControl
): Promise<ListSmartlyAgentBrowserView> {
  const session = getActiveAgentSession(workflowId);
  if (!session) return { active: false, reason: "The live browser session has expired. Run the agent again to reopen it." };

  const viewport = session.page.viewport?.() || { width: 1365, height: 900 };
  const clampPoint = (x?: number, y?: number) => ({
    x: Math.max(0, Math.min(viewport.width || 1365, Math.round(Number.isFinite(x) ? Number(x) : (viewport.width || 1365) / 2))),
    y: Math.max(0, Math.min(viewport.height || 900, Math.round(Number.isFinite(y) ? Number(y) : (viewport.height || 900) / 2))),
  });
  const findPressHoldPoint = async (): Promise<{ x: number; y: number } | null> =>
    session.page
      .evaluate(() => {
        const visible = (el: Element) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
        };
        const candidates = Array.from(
          document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a, div, span')
        );
        for (const el of candidates) {
          if (!visible(el)) continue;
          const text = `${el.textContent || ""} ${(el as HTMLElement).getAttribute("aria-label") || ""} ${
            (el as HTMLElement).getAttribute("title") || ""
          }`.replace(/\s+/g, " ");
          if (!/press\s+and\s+hold/i.test(text)) continue;
          const rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return null;
      })
      .catch(() => null);
  const pressHoldChallengeVisible = async (): Promise<boolean> =>
    session.page
      .evaluate(() => /help us beat the robots|press\s+and\s+hold|not a robot|human verification/i.test(document.body?.innerText || ""))
      .catch(() => false);
  let settleMs = 4000;

  if (control.action === "click") {
    const { x, y } = clampPoint(control.x, control.y);
    await session.page.mouse.move(x, y);
    await session.page.mouse.click(x, y);
    session.remoteCursor = { x, y, at: Date.now() };
  } else if (control.action === "mouse_down") {
    const { x, y } = clampPoint(control.x, control.y);
    await session.page.mouse.move(x, y);
    await session.page.mouse.down();
    session.remoteCursor = { x, y, at: Date.now() };
    settleMs = 0;
  } else if (control.action === "mouse_up") {
    const { x, y } = clampPoint(control.x, control.y);
    await session.page.mouse.move(x, y);
    await session.page.mouse.up();
    session.remoteCursor = { x, y, at: Date.now() };
    settleMs = 3500;
  } else if (control.action === "press_hold") {
    const point =
      Number.isFinite(control.x) && Number.isFinite(control.y)
        ? clampPoint(control.x, control.y)
        : (await findPressHoldPoint()) || clampPoint(session.remoteCursor?.x, session.remoteCursor?.y);
    const durationMs = Math.max(12000, Math.min(24000, Math.round(control.durationMs || 18000)));
    const minimumHoldMs = Math.min(12000, durationMs);
    await session.page.mouse.move(point.x, point.y);
    await session.page.mouse.down();
    session.remoteCursor = { x: point.x, y: point.y, at: Date.now() };
    const startedAt = Date.now();
    try {
      while (Date.now() - startedAt < durationMs) {
        await delay(750);
        if (Date.now() - startedAt < minimumHoldMs) continue;
        if (!(await pressHoldChallengeVisible())) break;
      }
    } finally {
      await session.page.mouse.up().catch(() => undefined);
    }
    settleMs = 3500;
  } else if (control.action === "type") {
    await session.page.keyboard.type(control.text.slice(0, 500), { delay: 20 });
  } else if (control.action === "key") {
    const allowedKeys = new Set([
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ]);
    if (allowedKeys.has(control.key)) await session.page.keyboard.press(control.key);
  } else if (control.action === "scroll") {
    await session.page.mouse.wheel({ deltaY: Math.max(-2000, Math.min(2000, Math.round(control.deltaY))) });
  } else if (control.action === "refresh") {
    await session.page.reload({ waitUntil: "domcontentloaded", timeout: AGENT_BROWSER_TIMEOUT_MS }).catch(() => undefined);
  }

  session.lastHumanActionAt = Date.now();
  if (settleMs > 0) await settle(session.page, settleMs);
  return getListSmartlyAgentBrowserView(workflowId);
}

export type ListSmartlyAgentProfile = {
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

export type ListSmartlyAgentContinuation = {
  verificationCode?: string | null;
  savedLoginEmail?: string | null;
  savedLoginPassword?: string | null;
};

export type ListSmartlyAgentOutcome = {
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
  verificationCodeAttempted?: boolean;
  generatedPassword?: string;
  passwordHint?: string;
  diagnostics?: Record<string, unknown>;
};

type ProgressCallback = (event: {
  stage: string;
  label: string;
  status: "done" | "active" | "waiting" | "failed";
  detail?: string;
  extra?: Record<string, unknown>;
}) => Promise<void> | void;

export type BrowserSnapshot = {
  url: string;
  title: string;
  text: string;
  controls: Array<{
    index: number;
    tag: string;
    type: string;
    name: string;
    id: string;
    placeholder: string;
    autocomplete: string;
    label: string;
    value: string;
    required: boolean;
  }>;
  buttons: Array<{ index: number; tag: string; text: string; label: string; href: string; type: string }>;
  blockers: {
    captcha: boolean;
    emailVerification: boolean;
    phoneVerification: boolean;
    payment: boolean;
    loginOrSso: boolean;
    businessEmailRejected: boolean;
  };
};

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data),
      },
    ],
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitContactName(profile: ListSmartlyAgentProfile): { firstName: string; lastName: string } {
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

function safePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let core = "";
  for (let i = 0; i < 14; i++) {
    core += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Fs!${core}7Aa`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function isVagueCategory(value: string | null | undefined): boolean {
  return !value || /^(other|local business|business|general|misc|miscellaneous|unknown)$/i.test(value.trim());
}

function inferBusinessCategorySuggestions(profile: ListSmartlyAgentProfile): string[] {
  const haystack = `${profile.businessName || ""} ${profile.industry || ""} ${profile.description || ""} ${
    profile.website || ""
  }`.toLowerCase();
  const suggestions: string[] = [];
  const add = (...values: string[]) => suggestions.push(...values);

  if (/(church|ministry|ministries|chapel|parish|religious|worship|temple|synagogue|mosque)/i.test(haystack)) {
    add("Churches", "Religious Organizations");
  } else if (/(restaurant|pizza|cafe|coffee|bakery|barbecue|bbq|diner|food|catering)/i.test(haystack)) {
    add("Restaurants", "Food");
  } else if (/(plumb|hvac|electric|roof|contractor|construction|handyman|repair)/i.test(haystack)) {
    add("Contractors", "Home Services");
  } else if (/(tax|accounting|bookkeep|payroll|financial service|insurance)/i.test(haystack)) {
    add("Tax Services", "Accountants", "Financial Services");
  } else if (/(real estate|realtor|property|apartment|home sale|broker)/i.test(haystack)) {
    add("Real Estate Services", "Real Estate Agents");
  } else if (/(salon|barber|spa|beauty|hair|nail|massage)/i.test(haystack)) {
    add("Hair Salons", "Beauty & Spas");
  } else if (/(doctor|clinic|medical|dentist|health|therapy|wellness)/i.test(haystack)) {
    add("Health & Medical");
  } else if (/(law|attorney|legal)/i.test(haystack)) {
    add("Lawyers", "Legal Services");
  }

  if (!isVagueCategory(profile.industry)) add(profile.industry || "");

  return uniqueStrings(suggestions).slice(0, 3);
}

async function settle(page: any, timeout = 12000) {
  try {
    await page.waitForNetworkIdle({ idleTime: 700, timeout });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
}

function valuesForProfile(
  profile: ListSmartlyAgentProfile,
  generatedPassword: string,
  continuation?: ListSmartlyAgentContinuation
) {
  const { firstName, lastName } = splitContactName(profile);
  const businessCategorySuggestions = inferBusinessCategorySuggestions(profile);
  const businessCategory = businessCategorySuggestions[0] || (!isVagueCategory(profile.industry) ? profile.industry || "" : "");
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    businessName: profile.businessName || "",
    email: profile.email || "",
    password: continuation?.savedLoginPassword || generatedPassword,
    savedLoginEmail: continuation?.savedLoginEmail || profile.email || "",
    savedLoginPassword: continuation?.savedLoginPassword || "",
    phone: profile.phone || "",
    website: profile.website || "",
    address: profile.address || "",
    city: profile.city || "",
    state: profile.state || "",
    zip: profile.zip || "",
    country: profile.country || "United States",
    birthMonth: "January",
    birthMonthNumber: "1",
    birthDay: "1",
    birthYear: "1990",
    contactTitle: "Owner",
    businessRole: "Owner",
    employeeCount: "1-10",
    businessType: "Local business",
    businessCategory,
    businessCategories: businessCategorySuggestions.join(", "),
    industry: profile.industry || "",
    yearFounded: profile.yearFounded || "",
    description: profile.description || "",
    verificationCode: (continuation?.verificationCode || "").replace(/\s+/g, ""),
  };
}

function defaultOutcome(params: {
  status: ListSmartlyAgentOutcome["status"];
  stage: string;
  message: string;
  actionTitle: string;
  actionButtonLabel: string;
  actionInputKind?: ListSmartlyAgentOutcome["actionInputKind"];
  actionInputLabel?: string;
  actionInputPlaceholder?: string;
  actionInputRequired?: boolean;
  portalUrl: string;
  accountCreated?: boolean;
  generatedPassword?: string;
  diagnostics?: Record<string, unknown>;
}): ListSmartlyAgentOutcome {
  return {
    status: params.status,
    stage: params.stage,
    message: params.message,
    actionTitle: params.actionTitle,
    actionButtonLabel: params.actionButtonLabel,
    actionInputKind: params.actionInputKind,
    actionInputLabel: params.actionInputLabel,
    actionInputPlaceholder: params.actionInputPlaceholder,
    actionInputRequired: params.actionInputRequired,
    portalUrl: params.portalUrl,
    accountCreated: Boolean(params.accountCreated),
    credentialSaved: Boolean(params.generatedPassword),
    emailSentByFlowSmartly: false,
    generatedPassword: params.generatedPassword,
    passwordHint: params.generatedPassword ? "Generated by FlowSmartly ListSmartly Agent." : undefined,
    diagnostics: params.diagnostics,
  };
}

function latestObservedBlockers(progressLog: Array<Record<string, unknown>>): BrowserSnapshot["blockers"] | null {
  for (let index = progressLog.length - 1; index >= 0; index -= 1) {
    const blockers = progressLog[index]?.blockers;
    if (blockers && typeof blockers === "object") return blockers as BrowserSnapshot["blockers"];
  }
  return null;
}

function isLikelyPersonalEmail(email?: string | null): boolean {
  const domain = (email || "").split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "ymail.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "mail.com",
  ]).has(domain);
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] || "a real validation step";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function verificationCodeWasSubmitted(progressLog: Array<Record<string, unknown>>): boolean {
  return progressLog.some((entry) => {
    if (entry.tool !== "fill_verification_code") return false;
    const result = entry.result;
    return Boolean(result && typeof result === "object" && "filled" in result && result.filled);
  });
}

function normalizeNeedsUserOutcome(params: {
  directoryName: string;
  profile: ListSmartlyAgentProfile;
  outcome: ListSmartlyAgentOutcome;
  progressLog: Array<Record<string, unknown>>;
}): ListSmartlyAgentOutcome {
  const { directoryName, profile, outcome, progressLog } = params;
  if (!["needs_user", "blocked", "pending"].includes(outcome.status)) return outcome;

  const blockers = latestObservedBlockers(progressLog);
  const personalEmail = isLikelyPersonalEmail(profile.email);
  const reasons: string[] = [];
  const outcomeContext = `${outcome.stage || ""} ${outcome.actionTitle || ""} ${outcome.message || ""}`;
  const inferredCaptcha = /(captcha|bot.?protection|robot|press and hold|human verification)/i.test(outcomeContext);
  const inferredEmailVerification = /(email verification|verify your email|enter code|verification code|one.?time code|check your email)/i.test(
    outcomeContext
  );
  const inferredPhoneVerification = /(phone verification|sms|text message|verify your phone)/i.test(outcomeContext);
  const inferredPayment = /(payment|billing|credit card|checkout)/i.test(outcomeContext);
  const inferredBusinessEmail =
    /(business email|work email|company email|valid email)/i.test(outcomeContext) &&
    !inferredEmailVerification;
  const inferredLoginAccess = /(approved access|login access|sign in required|password reset|existing account)/i.test(outcomeContext);
  const userShouldNotDoAgentWork =
    /(fill (in|out)|complete the .*form|create .*password|password:|click continue|finish .*sign.?up|enter .*password)/i.test(
      outcome.message
    );

  const emailVerificationAccountCreated = Boolean(blockers?.emailVerification || inferredEmailVerification);
  const verificationCodeAttempted = Boolean(
    (blockers?.emailVerification || inferredEmailVerification) && verificationCodeWasSubmitted(progressLog)
  );

  if (blockers?.captcha || inferredCaptcha) reasons.push("complete the CAPTCHA or bot-protection challenge");
  if (blockers?.emailVerification || inferredEmailVerification) reasons.push("provide the email verification code");
  if (blockers?.phoneVerification || inferredPhoneVerification) reasons.push("verify the phone or SMS challenge");
  if ((blockers?.businessEmailRejected || inferredBusinessEmail) && personalEmail) {
    reasons.push(`add or approve a business email because ${profile.email} appears to be a personal email`);
  } else if (blockers?.businessEmailRejected || inferredBusinessEmail) {
    reasons.push("confirm the business email requested by the directory");
  }
  if (blockers?.payment || inferredPayment) reasons.push("confirm the payment or billing choice");
  if (blockers?.loginOrSso || inferredLoginAccess) reasons.push("provide approved directory login access");

  if (!reasons.length && !userShouldNotDoAgentWork) {
    return {
      ...outcome,
      credentialSaved: outcome.accountCreated && outcome.credentialSaved,
      generatedPassword: outcome.accountCreated && outcome.credentialSaved ? outcome.generatedPassword : undefined,
      passwordHint: outcome.accountCreated && outcome.credentialSaved ? outcome.passwordHint : undefined,
    };
  }

  const stage = blockers?.captcha || inferredCaptcha
    ? "waiting_for_captcha"
    : blockers?.emailVerification || inferredEmailVerification
      ? "waiting_for_email_verification"
      : blockers?.phoneVerification || inferredPhoneVerification
        ? "waiting_for_phone_verification"
        : blockers?.businessEmailRejected || inferredBusinessEmail
          ? "waiting_for_business_email"
          : blockers?.payment || inferredPayment
            ? "waiting_for_payment_confirmation"
            : blockers?.loginOrSso || inferredLoginAccess
              ? "waiting_for_approved_access"
              : outcome.stage || "waiting_for_user_validation";
  const actionTitle =
    stage === "waiting_for_captcha"
      ? `${directoryName} CAPTCHA required`
      : stage === "waiting_for_business_email"
        ? "Business email needed"
        : stage === "waiting_for_email_verification"
          ? verificationCodeAttempted
            ? `${directoryName} still needs a valid email code`
            : `${directoryName} email verification needed`
          : stage === "waiting_for_phone_verification"
            ? `${directoryName} phone verification needed`
            : stage === "waiting_for_payment_confirmation"
              ? `${directoryName} payment confirmation needed`
              : `${directoryName} validation needed`;
  const actionButtonLabel =
    stage === "waiting_for_captcha"
      ? "I completed the CAPTCHA"
      : stage === "waiting_for_business_email"
        ? "I updated the business email"
        : stage === "waiting_for_email_verification"
          ? verificationCodeAttempted
            ? "Submit new code"
            : "Submit code to agent"
          : stage === "waiting_for_phone_verification"
            ? "I verified the phone"
            : stage === "waiting_for_payment_confirmation"
              ? "I confirmed payment"
              : "I completed validation";
  const actionInput =
    stage === "waiting_for_email_verification"
      ? {
          actionInputKind: "verification_code" as const,
          actionInputLabel: `${directoryName} verification code`,
          actionInputPlaceholder: "Enter the code from the email",
          actionInputRequired: true,
        }
      : {};
  const reasonText = humanList(reasons);
  const message =
    stage === "waiting_for_email_verification"
      ? verificationCodeAttempted
        ? `The AI agent submitted the email verification code for ${directoryName}, but the directory kept the verification screen open. The code was rejected or expired. Enter the newest code from the email in ListSmartly; the agent will submit it in the same live browser session and continue.`
        : `The account sign-up reached email verification at ${outcome.portalUrl}. Enter the code from the email in ListSmartly, then the AI agent will submit it and continue the remaining listing workflow.`
      : `The agent reached ${outcome.portalUrl} and paused because it needs the user to ${reasonText}. ` +
        "Complete only that validation or missing profile detail, " +
        `then click "${actionButtonLabel}" in ListSmartly. The agent will continue the remaining form work.`;
  const normalizedAccountCreated = emailVerificationAccountCreated || outcome.accountCreated;
  const normalizedGeneratedPassword =
    normalizedAccountCreated && outcome.generatedPassword ? outcome.generatedPassword : undefined;

  return {
    ...outcome,
    status: reasons.length ? "needs_user" : outcome.status,
    stage,
    message,
    actionTitle,
    actionButtonLabel,
    ...actionInput,
    accountCreated: normalizedAccountCreated,
    credentialSaved: Boolean(normalizedGeneratedPassword),
    verificationCodeAttempted,
    generatedPassword: normalizedGeneratedPassword,
    passwordHint: normalizedGeneratedPassword ? outcome.passwordHint : undefined,
  };
}

async function observePage(page: any): Promise<BrowserSnapshot> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
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
        el.getAttribute("autocomplete") || "",
        id || "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    };
    const pageText = document.body.innerText.replace(/\s+/g, " ").trim();
    const pageContext = `${location.href} ${document.title} ${pageText}`;
    const visibleTextFor = (selector: string) =>
      Array.from(document.querySelectorAll(selector))
        .filter((el) => visible(el))
        .map((el) => el.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    const alertText = visibleTextFor(
      '[role="alert"], [aria-live], .error, .errors, .field-error, .form-error, .invalid-feedback, .validation-message, .help-block'
    );
    const visibleCaptchaElement = Array.from(
      document.querySelectorAll("iframe, div, section, form, input")
    ).some((el) => {
      if (!visible(el)) return false;
      const rect = el.getBoundingClientRect();
      const marker = [
        el.getAttribute("src") || "",
        el.getAttribute("title") || "",
        el.getAttribute("aria-label") || "",
        el.getAttribute("id") || "",
        el.getAttribute("class") || "",
        el.getAttribute("name") || "",
      ].join(" ");
      if (!/(recaptcha|hcaptcha|turnstile|captcha|cloudflare challenge)/i.test(marker)) return false;
      if (/badge|invisible|anchor/i.test(marker)) return false;
      return rect.width >= 180 && rect.height >= 80;
    });
    const buttons = Array.from(
      document.querySelectorAll(
        'button, a, input[type=submit], input[type=button], [role="button"], [onclick], [tabindex]:not([tabindex="-1"])'
      )
    )
      .filter((el) => visible(el))
      .map((el: any, index) => ({
        index,
        tag: el.tagName,
        text: (el.innerText || el.textContent || el.getAttribute("value") || el.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 140),
        label: [
          el.getAttribute("aria-label") || "",
          el.getAttribute("title") || "",
          el.getAttribute("name") || "",
          el.getAttribute("id") || "",
        ]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 140),
        href: el.href || "",
        type: el.getAttribute("type") || "",
      }))
      .filter((item) => item.text || item.label || item.href)
      .slice(0, 80);
    const buttonContext = buttons.map((item) => `${item.text} ${item.label}`).join(" ");
    return {
      url: location.href,
      title: document.title,
      text: pageText.slice(0, 5000),
      controls: Array.from(document.querySelectorAll("input, textarea, select"))
        .filter((el) => visible(el))
        .map((el: any, index) => ({
          index,
          tag: el.tagName,
          type: (el.getAttribute("type") || "").toLowerCase(),
          name: el.getAttribute("name") || "",
          id: el.getAttribute("id") || "",
          placeholder: el.getAttribute("placeholder") || "",
          autocomplete: el.getAttribute("autocomplete") || "",
          label: labelFor(el),
          value: el.value ? "[filled]" : "",
          required: Boolean(el.required || el.getAttribute("aria-required") === "true"),
        })),
      buttons,
      blockers: {
        captcha:
          visibleCaptchaElement ||
          /(complete the captcha|captcha required|recaptcha|hcaptcha|turnstile|cloudflare challenge|help us beat the robots|press and hold|not a robot|human verification|bot.?protection)/i.test(pageContext),
        emailVerification: /(verify[-_\s]?email|verify your email|email verification|verification code|one.?time verification code|check your email|confirmation email|email has been sent|enter the code)/i.test(pageContext),
        phoneVerification: /(verify your phone|sms code|text message|phone verification|call you)/i.test(pageContext),
        payment: /(payment|credit card|checkout|billing information|expedite)/i.test(pageContext),
        loginOrSso: /(single sign.?on|\bsso\b|sign in with google|continue with google|sign in with microsoft|microsoft account|work account|office 365|continue with facebook)/i.test(
          buttonContext
        ),
        businessEmailRejected: /(provide a valid business email|please enter a valid business email|valid work email|company email required|free email domain|business email is required|invalid business email)/i.test(
          `${alertText} ${pageText}`
        ),
      },
    };
  });
}

export async function runClaudeListSmartlyBrowserAgent(params: {
  profile: ListSmartlyAgentProfile;
  directoryName: string;
  directorySlug?: string | null;
  startUrl: string;
  workflowId?: string | null;
  continuation?: ListSmartlyAgentContinuation;
  onProgress?: ProgressCallback;
}): Promise<ListSmartlyAgentOutcome> {
  const { profile, directoryName, directorySlug, startUrl, workflowId, continuation, onProgress } = params;
  cleanupExpiredAgentSessions();
  const sessionKey = workflowSessionKey(workflowId);
  const heldSession = sessionKey ? ACTIVE_AGENT_SESSIONS.get(sessionKey) || null : null;
  const puppeteer = (await import("puppeteer")).default;
  const userDataDir = sessionKey
    ? path.join(os.tmpdir(), "flowsmartly-listsmartly-agent", sessionKey)
    : undefined;
  if (userDataDir) mkdirSync(userDataDir, { recursive: true });

  let browser: any = null;
  let page: any = null;
  let generatedPassword = continuation?.savedLoginPassword || heldSession?.generatedPassword || safePassword();
  let reusedHeldSession = false;
  let recoveredStaleProfile = false;

  if (heldSession && !heldSession.page?.isClosed?.()) {
    browser = heldSession.browser;
    page = heldSession.page;
    generatedPassword = heldSession.generatedPassword;
    heldSession.expiresAt = Date.now() + AGENT_SESSION_TTL_MS;
    reusedHeldSession = true;
    publishActiveAgentSession(sessionKey, { browser, page, generatedPassword, directoryName });
  } else {
    if (sessionKey && heldSession) ACTIVE_AGENT_SESSIONS.delete(sessionKey);
    await heldSession?.browser?.close?.().catch(() => undefined);
    const launch = await launchAgentBrowser(puppeteer, userDataDir, sessionKey);
    browser = launch.browser;
    recoveredStaleProfile = launch.recoveredStaleProfile;
    page = await browser.newPage();
    publishActiveAgentSession(sessionKey, { browser, page, generatedPassword, directoryName });
  }

  let finalOutcome: ListSmartlyAgentOutcome | null = null;
  const toolCalls: string[] = [];
  const progressLog: Array<Record<string, unknown>> = [];

  try {
    page.setDefaultTimeout(AGENT_BROWSER_TIMEOUT_MS);
    if (!reusedHeldSession) {
      await page.setViewport({ width: 1365, height: 900 });
      await page.setUserAgent(AGENT_USER_AGENT);
    }
    if (!reusedHeldSession) {
      await page.evaluateOnNewDocument("window.__name = function(fn) { return fn; };");
      await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: AGENT_BROWSER_TIMEOUT_MS });
      await page.addScriptTag({ content: "window.__name = function(fn) { return fn; };" }).catch(() => undefined);
      await settle(page);
    } else {
      await settle(page, 5000);
    }

    await onProgress?.({
      stage: reusedHeldSession ? "agent_browser_session_resumed" : "claude_agent_started",
      label: reusedHeldSession ? "Verification session resumed" : "Claude agent started",
      status: "active",
      detail: reusedHeldSession
        ? `Agent resumed the open ${directoryName} verification page without requesting a new code.`
        : recoveredStaleProfile
          ? `Agent opened ${directoryName} in a fresh controlled browser because a stale browser profile was locked.`
          : `Agent opened ${directoryName}.`,
      extra: {
        agentEngine: "claude_agent_sdk",
        portalUrl: page.url(),
        browserSessionResumed: reusedHeldSession,
        recoveredStaleProfile,
      },
    });

    const profileValues = valuesForProfile(profile, generatedPassword, continuation);
    const businessCategorySuggestions = inferBusinessCategorySuggestions(profile);

    const tools = [
      tool(
        "navigate",
        "Navigate the controlled browser to a public URL from the current directory workflow. Use when a visible link href is the correct next step or when returning to the current portal after user validation.",
        {
          url: z.string().url(),
        },
        async (args) => {
          await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: AGENT_BROWSER_TIMEOUT_MS });
          await settle(page, 15000);
          await onProgress?.({
            stage: "agent_navigated",
            label: "Navigated",
            status: "active",
            detail: args.url,
            extra: { portalUrl: page.url(), agentEngine: "claude_agent_sdk" },
          });
          progressLog.push({ tool: "navigate", url: page.url() });
          return ok({ url: page.url(), title: await page.title() });
        }
      ),
      tool(
        "observe_page",
        "Read the current browser page. Use before every decision. It returns URL, title, visible controls/buttons, visible text, and blocker flags.",
        {},
        async () => {
          const snapshot = await observePage(page);
          await onProgress?.({
            stage: "agent_observed_page",
            label: "Page observed",
            status: "active",
            detail: `${snapshot.title || snapshot.url}`,
            extra: { portalUrl: snapshot.url },
          });
          progressLog.push({ tool: "observe_page", url: snapshot.url, title: snapshot.title, blockers: snapshot.blockers });
          return ok(snapshot);
        }
      ),
      tool(
        "set_business_categories",
        "Use on pages that ask for business categories before clicking Continue. It clears unrelated selected category chips, types approved inferred categories, and selects matching autocomplete suggestions. Never choose unrelated categories.",
        {
          maxCategories: z.number().int().min(1).max(3).optional(),
        },
        async (args) => {
          const suggestions = businessCategorySuggestions.slice(0, args.maxCategories || 3);
          if (suggestions.length === 0) {
            const snapshot = await observePage(page);
            return ok({
              set: false,
              reason: "No specific business category could be inferred from the approved profile.",
              url: snapshot.url,
              title: snapshot.title,
            });
          }

          const removed = await page
            .evaluate(() => {
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
              const controls = Array.from(document.querySelectorAll('button, [role="button"], a')) as HTMLElement[];
              let removedCount = 0;
              for (const control of controls) {
                if (!visible(control)) continue;
                const text = normalize(control.innerText || control.textContent || "");
                const marker = normalize(
                  `${text} ${control.getAttribute("aria-label") || ""} ${control.getAttribute("title") || ""}`
                );
                const containerText = normalize(
                  control.closest('li, [class*="chip"], [class*="tag"], [class*="pill"], [class*="category"]')
                    ?.textContent || ""
                );
                const looksLikeRemove =
                  /(remove|delete|clear|close)/i.test(marker) ||
                  /^[x\u00d7\u2715\u2716]$/i.test(text) ||
                  /[x\u00d7\u2715\u2716]$/.test(text);
                const looksLikeCategoryChip =
                  /category|business|service|shopping|event|stationery|office|church|religious|restaurant|contractor/i.test(
                    `${marker} ${containerText}`
                  );
                if (!looksLikeRemove || !looksLikeCategoryChip) continue;
                control.click();
                removedCount += 1;
                if (removedCount >= 5) break;
              }
              return removedCount;
            })
            .catch(() => 0);

          const findCategoryInput = async () => {
            const handle = await page.evaluateHandle(() => {
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              const labelFor = (el: Element) => {
                const id = el.getAttribute("id");
                const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
                const implicit = el.closest("label")?.textContent || "";
                return [
                  explicit,
                  implicit,
                  el.getAttribute("aria-label") || "",
                  el.getAttribute("placeholder") || "",
                  el.getAttribute("name") || "",
                  el.getAttribute("autocomplete") || "",
                  el.getAttribute("role") || "",
                  id || "",
                ]
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              };
              const candidates = Array.from(
                document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"], [role="combobox"], [role="textbox"]')
              ) as HTMLElement[];
              const scored = candidates
                .filter((el) => visible(el) && !("disabled" in el && (el as HTMLInputElement).disabled))
                .map((el) => {
                  const label = labelFor(el);
                  let score = 0;
                  if (/business categories?|categories?|category|industry/i.test(label)) score += 10;
                  if (/combobox|textbox/i.test(el.getAttribute("role") || "")) score += 2;
                  if (/business categories?/i.test(label)) score += 5;
                  return { el, score };
                })
                .filter((item) => item.score > 0)
                .sort((a, b) => b.score - a.score);
              return scored[0]?.el || null;
            });
            const element = handle.asElement();
            if (!element) await handle.dispose?.().catch(() => undefined);
            return element;
          };

          const chooseVisibleSuggestion = async (suggestion: string) =>
            page
              .evaluate((suggestionText: string) => {
                const visible = (el: Element) => {
                  const style = window.getComputedStyle(el);
                  const rect = el.getBoundingClientRect();
                  return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
                };
                const normalize = (value: string) =>
                  value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .trim();
                const wanted = normalize(suggestionText);
                const candidates = Array.from(
                  document.querySelectorAll('[role="option"], li, button, [role="button"], a, div, span')
                ) as HTMLElement[];
                for (const candidate of candidates) {
                  if (!visible(candidate)) continue;
                  const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "")
                    .replace(/\s+/g, " ")
                    .trim();
                  if (!text || text.length > 120 || /no results|search for|continue|back/i.test(text)) continue;
                  const normalized = normalize(text);
                  if (!normalized || (!normalized.includes(wanted) && !wanted.includes(normalized))) continue;
                  candidate.click();
                  return text;
                }
                return "";
              }, suggestion)
              .catch(() => "");

          const added: string[] = [];
          for (const suggestion of suggestions) {
            const input = await findCategoryInput();
            if (!input) break;
            try {
              await input.click({ delay: 40 });
              await input.evaluate((el: HTMLInputElement | HTMLTextAreaElement | HTMLElement) => {
                if ("value" in el) {
                  const prototype =
                    el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                  if (setter) setter.call(el, "");
                  else el.value = "";
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                } else {
                  el.textContent = "";
                }
              });
              await page.keyboard.type(suggestion, { delay: 35 });
              await delay(900);
              const picked = await chooseVisibleSuggestion(suggestion);
              if (!picked) {
                await page.keyboard.press("ArrowDown").catch(() => undefined);
                await delay(150);
                await page.keyboard.press("Enter").catch(() => undefined);
              }
              await settle(page, 2500);
              added.push(picked || suggestion);
            } finally {
              await input.dispose?.().catch(() => undefined);
            }
          }

          await onProgress?.({
            stage: "agent_set_business_categories",
            label: "Business categories set",
            status: "active",
            detail: added.length
              ? added.join(", ")
              : `Could not find the visible category input for ${suggestions.join(", ")}.`,
            extra: { portalUrl: page.url(), businessCategorySuggestions: suggestions, removedCategoryChips: removed },
          });
          progressLog.push({
            tool: "set_business_categories",
            requested: suggestions,
            result: { added, removed },
            url: page.url(),
          });
          return ok({ set: added.length > 0, added, removed, suggestions, url: page.url() });
        }
      ),
      tool(
        "click",
        "Click a visible button, link, role button, or clickable text by exact text pattern. Use for Create one, Sign up, Get started, Continue, Next, Submit, Claim, or Add business. Do not click social login/SSO/payment buttons.",
        {
          textPattern: z.string().describe("Case-insensitive text pattern to click."),
          avoidPattern: z.string().optional().describe("Optional case-insensitive pattern to avoid."),
        },
        async (args) => {
          const providerLoginPattern = /(microsoft account|work account|continue with google|continue with facebook|sign in with google|sign in with microsoft|office 365|single sign.?on|\bsso\b)/i;
          if (!continuation?.savedLoginPassword && providerLoginPattern.test(args.textPattern)) {
            const snapshot = await observePage(page);
            await onProgress?.({
              stage: "agent_login_provider_skipped",
              label: "Login provider skipped",
              status: "active",
              detail:
                "The agent skipped a provider login button because no approved saved credential exists. It will use a public create-account path if available.",
              extra: { portalUrl: snapshot.url, availableControls: snapshot.buttons.map((button) => button.text || button.label) },
            });
            progressLog.push({
              tool: "click",
              input: args,
              result: { clicked: false, reason: "provider_login_requires_saved_credentials" },
              url: snapshot.url,
            });
            return ok({
              clicked: false,
              reason: "provider_login_requires_saved_credentials",
              guidance: "Use a visible Create one, sign up, claim, or add business control instead. If none exists, finish with needs_user for approved account access.",
              availableControls: snapshot.buttons.map((button) => button.text || button.label).filter(Boolean).slice(0, 30),
              url: snapshot.url,
            });
          }

          const candidateSelector =
            'button, a, input[type=submit], input[type=button], [role="button"], [onclick], [tabindex]:not([tabindex="-1"])';
          const handles = await page.$$(candidateSelector);
          const availableControls: string[] = [];
          let matchedControl: { handle: any; text: string; href: string } | null = null;

          for (const handle of handles) {
            const info = await handle.evaluate(
              (el: Element, { textPattern, avoidPattern }: { textPattern: string; avoidPattern?: string }) => {
                const safeRegex = (value: string | undefined) => {
                  if (!value) return null;
                  try {
                    return new RegExp(value, "i");
                  } catch {
                    return null;
                  }
                };
                const wanted = safeRegex(textPattern);
                const avoid = safeRegex(avoidPattern);
              const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const literalWanted = new RegExp(escapeRegExp(textPattern), "i");
              const normalize = (value: string) =>
                value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, " ")
                  .trim();
              const normalizedWanted = normalize(textPattern);
              const matchesWanted = (value: string) => {
                const normalizedValue = normalize(value);
                return (
                  Boolean(wanted?.test(value)) ||
                  literalWanted.test(value) ||
                  (normalizedWanted.length > 2 && normalizedValue.includes(normalizedWanted))
                );
              };
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              if (!visible(el)) return { visible: false, matched: false, text: "", href: "" };
              const text = (
                (el as HTMLElement).innerText ||
                el.textContent ||
                el.getAttribute("value") ||
                el.getAttribute("aria-label") ||
                el.getAttribute("title") ||
                el.getAttribute("name") ||
                el.getAttribute("id") ||
                (el as HTMLAnchorElement).href ||
                ""
              )
                .replace(/\s+/g, " ")
                .trim();
              const href = (el as HTMLAnchorElement).href || "";
              return {
                visible: true,
                matched: Boolean(text && matchesWanted(text) && !avoid?.test(text)),
                text,
                href,
              };
              },
              args
            );

            if (!info.visible) continue;
            if (info.text) availableControls.push(info.text.slice(0, 120));
            if (!matchedControl && info.matched) {
              matchedControl = { handle, text: info.text, href: info.href };
            }
          }

          let result: {
            clicked: boolean;
            text: string;
            href: string;
            availableControls: string[];
            newPageOpened?: boolean;
            clickFallbackUsed?: boolean;
          };

          if (matchedControl) {
            const pageBeforeClick = page;
            const pagesBeforeClick = new Set(await browser.pages());
            let popupTimer: ReturnType<typeof setTimeout> | null = null;
            const popupPromise = new Promise<any | null>((resolve) => {
              popupTimer = setTimeout(() => resolve(null), 3500);
              page.once("popup", (popupPage: any) => {
                if (popupTimer) clearTimeout(popupTimer);
                resolve(popupPage);
              });
            });
            const navigationPromise = page
              .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 })
              .catch(() => null);
            let clickFallbackUsed = false;

            try {
              await matchedControl.handle.click({ delay: 60 });
            } catch {
              clickFallbackUsed = true;
              await matchedControl.handle.evaluate((el: HTMLElement) => el.click());
            }

            await Promise.race([navigationPromise, delay(15000)]);
            const popupPage = await popupPromise;
            const pagesAfterClick = await browser.pages().catch(() => []);
            const newPage =
              popupPage ||
              pagesAfterClick.find((candidate: any) => !pagesBeforeClick.has(candidate) && !candidate.isClosed?.());

            if (newPage && !newPage.isClosed?.()) {
              page = newPage;
              page.setDefaultTimeout(AGENT_BROWSER_TIMEOUT_MS);
              await page.bringToFront?.().catch(() => undefined);
              publishActiveAgentSession(sessionKey, { browser, page, generatedPassword, directoryName });
            }

            await settle(page, 15000);
            result = {
              clicked: true,
              text: matchedControl.text,
              href: matchedControl.href,
              availableControls,
              newPageOpened: Boolean(newPage && page !== pageBeforeClick),
              clickFallbackUsed,
            };
          } else {
            result = { clicked: false, text: "", href: "", availableControls: availableControls.slice(0, 20) };
          }

          for (const handle of handles) {
            await handle.dispose?.().catch(() => undefined);
          }

          const url = page.url();
          await onProgress?.({
            stage: "agent_clicked",
            label: "Clicked page control",
            status: "active",
            detail: result.clicked
              ? result.text
              : `No matching control for "${args.textPattern}"; agent will inspect the available controls and try another path.`,
            extra: { portalUrl: url, availableControls: result.availableControls },
          });
          progressLog.push({ tool: "click", input: args, result, url });
          return ok({ ...result, url });
        }
      ),
      tool(
        "fill_field",
        "Fill one visible input/textarea by label/name/placeholder pattern using exactly one approved business profile value. Use this when generic filling misses a field. Never fill CAPTCHA, payment-card, or one-time-code fields.",
        {
          fieldPattern: z.string().describe("Case-insensitive label/name/placeholder pattern for the target field."),
          valueKey: z.enum([
            "firstName",
            "lastName",
            "fullName",
            "businessName",
            "email",
            "password",
            "phone",
            "website",
            "address",
            "city",
            "state",
            "zip",
            "country",
            "birthMonth",
            "birthMonthNumber",
            "birthDay",
            "birthYear",
            "contactTitle",
            "businessRole",
            "employeeCount",
            "businessType",
            "businessCategory",
            "businessCategories",
            "industry",
            "yearFounded",
            "description",
          ]),
        },
        async (args) => {
          const value = profileValues[args.valueKey] || "";
          const result = await page.evaluate(
            ({ fieldPattern, value }: { fieldPattern: string; value: string }) => {
              const pattern = new RegExp(fieldPattern, "i");
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              const labelFor = (el: HTMLInputElement | HTMLTextAreaElement) => {
                const id = el.getAttribute("id");
                const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
                const implicit = el.closest("label")?.textContent || "";
                return [
                  explicit,
                  implicit,
                  el.getAttribute("aria-label") || "",
                  el.getAttribute("placeholder") || "",
                  el.getAttribute("name") || "",
                  id || "",
                  el.getAttribute("autocomplete") || "",
                ]
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              };
              const setValue = (el: HTMLInputElement | HTMLTextAreaElement, next: string) => {
                const prototype = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                if (setter) setter.call(el, next);
                else el.value = next;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
              };
              const controls = Array.from(document.querySelectorAll("input, textarea")) as Array<HTMLInputElement | HTMLTextAreaElement>;
              for (const control of controls) {
                if (!visible(control) || control.disabled || control.readOnly) continue;
                const type = (control.getAttribute("type") || "text").toLowerCase();
                const label = labelFor(control);
                if (["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type)) continue;
                if (/captcha|verification code|otp|one.?time|card|cvv|cvc|payment/.test(label.toLowerCase())) continue;
                if (!pattern.test(label)) continue;
                setValue(control, value);
                return { filled: true, label, type };
              }
              return { filled: false, label: "", type: "" };
            },
            { fieldPattern: args.fieldPattern, value }
          );
          await settle(page, 3000);
          await onProgress?.({
            stage: "agent_filled_target_field",
            label: "Target field filled",
            status: result.filled ? "active" : "failed",
            detail: result.filled ? `${result.label}` : `No field matched ${args.fieldPattern}`,
            extra: { portalUrl: page.url(), valueKey: args.valueKey },
          });
          progressLog.push({ tool: "fill_field", input: args, result, url: page.url() });
          return ok({ ...result, url: page.url() });
        }
      ),
      tool(
        "fill_signup_defaults",
        "Fill ordinary account setup defaults such as country/region and adult birth date. Use on pages like Microsoft 'Add some details'. This is agent work, not a user-validation step.",
        {},
        async () => {
          const defaults = {
            country: profileValues.country || "United States",
            birthMonth: profileValues.birthMonth || "January",
            birthMonthNumber: profileValues.birthMonthNumber || "1",
            birthDay: profileValues.birthDay || "1",
            birthYear: profileValues.birthYear || "1990",
          };
          const result = await page.evaluate((values: typeof defaults) => {
            const visible = (el: Element) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
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
                el.getAttribute("autocomplete") || "",
                id || "",
              ]
                .join(" ")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
            };
            const setValue = (el: HTMLInputElement | HTMLTextAreaElement, next: string) => {
              const prototype = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
              if (setter) setter.call(el, next);
              else el.value = next;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
            };
            const selectOption = (select: HTMLSelectElement, optionPatterns: RegExp[]) => {
              const option = Array.from(select.options).find((item) =>
                optionPatterns.some((pattern) => pattern.test(`${item.textContent || ""} ${item.value || ""}`))
              );
              if (!option) return false;
              select.value = option.value;
              select.dispatchEvent(new Event("input", { bubbles: true }));
              select.dispatchEvent(new Event("change", { bubbles: true }));
              select.dispatchEvent(new Event("blur", { bubbles: true }));
              return true;
            };
            const filled: string[] = [];
            const unresolved: string[] = [];

            for (const select of Array.from(document.querySelectorAll("select")) as HTMLSelectElement[]) {
              if (!visible(select) || select.disabled) continue;
              const label = labelFor(select);
              if (/country|region/.test(label)) {
                if (selectOption(select, [/united states/i, /^us$/i, /^usa$/i])) filled.push("country/region");
                else unresolved.push("country/region");
              } else if (/month|birth/.test(label)) {
                if (selectOption(select, [new RegExp(`^${values.birthMonth}\\b`, "i"), new RegExp(`^0?${values.birthMonthNumber}\\b`, "i")])) {
                  filled.push("birth month");
                } else {
                  unresolved.push("birth month");
                }
              } else if (/\bday\b|birth/.test(label)) {
                if (selectOption(select, [new RegExp(`^0?${values.birthDay}\\b`, "i")])) filled.push("birth day");
                else unresolved.push("birth day");
              } else if (/year|birth/.test(label)) {
                if (selectOption(select, [new RegExp(`^${values.birthYear}\\b`, "i")])) filled.push("birth year");
                else unresolved.push("birth year");
              }
            }

            for (const input of Array.from(document.querySelectorAll("input, textarea")) as Array<HTMLInputElement | HTMLTextAreaElement>) {
              if (!visible(input) || input.disabled || input.readOnly || input.value) continue;
              const type = (input.getAttribute("type") || "text").toLowerCase();
              if (["hidden", "submit", "button", "checkbox", "radio", "file", "password"].includes(type)) continue;
              const label = labelFor(input);
              if (/captcha|verification code|otp|one.?time|card|cvv|cvc|payment/.test(label)) continue;
              if (/country|region/.test(label)) {
                setValue(input, values.country);
                filled.push("country/region");
              } else if (/month|birth month/.test(label)) {
                setValue(input, values.birthMonth);
                filled.push("birth month");
              } else if (/\bday\b|birth day/.test(label)) {
                setValue(input, values.birthDay);
                filled.push("birth day");
              } else if (/year|birth year/.test(label)) {
                setValue(input, values.birthYear);
                filled.push("birth year");
              }
            }

            return { filled: Array.from(new Set(filled)), unresolved: Array.from(new Set(unresolved)) };
          }, defaults);
          await settle(page, 3000);
          await onProgress?.({
            stage: "agent_filled_signup_defaults",
            label: "Signup defaults filled",
            status: result.filled.length ? "active" : "failed",
            detail: result.filled.length
              ? result.filled.join(", ")
              : "No standard country or birthdate fields were found.",
            extra: { portalUrl: page.url(), unresolved: result.unresolved },
          });
          progressLog.push({ tool: "fill_signup_defaults", result, url: page.url() });
          return ok({ ...result, url: page.url() });
        }
      ),
      tool(
        "fill_verification_code",
        "Fill the visible one-time email/SMS verification code field with the user-provided code. Use only when approved_values includes verificationCode.",
        {},
        async () => {
          const code = profileValues.verificationCode || "";
          if (!code) {
            return ok({ filled: false, reason: "No verification code was supplied by the user." });
          }
          const result = await page.evaluate((codeValue: string) => {
            const visible = (el: Element) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
            };
            const labelFor = (el: HTMLInputElement | HTMLTextAreaElement) => {
              const id = el.getAttribute("id");
              const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
              const implicit = el.closest("label")?.textContent || "";
              return [
                explicit,
                implicit,
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
            const setValue = (el: HTMLInputElement | HTMLTextAreaElement, next: string) => {
              const prototype = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
              if (setter) setter.call(el, next);
              else el.value = next;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            };
            const inputs = Array.from(document.querySelectorAll("input, textarea")) as Array<HTMLInputElement | HTMLTextAreaElement>;
            const candidates = inputs.filter((input) => {
              if (!visible(input) || input.disabled || input.readOnly) return false;
              const type = (input.getAttribute("type") || "text").toLowerCase();
              if (["hidden", "submit", "button", "checkbox", "radio", "file", "password"].includes(type)) return false;
              const label = labelFor(input);
              return /(verification|verify|code|otp|one.?time|pin)/i.test(label);
            });
            if (candidates.length === 1) {
              setValue(candidates[0], codeValue);
              return { filled: true, mode: "single", label: labelFor(candidates[0]) };
            }
            const singleCharInputs = inputs.filter((input) => {
              if (!visible(input) || input.disabled || input.readOnly) return false;
              const maxLength = Number(input.getAttribute("maxlength") || "0");
              const inputMode = input.getAttribute("inputmode") || "";
              return maxLength <= 1 && /(numeric|decimal)/i.test(inputMode);
            });
            if (singleCharInputs.length >= codeValue.length && codeValue.length >= 4) {
              codeValue.split("").forEach((char, index) => {
                setValue(singleCharInputs[index], char);
              });
              return { filled: true, mode: "split", count: codeValue.length };
            }
            const visibleTextInputs = inputs.filter((input) => {
              if (!visible(input) || input.disabled || input.readOnly) return false;
              const type = (input.getAttribute("type") || "text").toLowerCase();
              return ["", "text", "tel", "number"].includes(type);
            });
            if (
              visibleTextInputs.length >= codeValue.length &&
              visibleTextInputs.length <= 8 &&
              codeValue.length >= 4
            ) {
              codeValue.split("").forEach((char, index) => {
                setValue(visibleTextInputs[index], char);
              });
              return { filled: true, mode: "split_visible_inputs", count: codeValue.length };
            }
            return { filled: false, mode: "not_found", visibleInputs: inputs.filter((input) => visible(input)).length };
          }, code);
          await settle(page, 3000);
          const submit = result.filled
            ? await page.evaluate(() => {
                const visible = (el: Element) => {
                  const style = window.getComputedStyle(el);
                  const rect = el.getBoundingClientRect();
                  return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
                };
                const wanted = /(verify|continue|submit|next|confirm|validate)/i;
                const avoid = /(resend|send new|new code|back|cancel|change email|log out|sign out)/i;
                const controls = Array.from(
                  document.querySelectorAll("button, a, input[type=submit], input[type=button]")
                ) as Array<HTMLButtonElement | HTMLAnchorElement | HTMLInputElement>;
                for (const control of controls) {
                  if (!visible(control)) continue;
                  if ("disabled" in control && control.disabled) continue;
                  const text = (
                    control.innerText ||
                    control.getAttribute("value") ||
                    control.getAttribute("aria-label") ||
                    (control as HTMLAnchorElement).href ||
                    ""
                  )
                    .replace(/\s+/g, " ")
                    .trim();
                  if (!text || !wanted.test(text) || avoid.test(text)) continue;
                  control.click();
                  return { clicked: true, text };
                }
                return { clicked: false, text: "" };
              })
            : { clicked: false, text: "" };
          if (submit.clicked) await settle(page, 15000);
          await onProgress?.({
            stage: "agent_filled_verification_code",
            label: submit.clicked ? "Verification code submitted" : "Verification code entered",
            status: result.filled ? "active" : "failed",
            detail: result.filled
              ? submit.clicked
                ? `The agent entered the user-provided verification code and clicked ${submit.text}.`
                : "The agent entered the user-provided verification code."
              : "No verification-code field was found.",
            extra: { portalUrl: page.url(), agentEngine: "claude_agent_sdk" },
          });
          progressLog.push({ tool: "fill_verification_code", result: { ...result, submit }, url: page.url() });
          return ok({ ...result, submit, url: page.url() });
        }
      ),
      tool(
        "fill_allowed_fields",
        "Fill visible form fields using the approved business profile. You may request keys from the provided approved_values list. Never fill CAPTCHA, payment card, or one-time verification-code fields.",
        {
          fieldKeys: z
            .array(
              z.enum([
                "firstName",
                "lastName",
                "fullName",
                "businessName",
                "email",
                "password",
                "phone",
                "website",
                "address",
                "city",
                "state",
                "zip",
                "country",
                "birthMonth",
                "birthMonthNumber",
                "birthDay",
                "birthYear",
                "contactTitle",
                "businessRole",
                "employeeCount",
                "businessType",
                "businessCategory",
                "businessCategories",
                "industry",
                "yearFounded",
                "description",
              ])
            )
            .describe("Approved profile values to try filling."),
        },
        async (args) => {
          const picked: Record<string, string> = {};
          for (const key of args.fieldKeys) picked[key] = profileValues[key] || "";
          const result = await page.evaluate(
            ({ picked }: { picked: Record<string, string> }) => {
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
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
                  el.getAttribute("autocomplete") || "",
                  id || "",
                ]
                  .join(" ")
                  .toLowerCase();
              };
              const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
                const prototype = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                if (setter) setter.call(el, value);
                else el.value = value;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
              };
              const matchingValue = (label: string, type: string) => {
                if (type === "email" || /\b(e-?mail|email address|business email|work email)\b/.test(label)) return picked.email;
                if (type === "password" || /password/.test(label)) return picked.password;
                if (/first name|given name/.test(label)) return picked.firstName;
                if (/last name|surname|family name/.test(label)) return picked.lastName;
                if (/full name|your name|contact name|owner name|president|ceo/.test(label)) return picked.fullName;
                if (/business name|company name|organization|legal name|business legal/.test(label)) return picked.businessName;
                if (/phone|telephone|mobile/.test(label)) return picked.phone;
                if (/job title|title|position|role/.test(label)) return picked.contactTitle || picked.businessRole;
                if (/employee|company size|team size|staff/.test(label)) return picked.employeeCount;
                if (/business type|organization type|company type|legal structure/.test(label)) return picked.businessType;
                if (/street|address line 1|business address|mailing address/.test(label)) return picked.address;
                if (/\bcity\b/.test(label)) return picked.city;
                if (/\bstate\b|province|region/.test(label)) return picked.state;
                if (/zip|postal/.test(label)) return picked.zip;
                if (/birth|date of birth|\bdob\b/.test(label) && /month/.test(label)) return picked.birthMonth;
                if (/birth|date of birth|\bdob\b/.test(label) && /\bday\b/.test(label)) return picked.birthDay;
                if (/birth|date of birth|\bdob\b/.test(label) && /year/.test(label)) return picked.birthYear;
                if (/^month$|birth month/.test(label)) return picked.birthMonth;
                if (/^day$|birth day/.test(label)) return picked.birthDay;
                if (/^year$|birth year/.test(label)) return picked.birthYear;
                if (/website|url|domain/.test(label)) return picked.website;
                if (/industry|category|business type/.test(label)) return picked.businessCategory || picked.industry;
                if (/year founded|founded|established/.test(label)) return picked.yearFounded;
                if (/description|about|summary/.test(label)) return picked.description;
                return "";
              };
              const filled: string[] = [];
              const missingRequired: string[] = [];
              const inputs = Array.from(document.querySelectorAll("input, textarea")) as Array<HTMLInputElement | HTMLTextAreaElement>;
              for (const input of inputs) {
                if (!visible(input) || input.disabled || input.readOnly || input.value) continue;
                const type = (input.getAttribute("type") || "text").toLowerCase();
                const label = labelFor(input);
                if (["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type)) continue;
                if (/captcha|verification code|otp|one.?time|card|cvv|cvc|payment/.test(label)) continue;
                const value = matchingValue(label, type);
                if (value) {
                  setValue(input, value);
                  filled.push(label.replace(/\s+/g, " ").trim().slice(0, 80));
                } else if (input.required || input.getAttribute("aria-required") === "true") {
                  missingRequired.push(label.replace(/\s+/g, " ").trim().slice(0, 80) || type);
                }
              }
              return { filled, missingRequired };
            },
            { picked }
          );
          await settle(page, 3000);
          await onProgress?.({
            stage: "agent_filled_fields",
            label: "Fields filled",
            status: "active",
            detail: result.filled.length ? result.filled.join(", ") : "No fillable matching fields found.",
            extra: { portalUrl: page.url(), missingRequired: result.missingRequired },
          });
          progressLog.push({ tool: "fill_allowed_fields", requested: args.fieldKeys, result, url: page.url() });
          return ok({ ...result, url: page.url() });
        }
      ),
      tool(
        "select_option",
        "Select an option in a visible select/dropdown by field pattern and option pattern. Use for state, country, industry, business type, legal structure, or category when the option is visible in a standard select.",
        {
          fieldPattern: z.string(),
          optionPattern: z.string(),
        },
        async (args) => {
          const result = await page.evaluate(
            ({ fieldPattern, optionPattern }: { fieldPattern: string; optionPattern: string }) => {
              const field = new RegExp(fieldPattern, "i");
              const optionWanted = new RegExp(optionPattern, "i");
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              const labelFor = (el: HTMLSelectElement) => {
                const id = el.getAttribute("id");
                const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
                const implicit = el.closest("label")?.textContent || "";
                return [
                  explicit,
                  implicit,
                  el.getAttribute("aria-label") || "",
                  el.getAttribute("placeholder") || "",
                  el.getAttribute("name") || "",
                  id || "",
                ]
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              };
              for (const select of Array.from(document.querySelectorAll("select")) as HTMLSelectElement[]) {
                if (!visible(select) || select.disabled) continue;
                const label = labelFor(select);
                if (!field.test(label)) continue;
                const option = Array.from(select.options).find((item) => optionWanted.test(`${item.textContent || ""} ${item.value || ""}`));
                if (!option) return { selected: false, label, reason: "option_not_found" };
                select.value = option.value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                return { selected: true, label, option: option.textContent || option.value };
              }
              return { selected: false, label: "", reason: "select_not_found" };
            },
            args
          );
          await settle(page, 3000);
          await onProgress?.({
            stage: "agent_selected_option",
            label: "Option selected",
            status: result.selected ? "active" : "failed",
            detail: result.selected ? `${result.label}: ${result.option}` : `${args.fieldPattern} -> ${args.optionPattern}`,
            extra: { portalUrl: page.url() },
          });
          progressLog.push({ tool: "select_option", input: args, result, url: page.url() });
          return ok({ ...result, url: page.url() });
        }
      ),
      tool(
        "set_checkbox",
        "Set a visible checkbox/radio control by label pattern. Use only for ordinary terms acceptance, business-type choices, or directory options. Never use it for CAPTCHA or payment consent.",
        {
          labelPattern: z.string(),
          checked: z.boolean().default(true),
        },
        async (args) => {
          const result = await page.evaluate(
            ({ labelPattern, checked }: { labelPattern: string; checked: boolean }) => {
              const pattern = new RegExp(labelPattern, "i");
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              const labelFor = (el: HTMLInputElement) => {
                const id = el.getAttribute("id");
                const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
                const implicit = el.closest("label")?.textContent || "";
                return [
                  explicit,
                  implicit,
                  el.getAttribute("aria-label") || "",
                  el.getAttribute("name") || "",
                  id || "",
                ]
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              };
              const controls = Array.from(document.querySelectorAll("input[type=checkbox], input[type=radio]")) as HTMLInputElement[];
              for (const control of controls) {
                if (!visible(control) || control.disabled) continue;
                const label = labelFor(control);
                if (/captcha|payment|credit card|cvv|cvc/i.test(label)) continue;
                if (!pattern.test(label)) continue;
                if (control.checked !== checked) control.click();
                return { changed: true, label, checked: control.checked };
              }
              return { changed: false, label: "", checked: false };
            },
            args
          );
          await settle(page, 3000);
          await onProgress?.({
            stage: "agent_set_checkbox",
            label: "Choice set",
            status: result.changed ? "active" : "failed",
            detail: result.changed ? result.label : `No checkbox/radio matched ${args.labelPattern}`,
            extra: { portalUrl: page.url() },
          });
          progressLog.push({ tool: "set_checkbox", input: args, result, url: page.url() });
          return ok({ ...result, url: page.url() });
        }
      ),
      tool(
        "finish",
        "Terminal tool. Use exactly once when the workflow is done, blocked, or needs the user's real validation. Do not claim accountCreated=true unless the page has accepted submission or explicitly asks for verification after submission.",
        {
          status: z.enum(["submitted", "needs_user", "blocked", "pending"]),
          stage: z.string(),
          message: z.string(),
          actionTitle: z.string(),
          actionButtonLabel: z.string(),
          accountCreated: z.boolean().optional(),
          shouldSaveGeneratedCredential: z.boolean().optional(),
        },
        async (args) => {
          const accountCreated = Boolean(args.accountCreated);
          const shouldSaveCredential = Boolean(accountCreated && args.shouldSaveGeneratedCredential);
          finalOutcome = normalizeNeedsUserOutcome({
            directoryName,
            profile,
            progressLog,
            outcome: {
              status: args.status,
              stage: args.stage,
              message: args.message,
              actionTitle: args.actionTitle,
              actionButtonLabel: args.actionButtonLabel,
              portalUrl: page.url(),
              accountCreated,
              credentialSaved: shouldSaveCredential,
              emailSentByFlowSmartly: false,
              generatedPassword,
              passwordHint: "Generated by FlowSmartly ListSmartly Agent.",
              diagnostics: {
                agentEngine: "claude_agent_sdk",
                toolCalls,
                progressLog,
                directorySlug,
                workflowId,
                browserSessionResumed: reusedHeldSession,
              },
            },
          });
          await onProgress?.({
            stage: finalOutcome.stage,
            label: finalOutcome.status === "needs_user" ? "User action needed" : "Agent finished",
            status: finalOutcome.status === "needs_user" ? "waiting" : finalOutcome.status === "blocked" ? "failed" : "done",
            detail: finalOutcome.message,
            extra: { portalUrl: page.url(), agentEngine: "claude_agent_sdk" },
          });
          return ok({ saved: true, outcome: finalOutcome });
        }
      ),
    ];

    const server = createSdkMcpServer({
      name: "listsmartly_browser_agent",
      version: "1.0.0",
      tools,
      alwaysLoad: true,
    });
    const allowedTools = tools.map((item) => `mcp__listsmartly_browser_agent__${item.name}`);
    const systemPrompt = buildSystemPrompt(directoryName);
    const approvedProfileValueKeys = [
      "firstName",
      "lastName",
      "fullName",
      "businessName",
      "email",
      "password",
      "phone",
      "website",
      "address",
      "city",
      "state",
      "zip",
      "country",
      "birthMonth",
      "birthMonthNumber",
      "birthDay",
      "birthYear",
      "contactTitle",
      "businessRole",
      "employeeCount",
      "businessType",
      "businessCategory",
      "businessCategories",
      "industry",
      "yearFounded",
      "description",
      "verificationCode",
    ];
    const userPrompt = buildUserPrompt({
      directoryName,
      directorySlug,
      startUrl,
      profile,
      approvedValues: approvedProfileValueKeys.filter((key) => Boolean(profileValues[key as keyof typeof profileValues])),
      continuation,
    });

    const abortController = new AbortController();
    const runTimeout = setTimeout(() => abortController.abort(), AGENT_RUN_TIMEOUT_MS);
    try {
      for await (const message of query({
        prompt: userPrompt,
        options: {
          systemPrompt,
          mcpServers: { listsmartly_browser_agent: server },
          allowedTools,
          model: process.env.LISTSMARTLY_AGENT_MODEL || "claude-haiku-4-5-20251001",
          canUseTool: async (toolName) => {
            toolCalls.push(toolName);
            return { behavior: "allow" as const, updatedInput: {} };
          },
          abortController,
          maxTurns: 32,
          maxBudgetUsd: 0.7,
          pathToClaudeCodeExecutable: getClaudeCodeBinaryPath(),
          stderr: (msg: string) => console.error(`[listsmartly-agent/claude] ${msg.trimEnd()}`),
        },
      })) {
        if (message.type === "assistant") {
          const blocks = (message.message?.content ?? []) as Array<{ type?: string; name?: string }>;
          for (const block of blocks) {
            if (block.type === "tool_use" && typeof block.name === "string") toolCalls.push(block.name);
          }
        }
      }
    } finally {
      clearTimeout(runTimeout);
    }

    if (finalOutcome) return finalOutcome;

    const snapshot = await observePage(page);
    const finalProgressLog = [
      ...progressLog,
      { tool: "observe_page", url: snapshot.url, title: snapshot.title, blockers: snapshot.blockers },
    ];
    const snapshotNeedsUser = Boolean(
      snapshot.blockers.emailVerification ||
        snapshot.blockers.phoneVerification ||
        snapshot.blockers.payment ||
        snapshot.blockers.businessEmailRejected ||
        snapshot.blockers.loginOrSso ||
        snapshot.blockers.captcha
    );
    finalOutcome = normalizeNeedsUserOutcome({
      directoryName,
      profile,
      progressLog: finalProgressLog,
      outcome: defaultOutcome({
        status: snapshotNeedsUser ? "needs_user" : "pending",
        stage: snapshotNeedsUser ? "waiting_for_user_validation" : "agent_review_pending",
        portalUrl: snapshot.url,
        message: snapshotNeedsUser
          ? `${directoryName} reached a validation step in the live browser.`
          : `${directoryName} agent session ended without a terminal decision. The workflow remains assigned to the agent for retry.`,
        actionTitle: snapshotNeedsUser ? `${directoryName} validation needed` : `${directoryName} agent retry queued`,
        actionButtonLabel: snapshotNeedsUser ? "I completed validation" : "Agent should retry",
        accountCreated: snapshot.blockers.emailVerification,
        generatedPassword,
        diagnostics: {
          agentEngine: "claude_agent_sdk",
          toolCalls,
          progressLog: finalProgressLog,
          finalTitle: snapshot.title,
          blockers: snapshot.blockers,
        },
      }),
    });
    return finalOutcome;
  } catch (error) {
    const currentUrl =
      page && typeof page.url === "function"
        ? page.url()
        : startUrl;
    finalOutcome = defaultOutcome({
      status: "pending",
      stage: "agent_sdk_retry_needed",
      portalUrl: currentUrl,
      message:
        `${directoryName} Claude agent could not finish this run: ` +
        (error instanceof Error ? error.message : String(error)) +
        ". The task remains assigned to the agent for retry; no user action is required yet.",
      actionTitle: `${directoryName} agent retry queued`,
      actionButtonLabel: "Agent should retry",
      diagnostics: {
        agentEngine: "claude_agent_sdk",
        error: error instanceof Error ? error.message : String(error),
        toolCalls,
        progressLog,
        currentUrl,
      },
    });
    return finalOutcome;
  } finally {
    if (sessionKey && shouldHoldAgentSession(finalOutcome) && browser && page && !page.isClosed?.()) {
      publishActiveAgentSession(sessionKey, {
        browser,
        page,
        generatedPassword,
        directoryName,
      });
      if (finalOutcome) {
        finalOutcome.diagnostics = {
          ...(finalOutcome.diagnostics || {}),
          browserSessionHeld: true,
          browserSessionExpiresAt: new Date(Date.now() + AGENT_SESSION_TTL_MS).toISOString(),
          browserSessionResumed: reusedHeldSession,
        };
      }
    } else {
      if (sessionKey) ACTIVE_AGENT_SESSIONS.delete(sessionKey);
      await browser?.close?.().catch(() => undefined);
    }
  }
}

function buildSystemPrompt(directoryName: string): string {
  return `You are the FlowSmartly ListSmartly AI Listing Agent.

Mission: use the browser tools to get a real local business listing outcome for ${directoryName}. Explore the visible public workflow, create or claim the listing when possible, fill ordinary forms from the approved data, and save an honest final state.

Tools:
- Observe the current page.
- Navigate public directory workflow URLs.
- Click public sign-up, claim, add-business, update, and continue controls.
- Fill general forms and targeted fields using only approved business profile values.
- On business category autocomplete pages, use set_business_categories before Continue; do not invent unrelated categories or use vague "Other" categories.
- Select dropdown options and set ordinary business/terms checkboxes.
- Fill account setup defaults such as country, birth date, owner role, company size, and business type when the portal asks for them.

Working style:
- Use observe_page before decisions, then keep moving through the public create, claim, add-business, or update path.
- If the page asks for ordinary account/listing data, fill it. Do not pass routine form work back to the user.
- If a required field is unfamiliar, infer from the raw business profile and defaults first, then observe again.
- If Bing Places or a Microsoft-gated page appears and no saved credential is available, use the visible create-account path before provider login buttons.
- If a verification code is supplied, submit that code yourself and continue the workflow after observing the result.
- Pause only for a real external validation blocker: email/SMS/phone verification without a supplied code, bot validation, payment, owner approval, or a required business fact that is absent from the raw data/defaults.
- Use public web workflows only; no directory APIs are available.
- Finish exactly once with submitted, needs_user, blocked, or pending.
- accountCreated=true only after the portal accepted a submit step or moved to verification after submission.
- shouldSaveGeneratedCredential=true only when accountCreated=true and the generated password was used for that account.`;
}

function buildUserPrompt(params: {
  directoryName: string;
  directorySlug?: string | null;
  startUrl: string;
  profile: ListSmartlyAgentProfile;
  approvedValues: string[];
  continuation?: ListSmartlyAgentContinuation;
}): string {
  const { directoryName, directorySlug, startUrl, profile, approvedValues, continuation } = params;
  return JSON.stringify(
    {
      task: `Run the public listing/account workflow for ${directoryName}.`,
      directory: { name: directoryName, slug: directorySlug, startUrl },
      businessProfile: {
        businessName: profile.businessName,
        contactName: profile.contactName,
        email: profile.email,
        phone: profile.phone,
        website: profile.website,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zip: profile.zip,
        country: profile.country || "United States",
        defaultAccountCountry: "United States",
        defaultAdultBirthDate: "January 1, 1990",
        industry: profile.industry,
        businessCategorySuggestions: inferBusinessCategorySuggestions(profile),
        yearFounded: profile.yearFounded,
        description: profile.description,
      },
      fieldDefaults: {
        contactTitle: "Owner",
        businessRole: "Owner",
        employeeCount: "1-10",
        businessType: "Local business",
        country: "United States",
        adultBirthDate: "January 1, 1990",
      },
      fieldHints: {
        name: ["first name", "last name", "full name", "owner name", "contact name"],
        business: ["business name", "company name", "organization", "legal name"],
        contact: ["business email", "work email", "phone", "website"],
        location: ["address", "city", "state", "zip", "country"],
        defaults: ["title", "role", "business type", "employee count", "birth date"],
      },
      approvedFieldKeys: approvedValues,
      continuation: {
        verificationCodeSupplied: Boolean(continuation?.verificationCode),
        savedCredentialAvailable: Boolean(continuation?.savedLoginPassword),
      },
      goal:
        "Get the local listing created, claimed, verified, corrected, or honestly paused at the next real external validation step.",
      expectedFlow:
        "Observe page, explore the visible public workflow, fill raw business/default values, continue through ordinary account setup, then finish with submitted/needs_user/blocked/pending.",
      userActionPolicy:
        "Ask the user only for external validation or missing business facts. Do not ask the user to complete normal forms, choose common defaults, create passwords, or click next buttons.",
    },
    null,
    2
  );
}
