/**
 * date-context — single source of truth for "what's today" in AI prompts.
 *
 * Companion to user-language.ts: every generator that can emit a year, holiday,
 * season, schedule, or copyright line MUST inject the current date, or the model
 * fills the gap from its training data and renders a stale year (the
 * "Father's Day 2024" badge bug in mid-2026). Import the directive instead of
 * re-deriving the date per generator.
 */

/**
 * Strong directive for DESIGN / image / flyer prompts: tells the model today's
 * date and forbids printing a past year unless the user asked. Use in any
 * generator that renders dated/seasonal visuals or copy.
 */
export function currentDateDirective(now: Date = new Date()): string {
  const year = now.getFullYear();
  const formatted = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `Today's date is ${formatted} (current year ${year}). Any year shown — event dates, "20XX" badges, copyright lines, seasonal references — MUST be ${year} or a future date the user explicitly provided. NEVER print a past year (e.g. 2023, 2024) unless the user asked for it.`;
}

/**
 * Lighter "Today's date: …" prefix for chat/agent/text prompts that just need
 * temporal grounding (captions, copy, proposals) without the design-specific
 * "no past year" framing.
 */
export function currentDateContext(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  const formatted = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `Today's date is ${formatted} (${iso}). Use the current year for any time-sensitive references unless the user specifies otherwise.`;
}

/**
 * Per-occurrence year hint for scheduled/holiday content that may fire in a
 * future year (e.g. a holiday that already passed this year). Standardizes the
 * pattern several routes invented independently.
 */
export function eventYearHint(occurrenceAt: Date): string {
  const y = occurrenceAt.getFullYear();
  return `This content is for the ${y} occurrence — use ${y} for any year shown, never any other year.`;
}
