/**
 * Backfilling field definitions onto self-entry forms.
 *
 * Smart Collect and Attendance forms created before the public lookup was
 * closed have `fields: "[]"` — they never needed definitions, because the page
 * drove itself off the contact record. Now that respondents type their own
 * details, the definitions have to exist, or the owner's submissions view
 * (which iterates `form.fields`) renders an empty card for every answer.
 *
 * This runs once per form, is idempotent, and only ever fills a genuinely empty
 * field list — it never overwrites definitions an owner has edited.
 */
import { prisma } from "@/lib/db/client";
import { SELF_ENTRY_FORM_FIELDS, type DataFormField } from "@/types/data-form";

export function isSelfEntryFormType(type: string | null | undefined): boolean {
  return type === "SMART_COLLECT" || type === "ATTENDANCE";
}

function parseFields(raw: string | null | undefined): DataFormField[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Returns the fields this form should render, persisting the canonical set the
 * first time a self-entry form is found without any.
 */
export async function ensureSelfEntryFields(form: {
  id: string;
  type: string | null;
  fields: string | null;
}): Promise<DataFormField[]> {
  const existing = parseFields(form.fields);
  if (existing.length > 0) return existing;
  if (!isSelfEntryFormType(form.type)) return existing;

  try {
    await prisma.dataForm.updateMany({
      // Only if it is still empty — a concurrent writer or an owner edit wins.
      where: { id: form.id, OR: [{ fields: "[]" }, { fields: "" }] },
      data: { fields: JSON.stringify(SELF_ENTRY_FORM_FIELDS) },
    });
  } catch (error) {
    // Serving the right fields matters more than recording them; the next
    // request will try again.
    console.error("Self-entry field backfill failed:", error);
  }

  return SELF_ENTRY_FORM_FIELDS;
}
