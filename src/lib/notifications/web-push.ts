import webpush from "web-push";
import { prisma } from "@/lib/db/client";

/**
 * Web Push helpers — server-side fan-out to every PushSubscription a user
 * has registered. Wraps the `web-push` library with FlowSmartly's
 * convention: never throws, never blocks the caller, prunes dead
 * subscriptions automatically.
 *
 * VAPID setup:
 *   - Public + private keys live in env vars (see VAPID_PUBLIC_KEY +
 *     VAPID_PRIVATE_KEY). Generate locally with:
 *       npx web-push generate-vapid-keys
 *   - VAPID_SUBJECT must be a mailto: or https: URL.
 *   - If keys aren't configured, every send no-ops with a warn — the
 *     in-app notification + email still fire from notifyAgentTaskComplete,
 *     so missing push config doesn't break the agent.
 *
 * Subscription lifecycle:
 *   - 410 Gone / 404 / 403 from the push service → subscription is dead,
 *     we delete it.
 *   - Other errors increment failureCount; after 3 we prune on next 410.
 *
 * Payload shape (parsed by the service worker in /sw.js):
 *   { title, body, deepLink, badge?, image?, tag? }
 */

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@flowsmartly.com";

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return false;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidConfigured = true;
    return true;
  } catch (e) {
    console.error("[web-push] Failed to configure VAPID:", e);
    return false;
  }
}

/** Public key consumers (browser) need to subscribe. Empty string if unset. */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export function isWebPushConfigured(): boolean {
  return !!VAPID_PUBLIC && !!VAPID_PRIVATE;
}

export interface PushPayload {
  /** Notification title — short, top line. */
  title: string;
  /** Notification body — one or two lines max. */
  body: string;
  /** Path the user lands on when they tap. */
  deepLink: string;
  /** Optional thumbnail (e.g. generated image) shown in the rich notification. */
  image?: string;
  /** Small icon — default app logo. */
  badge?: string;
  /**
   * Optional tag — duplicate sends with the same tag collapse on the
   * device into one notification (good for "video is ready"-style spam).
   */
  tag?: string;
}

/**
 * Fire-and-forget push to every active subscription belonging to `userId`.
 * Returns a summary so the caller can log delivery rates if it wants.
 *
 * Never throws. Per-subscription errors are caught and used to prune
 * dead rows. A missing VAPID config logs a warning and returns
 * `{ delivered: 0, configured: false }` so the caller can keep going.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ configured: boolean; delivered: number; failed: number; pruned: number }> {
  if (!ensureVapid()) {
    console.warn("[web-push] VAPID not configured — skipping push for user", userId);
    return { configured: false, delivered: 0, failed: 0, pruned: 0 };
  }

  let subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string; failureCount: number }> = [];
  try {
    subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true, failureCount: true },
    });
  } catch (e) {
    console.error("[web-push] Failed to load subscriptions:", e);
    return { configured: true, delivered: 0, failed: 0, pruned: 0 };
  }
  if (subs.length === 0) {
    return { configured: true, delivered: 0, failed: 0, pruned: 0 };
  }

  const body = JSON.stringify(payload);
  let delivered = 0;
  let failed = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 24 }, // 1 day — old jobs aren't useful past that
        );
        delivered++;
        // Reset failure counter + update lastUsedAt
        await prisma.pushSubscription
          .update({
            where: { id: s.id },
            data: { failureCount: 0, lastUsedAt: new Date() },
          })
          .catch(() => {});
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        // Dead subscription — prune it.
        if (status === 404 || status === 410 || status === 403) {
          pruned++;
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          failed++;
          await prisma.pushSubscription
            .update({
              where: { id: s.id },
              data: { failureCount: s.failureCount + 1 },
            })
            .catch(() => {});
          console.error(`[web-push] send failed (status=${status}):`, err);
        }
      }
    }),
  );

  return { configured: true, delivered, failed, pruned };
}
