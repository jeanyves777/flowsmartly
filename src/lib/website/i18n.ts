/**
 * Website i18n — translation overlay system
 *
 * Default content is stored in English in block.content.
 * Translations are stored per-page in WebsitePage.translations JSON:
 * { "fr": { "blockId": { "headline": "Bonjour", "description": "..." } } }
 */

import type { WebsiteBlock, BlockContent } from "@/types/website-builder";

type TranslationsMap = Record<string, Record<string, Record<string, string>>>;

/**
 * Get localized content for a block by merging translations on top of defaults
 */
export function getLocalizedContent(
  block: WebsiteBlock,
  locale: string,
  translations: TranslationsMap
): BlockContent {
  if (!locale || locale === "en") return block.content;

  const langTranslations = translations[locale];
  if (!langTranslations) return block.content;

  const blockTranslations = langTranslations[block.id];
  if (!blockTranslations) return block.content;

  // Merge translations on top of default content (shallow)
  return { ...block.content, ...blockTranslations } as BlockContent;
}

/**
 * Apply translations to an array of blocks
 */
export function localizeBlocks(
  blocks: WebsiteBlock[],
  locale: string,
  translationsJson: string
): WebsiteBlock[] {
  if (!locale || locale === "en") return blocks;

  let translations: TranslationsMap = {};
  try { translations = JSON.parse(translationsJson || "{}"); } catch { return blocks; }

  return blocks.map((block) => ({
    ...block,
    content: getLocalizedContent(block, locale, translations),
  }));
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "hi", label: "Hindi" },
  { code: "tr", label: "Turkish" },
  { code: "sv", label: "Swedish" },
];
