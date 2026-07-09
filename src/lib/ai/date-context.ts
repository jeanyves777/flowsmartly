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
 * Date directive for DESIGN / image / flyer prompts. The date is CONTEXT so the
 * model knows "now" — it is NOT content to render. The model was reading the old
 * "any year shown must be 2026" phrasing as a cue to STAMP the year on the
 * design (uninstructed "2026" badges / "Limited 2026 Run" lines — the year-drift
 * bug). So: forbid adding a year/date unless the brief asks, and only then pin it
 * to the current (or a user-provided future) year — never a stale past year.
 */
export function currentDateDirective(now: Date = new Date()): string {
  const year = now.getFullYear();
  const formatted = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `Today's date is ${formatted} (current year ${year}) — this is CONTEXT so you know what "now" is; it is NOT content to put on the design. Do NOT add any year, date, "20XX" badge, "Season ${year}", copyright line, or other time stamp to the design UNLESS the user's brief explicitly calls for a date. When the brief DOES call for a year/date, it MUST be ${year} (or a future date the user provided) — never a past year like 2023 or 2024.`;
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
