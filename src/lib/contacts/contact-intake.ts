/**
 * Contacts arriving from a discovery source — a CSV upload, a follow-up
 * export, anything that hands us a channel we did not previously hold.
 *
 * The invariant:
 *
 *   Possession of an email address or phone number is contact data, not
 *   marketing consent. Importing, exporting, copying, syncing or discovering
 *   that channel may never manufacture consent evidence.
 *
 * None of the following is consent, and none of them may ever be read as it:
 * an email exists · a phone exists · the contact was imported · the owner
 * uploaded the CSV · the owner exported the follow-up · the contact is in a
 * marketing list · the contact previously received a message.
 *
 * Note what is deliberately absent: there is no "trust the file" path. An
 * uploaded column saying `optedIn: true` is an assertion by the importer, not
 * evidence of the recipient's affirmative act, and accepting it would swap one
 * false claim for a more plausible-looking one. Governed imported consent —
 * source type, original timestamp, the disclosure actually shown, provenance,
 * importer authority, channel and use case, validation — is real work that
 * belongs with the consent design. It is not this.
 */

export interface ContactConsentColumns {
  emailOptedIn: boolean;
  emailOptedInAt: Date | null;
  smsOptedIn: boolean;
  smsOptedInAt: Date | null;
}

/**
 * The consent columns for a Contact created from a discovery source.
 *
 * Always none. It takes no arguments on purpose: there is no input from these
 * sources that could change the answer, and a parameter would invite one.
 */
export function consentForDiscoveredContact(): ContactConsentColumns {
  return {
    emailOptedIn: false,
    emailOptedInAt: null,
    smsOptedIn: false,
    smsOptedInAt: null,
  };
}

export interface ImportedContactInput {
  userId: string;
  email: string | null;
  phone: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  birthday?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  tags?: string[];
}

/** The Contact row a CSV import creates. */
export function buildImportedContactData(input: ImportedContactInput) {
  const tags = input.tags ?? [];
  return {
    userId: input.userId,
    email: input.email,
    phone: input.phone,
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    company: input.company || null,
    birthday: input.birthday || null,
    city: input.city || null,
    state: input.state || null,
    address: input.address || null,
    tags: tags.length > 0 ? JSON.stringify(tags) : "[]",
    ...consentForDiscoveredContact(),
  };
}

export interface FollowUpContactInput {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  address: string | null;
}

/** The Contact row a follow-up export creates. */
export function buildFollowUpContactData(input: FollowUpContactInput) {
  const nameParts = (input.name || "").split(/\s+/).filter(Boolean);

  return {
    userId: input.userId,
    email: input.email,
    phone: input.phone,
    firstName: nameParts[0] || null,
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
    address: input.address,
    ...consentForDiscoveredContact(),
  };
}

export interface ExistingContactSnapshot {
  email?: string | null;
  phone?: string | null;
  tags?: string | null;
}

/**
 * The fields a CSV import may change on a contact that already exists.
 *
 * Consent columns are absent by construction. Consent is granted by the
 * recipient and never revoked — or created — as a side effect of someone
 * re-uploading a spreadsheet, so an import neither sets an opt-in nor clears
 * one. A channel is filled only when we do not already hold it.
 */
export function buildImportedContactUpdate(
  existing: ExistingContactSnapshot,
  input: Omit<ImportedContactInput, "userId" | "email" | "phone"> & {
    email?: string | null;
    phone?: string | null;
  }
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (input.firstName) update.firstName = input.firstName;
  if (input.lastName) update.lastName = input.lastName;
  if (input.email && !existing.email) update.email = input.email;
  if (input.phone && !existing.phone) update.phone = input.phone;
  if (input.company) update.company = input.company;
  if (input.birthday) update.birthday = input.birthday;
  if (input.city) update.city = input.city;
  if (input.state) update.state = input.state;
  if (input.address) update.address = input.address;

  const tags = input.tags ?? [];
  if (tags.length > 0) {
    let existingTags: string[] = [];
    try {
      const parsed = JSON.parse(existing.tags || "[]");
      if (Array.isArray(parsed)) existingTags = parsed;
    } catch {
      existingTags = [];
    }
    update.tags = JSON.stringify([...new Set([...existingTags, ...tags])]);
  }

  return update;
}
