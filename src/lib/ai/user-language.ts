import { prisma } from "@/lib/db/client";

/**
 * User language preference — single source of truth for ALL AI surfaces.
 *
 * Every AI generator in the app (Flow-AI agent, post writer, caption
 * writer, email composer, story-ad screenplay, voice TTS, etc.) MUST
 * call `getUserPreferredLanguage(userId)` and include the result in its
 * prompt. See feedback-ai-respects-user-language memory.
 *
 * Storage: `BrandKit.preferredLanguage` (BCP-47 tag like "en", "fr",
 * "es", "pt-BR"). The setting lives in Brand Identity in the UI — one
 * place to change for the whole account.
 *
 * Fallback chain:
 *   1. brandKit.preferredLanguage
 *   2. "en" (sensible English default)
 *
 * NEVER throws — falls through to "en" on any DB failure so AI calls are
 * never blocked by a missing brand kit.
 */

/** Default language when nothing is configured. */
export const DEFAULT_LANGUAGE = "en";

/** Languages we surface in the BrandKit picker. Keep tags BCP-47-compatible. */
export const SUPPORTED_LANGUAGES: Array<{ tag: string; label: string; nativeLabel: string }> = [
  { tag: "en", label: "English", nativeLabel: "English" },
  { tag: "fr", label: "French", nativeLabel: "Français" },
  { tag: "es", label: "Spanish", nativeLabel: "Español" },
  { tag: "pt", label: "Portuguese", nativeLabel: "Português" },
  { tag: "pt-BR", label: "Portuguese (Brazil)", nativeLabel: "Português (Brasil)" },
  { tag: "de", label: "German", nativeLabel: "Deutsch" },
  { tag: "it", label: "Italian", nativeLabel: "Italiano" },
  { tag: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { tag: "pl", label: "Polish", nativeLabel: "Polski" },
  { tag: "ru", label: "Russian", nativeLabel: "Русский" },
  { tag: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { tag: "ar", label: "Arabic", nativeLabel: "العربية" },
  { tag: "he", label: "Hebrew", nativeLabel: "עברית" },
  { tag: "zh", label: "Chinese (Simplified)", nativeLabel: "中文（简体）" },
  { tag: "zh-TW", label: "Chinese (Traditional)", nativeLabel: "中文（繁體）" },
  { tag: "ja", label: "Japanese", nativeLabel: "日本語" },
  { tag: "ko", label: "Korean", nativeLabel: "한국어" },
  { tag: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { tag: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { tag: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { tag: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { tag: "th", label: "Thai", nativeLabel: "ไทย" },
];

export function isSupportedLanguage(tag: string | null | undefined): boolean {
  if (!tag) return false;
  return SUPPORTED_LANGUAGES.some((l) => l.tag === tag);
}

export function getLanguageLabel(tag: string | null | undefined): string {
  const entry = SUPPORTED_LANGUAGES.find((l) => l.tag === (tag ?? DEFAULT_LANGUAGE));
  return entry?.nativeLabel ?? "English";
}

/**
 * Fetch the user's preferred language. Always returns a valid BCP-47 tag
 * — never null, never throws.
 */
export async function getUserPreferredLanguage(userId: string): Promise<string> {
  try {
    const kit = await prisma.brandKit.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { preferredLanguage: true },
    });
    if (kit?.preferredLanguage && isSupportedLanguage(kit.preferredLanguage)) {
      return kit.preferredLanguage;
    }
    return DEFAULT_LANGUAGE;
  } catch (e) {
    console.error("[user-language] lookup failed, falling back to en:", e);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Build a one-line system-prompt directive that locks AI output to the
 * user's preferred language. Drop this into ANY AI prompt before sending.
 *
 * Example:
 *   `Respond entirely in Português (pt-BR). All copy, headings, captions,
 *    descriptions, and code comments must be in this language.`
 */
export function languageDirective(tag: string): string {
  const label = getLanguageLabel(tag);
  return `Respond entirely in ${label} (${tag}). All copy, captions, descriptions, headings, and user-facing text must be in this language — even if the user's message is in a different language. If the user explicitly asks for translation, you may include the other language alongside, but ${label} stays primary.`;
}

/**
 * One-shot helper for creative generators that don't have a system prompt
 * (single-prompt image / video calls). Prepends a short language clause to
 * an arbitrary user prompt so any rendered text or voiceover comes out in
 * the user's language.
 *
 * For image gen with no text in the image, this is still useful — image
 * models often interpret "Cinco de Mayo" differently when the prompt
 * itself is bilingual vs monolingual.
 *
 * Use for: image prompts, video prompts, TTS scripts where you can't pass
 * a separate system prompt. For chat-style LLM calls, prefer
 * `languageDirective` in the system message instead.
 */
export function withLanguagePrefix(prompt: string, tag: string): string {
  const label = getLanguageLabel(tag);
  return `[Output language: ${label} (${tag}). Any text or speech in the result must be in this language.] ${prompt}`;
}

/**
 * Fetch language + return both the tag and a ready-to-paste directive.
 * Convenience for generators that want both in one call.
 */
export async function loadLanguageForUser(userId: string): Promise<{
  tag: string;
  label: string;
  directive: string;
}> {
  const tag = await getUserPreferredLanguage(userId);
  return {
    tag,
    label: getLanguageLabel(tag),
    directive: languageDirective(tag),
  };
}
