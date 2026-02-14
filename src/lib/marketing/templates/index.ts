/**
 * Marketing Template Library — 61 templates across 6 categories
 *
 * Usage:
 *   import { getAllTemplates, getTemplatesByCategory, getTemplateById } from "@/lib/marketing/templates";
 *   const all = getAllTemplates();                        // 61 templates
 *   const lifecycle = getTemplatesByCategory("lifecycle"); // 13 templates
 *   const template = getTemplateById("welcome");          // single template
 */

export type { MarketingTemplate, TemplateCategory, DefaultEmailContent } from "./types";
export { TEMPLATE_CATEGORIES } from "./types";

import type { MarketingTemplate, TemplateCategory } from "./types";
import { LIFECYCLE_TEMPLATES } from "./lifecycle";
import { BIRTHDAY_TEMPLATES } from "./birthday";
import { HOLIDAY_TEMPLATES } from "./holiday";
import { PROMOTIONAL_TEMPLATES } from "./promotional";
import { CONTENT_TEMPLATES } from "./content";
import { TRANSACTIONAL_TEMPLATES } from "./transactional";

// Re-export category arrays for direct access
export {
  LIFECYCLE_TEMPLATES,
  BIRTHDAY_TEMPLATES,
  HOLIDAY_TEMPLATES,
  PROMOTIONAL_TEMPLATES,
  CONTENT_TEMPLATES,
  TRANSACTIONAL_TEMPLATES,
};

// ---------------------------------------------------------------------------
// All templates combined
// ---------------------------------------------------------------------------

const ALL_TEMPLATES: MarketingTemplate[] = [
  ...LIFECYCLE_TEMPLATES,
  ...BIRTHDAY_TEMPLATES,
  ...HOLIDAY_TEMPLATES,
  ...PROMOTIONAL_TEMPLATES,
  ...CONTENT_TEMPLATES,
  ...TRANSACTIONAL_TEMPLATES,
];

// Pre-built lookup map by ID
const TEMPLATE_MAP = new Map<string, MarketingTemplate>();
for (const t of ALL_TEMPLATES) {
  TEMPLATE_MAP.set(t.id, t);
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Get all 61 templates. */
export function getAllTemplates(): MarketingTemplate[] {
  return ALL_TEMPLATES;
}

/** Get templates filtered by category. */
export function getTemplatesByCategory(category: TemplateCategory): MarketingTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

/** Find a single template by its unique ID. */
export function getTemplateById(id: string): MarketingTemplate | undefined {
  return TEMPLATE_MAP.get(id);
}

/** Get templates that support email. */
export function getEmailTemplates(): MarketingTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.channels.includes("email"));
}

/** Get templates that support SMS. */
export function getSmsTemplates(): MarketingTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.channels.includes("sms"));
}

/** Get templates that can be used as automation triggers. */
export function getAutomatableTemplates(): MarketingTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.automatable);
}

/** Search templates by name or description. */
export function searchTemplates(query: string): MarketingTemplate[] {
  const q = query.toLowerCase();
  return ALL_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.id.includes(q)
  );
}
