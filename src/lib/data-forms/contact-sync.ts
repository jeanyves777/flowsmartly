/**
 * Turning a self-entry submission into changes on a Contact.
 *
 * The governing rule, and the reason this is a pure function rather than
 * inline route code:
 *
 *   Sync may FILL an empty Contact field from an explicit self-entry field.
 *   It must NEVER overwrite an existing non-empty Contact field merely because
 *   a submission differs.
 *
 * A submission is durable evidence of what someone typed. It is not an
 * instruction to replace what the owner already holds — two people share an
 * address, someone mistypes, a stale form is resubmitted. Filling a gap is
 * safe; overwriting is a business decision nobody made.
 */
import {
  hasEmailConsent,
  hasSmsConsent,
  SMS_CONSENT_IS_AUTHORITATIVE,
} from "@/types/data-form";

/** Fields a respondent may fill on their own record, by Contact column name. */
export const FILLABLE_CONTACT_KEYS = [
  "firstName",
  "lastName",
  "birthday",
  "address",
  "city",
  "state",
] as const;

export type FillableContactKey = (typeof FILLABLE_CONTACT_KEYS)[number];

export type SyncableContact = Partial<
  Record<FillableContactKey | "email" | "phone", string | null>
> & {
  emailOptedIn?: boolean | null;
  smsOptedIn?: boolean | null;
};

function present(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** A trimmed string from the submission, or null. */
export function submittedValue(
  data: Record<string, unknown>,
  key: string
): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The fields that may be written to an EXISTING contact: only the ones we do
 * not already hold. Never returns a key whose current value is non-empty.
 */
export function buildContactFillDelta(
  contact: SyncableContact,
  data: Record<string, unknown>
): Partial<Record<FillableContactKey, string>> {
  const delta: Partial<Record<FillableContactKey, string>> = {};

  for (const key of FILLABLE_CONTACT_KEYS) {
    if (present(contact[key])) continue; // we already hold it — leave it alone
    const value = submittedValue(data, key);
    if (value) delta[key] = value;
  }

  return delta;
}

export interface ConsentDelta {
  emailOptedIn?: boolean;
  emailOptedInAt?: Date;
  smsOptedIn?: boolean;
  smsOptedInAt?: Date;
  /** The SMS box was ticked but may not yet be promoted to an opt-in. */
  smsConsentWithheld: boolean;
}

/**
 * Consent changes, from the exact affirmative and nothing else.
 *
 * Only ever grants: an absent tick is not a withdrawal, which is its own
 * deliberate act on a surface that asks for it. And SMS is gated separately —
 * a ticked box is recorded as evidence on the submission, but is not promoted
 * into `smsOptedIn` until the disclosure copy is cleared.
 */
export function buildConsentDelta(
  contact: SyncableContact,
  data: Record<string, unknown>,
  now: Date = new Date()
): ConsentDelta {
  const delta: ConsentDelta = { smsConsentWithheld: false };

  if (hasEmailConsent(data) && present(contact.email) && !contact.emailOptedIn) {
    delta.emailOptedIn = true;
    delta.emailOptedInAt = now;
  }

  if (hasSmsConsent(data) && present(contact.phone) && !contact.smsOptedIn) {
    if (SMS_CONSENT_IS_AUTHORITATIVE) {
      delta.smsOptedIn = true;
      delta.smsOptedInAt = now;
    } else {
      delta.smsConsentWithheld = true;
    }
  }

  return delta;
}

/** The consent columns for a contact being created from a submission. */
export function initialConsentFields(
  data: Record<string, unknown>,
  email: string | null,
  phone: string | null,
  now: Date = new Date()
): {
  emailOptedIn: boolean;
  emailOptedInAt: Date | null;
  smsOptedIn: boolean;
  smsOptedInAt: Date | null;
} {
  const emailGranted = !!email && hasEmailConsent(data);
  const smsGranted = !!phone && hasSmsConsent(data) && SMS_CONSENT_IS_AUTHORITATIVE;

  return {
    emailOptedIn: emailGranted,
    emailOptedInAt: emailGranted ? now : null,
    smsOptedIn: smsGranted,
    smsOptedInAt: smsGranted ? now : null,
  };
}
