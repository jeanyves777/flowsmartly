/**
 * Resolving the fields a self-entry form asks for.
 *
 * Smart Collect and Attendance forms created before the public lookup was
 * closed have `fields: "[]"` — they never needed definitions, because the page
 * drove itself off the contact record. Now that respondents type their own
 * details, the definitions have to exist, or the owner's submissions view
 * (which iterates `form.fields`) renders an empty card for every answer.
 *
 * This resolves them IN MEMORY. It does not write.
 *
 *   Reads may adapt legacy representation; reads do not silently migrate
 *   durable business state.
 *
 * An earlier version backfilled the definitions from the public GET. That is
 * wrong twice over: GET is a safe method (RFC 9110) precisely so crawlers,
 * prefetchers, caches and retries can call it without changing anything, and an
 * anonymous request has no business deciding when an owner's record changes.
 *
 * New forms persist the canonical set at creation. Legacy forms stay virtual
 * until the owner next saves the form, which writes them through the normal
 * authenticated path.
 */
import { SELF_ENTRY_FORM_FIELDS, type DataFormField } from "@/types/data-form";

export function isSelfEntryFormType(type: string | null | undefined): boolean {
  return type === "SMART_COLLECT" || type === "ATTENDANCE";
}

export function parseFormFields(raw: string | null | undefined): DataFormField[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * The fields this form effectively asks for: its own if it has any, otherwise
 * the canonical self-entry set for a legacy self-entry form.
 *
 * Every reader — the public form, the owner's form, and sync — must use this,
 * so all three agree about what was asked without anyone writing.
 */
export function effectiveFormFields(form: {
  type: string | null;
  fields: string | null;
}): DataFormField[] {
  const own = parseFormFields(form.fields);
  if (own.length > 0) return own;
  if (!isSelfEntryFormType(form.type)) return own;
  return SELF_ENTRY_FORM_FIELDS;
}
