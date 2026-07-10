/**
 * sanitizeUserError — turn ANY backend/provider error into a short, friendly,
 * non-technical line safe to show a user. We must NEVER surface raw API errors
 * (provider names, HTTP status codes, stack traces, "fetch failed", JSON blobs,
 * internal file paths) to end users — they read as the product being broken.
 *
 * It is CONSERVATIVE: messages WE authored that are already a clean, short,
 * human sentence (e.g. "Not enough credits — top up to continue.",
 * "Reconnect X from Connections…") pass through unchanged. Only text that looks
 * technical/raw (or is very long) is replaced with a friendly fallback. Always
 * log the real error server-side; only the return value is user-facing.
 */

export type UserErrorContext = "image" | "video" | "publish" | "campaign" | "generic";

// Tokens that mark a string as a raw/technical error we must not show verbatim.
const RAW_SIGNALS =
  /(\b[45]\d\d\b|status\s*code|\bhttp\b|\bapi\b|x\.?ai|grok|openai|gpt-|dall|gemini|imagen|veo|sora|runway|anthropic|claude|heygen|elevenlabs|econnreset|etimedout|enotfound|esockettimedout|socket hang|traceback|stack trace|\bat\s+\w+\s*\(|cannot read propert|is not a function|undefined is not|unexpected token|invalid_argument|permission_denied|failed to fetch|fetch failed|networkerror|\{"|\bnull\b|\bundefined\b|\/[\w-]+\/[\w-]+\.(ts|js|tsx))/i;

function nounFor(ctx?: UserErrorContext): string {
  switch (ctx) {
    case "image": return "design";
    case "video": return "video";
    case "campaign": return "campaign";
    case "publish": return "post";
    default: return "request";
  }
}

function friendlyDefault(ctx?: UserErrorContext): string {
  switch (ctx) {
    case "image": return "The design couldn't be generated just now — please try again in a moment.";
    case "video": return "The video couldn't be generated just now — please try again in a moment.";
    case "campaign": return "The campaign couldn't be built just now — please try again in a moment.";
    case "publish": return "That post couldn't go out just now — please try again in a moment.";
    default: return "That didn't work just now — please try again in a moment.";
  }
}

export function sanitizeUserError(raw: unknown, ctx: UserErrorContext = "generic"): string {
  const text = (raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "").trim();
  if (!text) return friendlyDefault(ctx);

  // Category mapping — a friendly, actionable line per common failure class.
  if (/rate.?limit|\b429\b|\b503\b|\b502\b|quota|too many requests|overloaded|is busy|capacity|try again later/i.test(text)) {
    return "The generator is busy right now — please try again in a moment.";
  }
  if (/timeout|timed out|deadline|took too long|etimedout|esockettimedout/i.test(text)) {
    return `That ${nounFor(ctx)} took too long and timed out — please try again.`;
  }
  if (/content|safety|moderat|policy|blocked|nsfw|violat|not allowed|prohibited|flagged/i.test(text)) {
    return "That couldn't be generated — it may conflict with content rules. Try rephrasing the prompt.";
  }
  // Actionable messages WE authored — keep them (they're already friendly).
  if (/not enough credit|insufficient credit|top up|buy credits/i.test(text) && text.length < 200 && !RAW_SIGNALS.test(text)) {
    return text;
  }
  if (/reconnect/i.test(text) && text.length < 200) {
    return text.length <= 180 && !RAW_SIGNALS.test(text)
      ? text
      : "That account needs reconnecting — open Connections and reconnect it, then try again.";
  }

  // Anything that still looks raw/technical (or is very long) → generic line.
  if (RAW_SIGNALS.test(text) || text.length > 180) return friendlyDefault(ctx);

  // A short, clean human sentence we produced — safe to show as-is.
  return text;
}
