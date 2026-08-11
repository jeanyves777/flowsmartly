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

export interface ContactSyncPlan {
  /** Everything to write, in one update. Empty means nothing to do. */
  update: Record<string, unknown>;
  /** The contact as it will be once `update` is applied. */
  effectiveContact: SyncableContact;
  /** An SMS box was ticked against a usable number but not promoted. */
  smsConsentWithheld: boolean;
}

/**
 * Compose one contact update from a submission.
 *
 * Order matters here, and getting it wrong is invisible in the parts. Consent
 * requires the contact to hold the channel the consent is for — but the channel
 * may be supplied by this very submission. Judge consent against the contact as
 * it WAS, and someone who adds their email and ticks the email box in the same
 * breath gets the address stored and the consent silently dropped. On the SMS
 * side the withheld answer is never even counted, which defeats the point of
 * recording that it was withheld.
 *
 * So the effective post-fill state is computed first, and nothing is written
 * until the whole plan is known.
 *
 * `approvedChannels` are the email/phone additions the caller has already
 * checked against the per-owner uniqueness constraints — that check needs the
 * database, so it stays outside this function.
 */
export function buildContactSyncPlan(
  contact: SyncableContact,
  data: Record<string, unknown>,
  approvedChannels: { email?: string | null; phone?: string | null } = {},
  now: Date = new Date()
): ContactSyncPlan {
  const fillDelta = buildContactFillDelta(contact, data);

  const channelDelta: { email?: string; phone?: string } = {};
  if (!present(contact.email) && approvedChannels.email) {
    channelDelta.email = approvedChannels.email;
  }
  if (!present(contact.phone) && approvedChannels.phone) {
    channelDelta.phone = approvedChannels.phone;
  }

  // What the contact will be once the fills above land.
  const effectiveContact: SyncableContact = { ...contact, ...fillDelta, ...channelDelta };

  const { smsConsentWithheld, ...consentFields } = buildConsentDelta(
    effectiveContact,
    data,
    now
  );

  return {
    update: { ...fillDelta, ...channelDelta, ...consentFields },
    effectiveContact: { ...effectiveContact, ...consentFields },
    smsConsentWithheld,
  };
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
