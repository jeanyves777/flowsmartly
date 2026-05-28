"use client";

import { useEffect, useRef } from "react";

/**
 * Client-side Web Push subscription helper.
 *
 * On mount:
 *   1. Skips if Push API / Service Worker / Notification unsupported.
 *   2. Registers /flow-ai-sw.js (scope "/") if not already registered.
 *   3. Fetches the VAPID public key from /api/flow-ai/push/subscribe (GET).
 *   4. If the browser already has an active subscription, POSTs it
 *      again to keep our DB row fresh (idempotent upsert).
 *   5. If not, AND the user has previously granted notification
 *      permission ("granted"), subscribes silently.
 *
 * Does NOT prompt for permission proactively — that's user-hostile.
 * The widget exposes a "Turn on notifications" button (Phase 5) which
 * calls `requestPushPermission()` exported from here.
 *
 * Also listens for `flow-ai-deep-link` postMessage from the service
 * worker (push tap → focus existing tab) and dispatches a window event
 * that route-aware code can hook into.
 */

const SW_PATH = "/flow-ai-sw.js";
const VAPID_FETCH_PATH = "/api/flow-ai/push/subscribe";

export function useWebPushAutoSubscribe(enabled: boolean = true) {
  const triedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (triedRef.current) return;
    triedRef.current = true;

    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    // Set up the deep-link listener once.
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; deepLink?: string } | undefined;
      if (data?.type === "flow-ai-deep-link" && typeof data.deepLink === "string") {
        // Use a custom event so route-aware code (e.g. the dashboard
        // layout) can call router.push(...) without circular imports.
        window.dispatchEvent(
          new CustomEvent("flow-ai-deep-link", { detail: { deepLink: data.deepLink } }),
        );
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
        // If permission isn't granted, don't pop a prompt — user can
        // opt in from the widget settings.
        if (Notification.permission !== "granted") return;

        const vapidRes = await fetch(VAPID_FETCH_PATH);
        if (!vapidRes.ok) return;
        const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
        if (!publicKey) return;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Refresh the server row in case the user changed accounts.
          await postSubscription(existing);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await postSubscription(sub);
      } catch (err) {
        console.error("[useWebPushAutoSubscribe] failed:", err);
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled]);
}

/**
 * Prompt the user for notification permission and subscribe if granted.
 * Returns the new permission state. Call from a click handler — the
 * browser blocks `Notification.requestPermission()` outside user gestures.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined") return "default";
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  const result = await Notification.requestPermission();
  if (result === "granted") {
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
      const vapidRes = await fetch(VAPID_FETCH_PATH);
      if (!vapidRes.ok) return result;
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) return result;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await postSubscription(sub);
    } catch (err) {
      console.error("[requestPushPermission] subscribe failed:", err);
    }
  }
  return result;
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  // PushSubscription serializes via JSON to { endpoint, keys: {...} }.
  const payload = sub.toJSON();
  await fetch(VAPID_FETCH_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: payload.keys,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    }),
  });
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Return a fresh ArrayBuffer (not Uint8Array) so TS doesn't widen to
  // SharedArrayBuffer when handing it to PushManager.subscribe().
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
