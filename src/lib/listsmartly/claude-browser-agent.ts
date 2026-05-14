import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { mkdirSync } from "fs";
import os from "os";
import path from "path";
import { getClaudeCodeBinaryPath } from "@/lib/ai/design-tools/sdk-binary-path";

const AGENT_BROWSER_TIMEOUT_MS = 60000;
const AGENT_SESSION_TTL_MS = 30 * 60 * 1000;
const AGENT_RUN_TIMEOUT_MS = Number(process.env.LISTSMARTLY_AGENT_RUN_TIMEOUT_MS || 120000);
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
    (outcome?.status === "needs_user" && outcome.stage?.startsWith("waiting_for_")) ||
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
  const image = await session.page.screenshot({
    type: "jpeg",
    quality: 72,
    encoding: "base64",
    captureBeyondViewport: false,
  });

  return {
    active: true,
    url: session.page.url?.() || "",
    title: await session.page.title?.().catch(() => "") || "",
    image,
    contentType: "image/jpeg",
    viewport: { width: viewport.width || 1365, height: viewport.height || 900 },
    expiresAt: new Date(session.expiresAt).toISOString(),
    directoryName: session.directoryName,
    cursor: session.remoteCursor
      ? { x: session.remoteCursor.x, y: session.remoteCursor.y, at: new Date(session.remoteCursor.at).toISOString() }
      : undefined,
    lastHumanActionAt: session.lastHumanActionAt ? new Date(session.lastHumanActionAt).toISOString() : undefined,
  };
}

export async function controlListSmartlyAgentBrowser(
  workflowId: string | null | undefined,
  control: ListSmartlyAgentBrowserControl
): Promise<ListSmartlyAgentBrowserView> {
  const session = getActiveAgentSession(workflowId);
  if (!session) return { active: false, reason: "The live browser session has expired. Run the agent again to reopen it." };

  const viewport = session.page.viewport?.() || { width: 1365, height: 900 };
  if (control.action === "click") {
    const x = Math.max(0, Math.min(viewport.width || 1365, Math.round(control.x)));
    const y = Math.max(0, Math.min(viewport.height || 900, Math.round(control.y)));
    await session.page.mouse.move(x, y);
    await session.page.mouse.click(x, y);
    session.remoteCursor = { x, y, at: Date.now() };
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
  await settle(session.page, 4000);
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

type BrowserSnapshot = {
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
  if (outcome.status !== "needs_user") return outcome;

  const blockers = latestObservedBlockers(progressLog);
  const personalEmail = isLikelyPersonalEmail(profile.email);
  const reasons: string[] = [];
  const userShouldNotDoAgentWork =
    /(fill (in|out)|complete the .*form|create .*password|password:|click continue|finish .*sign.?up|enter .*password)/i.test(
      outcome.message
    );

  const emailVerificationAccountCreated = Boolean(blockers?.emailVerification);
  const verificationCodeAttempted = Boolean(blockers?.emailVerification && verificationCodeWasSubmitted(progressLog));

  if (blockers?.captcha) reasons.push("complete the CAPTCHA or bot-protection challenge");
  if (blockers?.emailVerification) reasons.push("provide the email verification code");
  if (blockers?.phoneVerification) reasons.push("verify the phone or SMS challenge");
  if (blockers?.businessEmailRejected && personalEmail) {
    reasons.push(`add or approve a business email because ${profile.email} appears to be a personal email`);
  } else if (blockers?.businessEmailRejected) {
    reasons.push("confirm the business email requested by the directory");
  }
  if (blockers?.payment) reasons.push("confirm the payment or billing choice");
  if (blockers?.loginOrSso) reasons.push("provide approved directory login access");

  if (!reasons.length && !userShouldNotDoAgentWork) {
    return {
      ...outcome,
      credentialSaved: outcome.accountCreated && outcome.credentialSaved,
      generatedPassword: outcome.accountCreated && outcome.credentialSaved ? outcome.generatedPassword : undefined,
      passwordHint: outcome.accountCreated && outcome.credentialSaved ? outcome.passwordHint : undefined,
    };
  }

  const stage = blockers?.captcha
    ? "waiting_for_captcha"
    : blockers?.emailVerification
      ? "waiting_for_email_verification"
      : blockers?.phoneVerification
        ? "waiting_for_phone_verification"
        : blockers?.businessEmailRejected
          ? "waiting_for_business_email"
          : blockers?.payment
            ? "waiting_for_payment_confirmation"
            : blockers?.loginOrSso
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
      buttons: Array.from(
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
        .slice(0, 80),
      blockers: {
        captcha:
          visibleCaptchaElement ||
          /(complete the captcha|captcha required|recaptcha|hcaptcha|turnstile|cloudflare challenge)/i.test(pageContext),
        emailVerification: /(verify[-_\s]?email|verify your email|email verification|verification code|one.?time verification code|check your email|confirmation email|email has been sent|enter the code)/i.test(pageContext),
        phoneVerification: /(verify your phone|sms code|text message|phone verification|call you)/i.test(pageContext),
        payment: /(payment|credit card|checkout|billing information|expedite)/i.test(pageContext),
        loginOrSso: /(single sign.?on|\bsso\b|sign in with google|continue with google|sign in with microsoft|microsoft account|work account|office 365)/i.test(pageContext),
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

          const result = await page.evaluate(
            ({ textPattern, avoidPattern }: { textPattern: string; avoidPattern?: string }) => {
              const wanted = new RegExp(textPattern, "i");
              const avoid = avoidPattern ? new RegExp(avoidPattern, "i") : null;
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
                  wanted.test(value) ||
                  literalWanted.test(value) ||
                  (normalizedWanted.length > 2 && normalizedValue.includes(normalizedWanted))
                );
              };
              const visible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
              };
              const candidates = Array.from(
                document.querySelectorAll(
                  'button, a, input[type=submit], input[type=button], [role="button"], [onclick], [tabindex]:not([tabindex="-1"])'
                )
              ) as HTMLElement[];
              const availableControls: string[] = [];
              for (const el of candidates) {
                if (!visible(el)) continue;
                const text = (
                  el.innerText ||
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
                if (text) availableControls.push(text.slice(0, 120));
                if (!text || !matchesWanted(text) || avoid?.test(text)) continue;
                el.click();
                return { clicked: true, text, href: (el as HTMLAnchorElement).href || "", availableControls };
              }
              return { clicked: false, text: "", href: "", availableControls: availableControls.slice(0, 20) };
            },
            args
          );
          if (result.clicked) await settle(page, 15000);
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
                if (/street|address line 1|business address|mailing address/.test(label)) return picked.address;
                if (/\bcity\b/.test(label)) return picked.city;
                if (/\bstate\b|province|region/.test(label)) return picked.state;
                if (/zip|postal/.test(label)) return picked.zip;
                if (/website|url|domain/.test(label)) return picked.website;
                if (/industry|category|business type/.test(label)) return picked.industry;
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

You control a browser through tools. Your job is to create, claim, verify, or prepare a business listing workflow for ${directoryName}.

Capabilities:
- Observe the current page.
- Navigate public directory workflow URLs.
- Click public sign-up, claim, add-business, update, and continue controls.
- Fill general forms and targeted fields using only approved business profile values.
- Select dropdown options and set ordinary business/terms checkboxes.
- Pause with a clear user action when email, SMS, phone, CAPTCHA, payment, owner approval, or missing profile data is required.

Rules:
- Never bypass CAPTCHA, bot protection, paywalls, login protections, email/SMS/phone verification, payment choices, or owner approval.
- Never click social-login/SSO buttons unless the business profile explicitly contains approved credentials for that provider. It does not in this workflow.
- For Bing Places or Microsoft-gated directory pages, "Microsoft account" and "Work account" are login-provider buttons. Without approved saved credentials, click "Create one" or another public create-account path instead.
- Never ask the user to fill ordinary account/listing fields or create a password. That is agent work.
- If a password is needed, fill the password fields with the generated password from the approved values. Save it only after account creation is actually accepted.
- If the page says the account already exists and the workflow has approved saved credentials, try the normal email/password sign-in path before blocking.
- If a verification code is supplied in approved values, fill it with fill_verification_code and continue the workflow. Do not ask the user to enter that code on the external site.
- If CAPTCHA, email/SMS/phone verification, payment, owner approval, or missing profile data blocks you, ask only for that blocker. Tell the user the agent will continue after validation.
- Never invent account creation. accountCreated=true only after the page accepted a submit step or asks for verification after a submit.
- Never claim credentials were saved unless shouldSaveGeneratedCredential=true and accountCreated=true.
- Do not use APIs. This product uses public directory web workflows only.
- Use observe_page before every decision.
- End by calling finish exactly once.`;
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
        industry: profile.industry,
        yearFounded: profile.yearFounded,
        description: profile.description,
      },
      approvedFieldKeys: approvedValues,
      continuation: {
        verificationCodeSupplied: Boolean(continuation?.verificationCode),
        savedCredentialAvailable: Boolean(continuation?.savedLoginPassword),
      },
      expectedFlow:
        "Observe page, click the public signup/claim/add-business path, fill allowed fields, continue carefully, then finish with submitted/needs_user/blocked/pending.",
      humanActionPolicy:
        "If a verification code was supplied, use fill_verification_code once, observe the page after it submits, then continue. If the page is Bing Places or Microsoft-gated and no saved credential is available, click Create one before any Microsoft account or Work account login-provider button. If the directory says the email already has an account and savedCredentialAvailable is true, use the normal email/password sign-in path with the approved email and password values before blocking. If CAPTCHA, missing email/SMS/phone code, payment, owner approval, missing data, or login-only access appears, stop and output only that precise blocker. Do not ask the user to complete ordinary signup fields or create the password; the agent will continue those steps after validation.",
    },
    null,
    2
  );
}
