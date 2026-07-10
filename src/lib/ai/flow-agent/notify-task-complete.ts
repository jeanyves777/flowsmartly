import { prisma } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/core";
import { sendWebPushToUser } from "@/lib/notifications/web-push";
import { sanitizeUserError, type UserErrorContext } from "@/lib/ai/user-error";

/** Map a task kind to the error context so a failure line reads naturally. */
function kindToErrorContext(kind: string): UserErrorContext {
  if (/image|design|flyer|logo|proposal_visual/i.test(kind)) return "image";
  if (/video|film|story_ad|avatar|reel|narration/i.test(kind)) return "video";
  if (/campaign/i.test(kind)) return "campaign";
  if (/publish|post/i.test(kind)) return "publish";
  return "generic";
}

/**
 * notifyAgentTaskComplete — called by every background AgentTask when it
 * finishes (success or failure). Fires:
 *   1. An in-app Notification row so the bell icon flips
 *   2. An email (best-effort, swallowed on failure — never blocks the chat)
 *
 * `deepLink` is the path the user lands on when they click the
 * notification — usually back to the chat at the exact taskId
 * (`/flow-ai?conversationId=X&taskId=Y`) so they see the completed
 * result inline. Phase 3 will add a Web Push / FCM hook here.
 */
/**
 * Only LONG-RUNNING jobs (minutes — the user has likely left the tab) warrant
 * an EMAIL. Quick generations (a flyer/design, an image, a canvas edit, a
 * proposal, narration) get the in-app bell + web push only, so we don't spam
 * the inbox for a few-second task.
 */
const EMAIL_WORTHY_KINDS = new Set<string>([
  "generate_video",
  "start_story_ad_campaign",
  "build_store",
  "build_website",
  "create_content_campaign",
  "import_contacts_csv",
]);

export interface NotifyAgentTaskCompleteInput {
  userId: string;
  taskId: string;
  kind: string;
  ok: boolean;
  /** Short one-liner shown in the notification ("Your video is ready"). */
  summary: string;
  /** Optional detail line — only used in email body, kept out of bell text. */
  detail?: string;
  /** Path the bell/email click should land on. */
  deepLink: string;
  /** Optional preview media URL for the email (e.g. the generated image). */
  previewImageUrl?: string;
}

export async function notifyAgentTaskComplete(
  rawInput: NotifyAgentTaskCompleteInput,
): Promise<void> {
  // NEVER surface a raw backend/provider error to the user. On failure, run the
  // user-facing strings through the sanitizer so the bell / push / email show a
  // friendly line — the real error is already logged at the source.
  const input: NotifyAgentTaskCompleteInput = rawInput.ok
    ? rawInput
    : {
        ...rawInput,
        summary: sanitizeUserError(rawInput.summary, kindToErrorContext(rawInput.kind)),
        detail: rawInput.detail ? sanitizeUserError(rawInput.detail, kindToErrorContext(rawInput.kind)) : rawInput.detail,
      };
  // ── 1. in-app notification ────────────────────────────────────────
  try {
    await createNotification({
      userId: input.userId,
      type: "AI_GENERATION_COMPLETE",
      title: input.ok ? "Flow-AI finished a task" : "Flow-AI ran into a problem",
      message: input.summary,
      data: { taskId: input.taskId, kind: input.kind, ok: input.ok },
      actionUrl: input.deepLink,
    });
  } catch (e) {
    console.error("[flow-agent] in-app notification failed:", e);
  }

  // ── 1b. Web Push (browser + mobile, app closed / backgrounded) ────
  // This is the channel that actually reaches the user when they've
  // closed the tab. In-app + email are still fired alongside as
  // belt-and-braces — most users see the push first, but if they have
  // notifications muted on the device, the email + bell catch them.
  try {
    await sendWebPushToUser(input.userId, {
      title: input.ok ? input.summary : `Flow-AI couldn't finish: ${input.summary}`,
      body: input.detail ?? (input.ok ? "Tap to view in Flow-AI." : "Tap to see what went wrong."),
      deepLink: input.deepLink,
      image: input.previewImageUrl,
      // Tag by task kind so spam-y "video ready" pushes collapse to one
      // on the device if multiple fire close together.
      tag: `flow-ai-${input.kind}`,
    });
  } catch (e) {
    console.error("[flow-agent] web push failed:", e);
  }

  // ── 2. email — only for LONG-RUNNING jobs (see EMAIL_WORTHY_KINDS). Quick
  // generations already surfaced via the in-app bell + web push above. ──
  if (!EMAIL_WORTHY_KINDS.has(input.kind)) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });
    if (!user?.email) return;

    const subject = input.ok
      ? `${input.summary} — Flow-AI`
      : `Flow-AI couldn't finish — ${input.summary}`;

    const previewHtml = input.previewImageUrl
      ? `<p style="margin:18px 0"><img src="${escapeHtml(input.previewImageUrl)}" alt="Preview" style="max-width:480px;width:100%;border-radius:8px;border:1px solid #e5e7eb"/></p>`
      : "";

    const html = `
      <p>Hi ${escapeHtml(user.name ?? "there")},</p>
      <p>${escapeHtml(input.summary)}</p>
      ${input.detail ? `<p style="color:#475569">${escapeHtml(input.detail)}</p>` : ""}
      ${previewHtml}
      <p style="margin:24px 0">
        <a href="${escapeHtml(absoluteUrl(input.deepLink))}"
           style="display:inline-block;padding:10px 18px;border-radius:8px;background:linear-gradient(90deg,#3b82f6,#06b6d4);color:#ffffff;text-decoration:none;font-weight:600">
          Open Flow-AI
        </a>
      </p>
      <p style="color:#64748b;font-size:12px">You can disable these emails in <a href="${escapeHtml(absoluteUrl("/settings"))}">notification settings</a>.</p>
    `;

    await sendEmail({
      to: user.email,
      subject,
      html,
    });
  } catch (e) {
    console.error("[flow-agent] email notification failed:", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://flowsmartly.com";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
