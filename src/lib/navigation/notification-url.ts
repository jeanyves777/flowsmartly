export function normalizeNotificationActionUrl(actionUrl?: string | null) {
  const raw = actionUrl?.trim();
  if (!raw) return "/notifications";

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (host === "flowsmartly.com" || host === "www.flowsmartly.com" || host === "localhost") {
        return normalizeNotificationActionUrl(`${url.pathname}${url.search}${url.hash}`);
      }
      return raw;
    } catch {
      return raw;
    }
  }

  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  const postMatch = normalized.match(/^\/posts?\/([^/?#]+)/i);
  if (postMatch?.[1]) {
    return `/feed?post=${encodeURIComponent(postMatch[1])}`;
  }

  if (normalized === "/ai-studio") return "/studio";
  return normalized;
}

export function isExternalNotificationActionUrl(actionUrl: string) {
  return /^https?:\/\//i.test(actionUrl) || actionUrl.startsWith("//");
}
