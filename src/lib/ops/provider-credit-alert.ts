/**
 * Guardrail + admin alerting for MEDIA-PROVIDER credit exhaustion (HeyGen, etc.).
 *
 * When a paid provider runs out of credits mid-render, the user must NEVER be left on
 * a silent "try again" that can never succeed — we detect it, refund the user (at the
 * caller), show a friendly "temporarily paused" line, and email active admins so they
 * can top the provider up. [[voice-oncam-explainer-feature]]
 */
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/core";

/** True when an error is a provider "out of credits / quota / plan exhausted" failure. */
export function isCreditExhaustion(err: unknown): boolean {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /out of credit|insufficient credit|not enough credit|no credit|upgrade plan|credit limit|insufficient_quota|payment required|\b402\b|billing|quota exceeded|exceeds? (your )?quota|plan limit/.test(s);
}

/** Friendly, non-technical line for a user whose render hit provider credit exhaustion. */
export function creditExhaustionUserMessage(what = "This"): string {
  return `${what} is temporarily paused — rendering is briefly unavailable and our team has been notified. Your credits were not charged.`;
}

// One alert per provider per window (in-process; prod runs a single pm2 instance).
const lastAlertAt: Record<string, number> = {};
const THROTTLE_MS = 30 * 60 * 1000;

/**
 * Email active admins that a media provider is out of credits. Best-effort, throttled,
 * never throws. Add OPS_ALERT_EMAIL (comma-separated) to also notify an ops inbox.
 */
export async function alertAdminsCreditExhaustion(provider: string, detail: string): Promise<void> {
  try {
    const now = Date.now();
    if (lastAlertAt[provider] && now - lastAlertAt[provider] < THROTTLE_MS) return;
    lastAlertAt[provider] = now;

    console.error(`[ops-alert] ${provider} OUT OF CREDITS — ${detail.slice(0, 300)}`);

    const admins = await prisma.adminUser
      .findMany({ where: { isActive: true }, select: { email: true } })
      .catch(() => [] as { email: string }[]);
    const extra = (process.env.OPS_ALERT_EMAIL || "").split(",").map((e) => e.trim()).filter(Boolean);
    const recipients = Array.from(new Set([...admins.map((a) => a.email), ...extra])).filter((e) => /@/.test(e));
    if (recipients.length === 0) return;

    const html = `
      <h2 style="color:#c0392b">⚠️ ${escapeHtml(provider)} is out of credits</h2>
      <p>A user render just failed because <b>${escapeHtml(provider)}</b> ran out of credits. The user was
         <b>refunded</b> and shown a friendly "temporarily paused" message.</p>
      <p><b>Action needed:</b> top up ${escapeHtml(provider)} credits (developer / pay-as-you-go) to resume renders.</p>
      <pre style="background:#f4f4f4;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px">${escapeHtml(detail.slice(0, 600))}</pre>`;

    await Promise.all(
      recipients.map((to) =>
        sendEmail({ to, subject: `⚠️ ${provider} out of credits — top up needed`, html }).catch(() => {})),
    );
  } catch (e) {
    console.error("[ops-alert] failed to notify admins:", e instanceof Error ? e.message : e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
