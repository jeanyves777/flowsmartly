/**
 * Flow-AI service worker — minimal push handler.
 *
 * Scope: registered at /flow-ai-sw.js with scope "/" so it catches
 * pushes on every page. Doesn't intercept fetches, doesn't cache
 * anything — pure push relay. (If we ever want offline support, that's
 * a separate worker / feature.)
 *
 * Payload contract (set by src/lib/notifications/web-push.ts):
 *   { title, body, deepLink, image?, badge?, tag? }
 *
 * Click handler:
 *   - If an existing FlowSmartly tab is open, focus it + post a message
 *     so the in-app router can deep-link without a full reload.
 *   - Otherwise open a new tab at the deep link.
 */

self.addEventListener("install", (event) => {
  // Activate immediately so the user doesn't need to reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data = { title: "Flow-AI", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Flow-AI";
  const body = data.body || "";
  const deepLink = data.deepLink || "/flow-ai";
  const tag = data.tag || "flow-ai";

  const options = {
    body,
    tag,
    renotify: true,
    icon: data.badge || "/icon-192.png",
    badge: data.badge || "/icon-96.png",
    image: data.image,
    data: { deepLink },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.deepLink) || "/flow-ai";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer focusing an existing tab and asking it to navigate.
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({
              type: "flow-ai-deep-link",
              deepLink: targetPath,
            });
            return client.focus();
          }
        }
        // No tab open — open a fresh one.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
        return undefined;
      }),
  );
});
