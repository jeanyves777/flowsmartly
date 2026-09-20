/**
 * The one place a domain registrant contact comes from.
 *
 * Every route, webhook and cron that registers a domain asks here. Nothing else
 * is allowed to assemble a contact, because the failure this exists to stop is
 * not a missing check — it is a caller manufacturing the facts a check needs:
 *
 *     brandKit.city is null
 *       -> caller writes "New York"
 *       -> assertCompleteRegistrant() sees a non-empty city
 *       -> passes
 *
 * The guard was correct the whole time. Production had already invented the
 * evidence that satisfied it. So the rule is:
 *
 *   > A validation guard is not authoritative if an upstream caller is allowed
 *   > to invent the facts needed to satisfy it.
 *
 * Registrars require registrant contact details to be accurate, and ICANN can
 * suspend or cancel a domain over knowingly inaccurate data. Whether any of it
 * is published is a separate question — since ICANN's Registration Data Policy
 * took effect in 2025, personal registration data is redacted from public RDDS
 * output by default — so this file does not tell anyone their home address will
 * be public. It refuses to file something untrue, which is reason enough.
 */

import { prisma } from "@/lib/db/client";
import type { DomainRegistrantContact } from "./opensrs-client";

/** The brand identity a registrant is read from. */
export interface RegistrantSource {
  id: string;
  name: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

/**
 * Default first, then the oldest.
 *
 * Exported because "which business identity did we file this under" is a fact
 * worth being able to test. The schema allows several brand kits per user with
 * no unique constraint on `isDefault`, so a bare `findFirst` returns whichever
 * row the database felt like — real data, from the wrong business.
 */
export function pickBrandKit<T extends { isDefault: boolean; createdAt: Date }>(
  kits: readonly T[]
): T | null {
  const sorted = [...kits].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0] ?? null;
}

/** A field somebody has to fill in, in the words the owner will read. */
export interface MissingRegistrantField {
  field: string;
  label: string;
  why: string;
}

/**
 * A registrant contact that came from here.
 *
 * The brand is the point. Without it, `purchaseDomain({ contact })` accepted any
 * object of the right shape, so `{ first_name: "Domain", last_name: "Owner",
 * city: "New York" }` still compiled and still reached the registrar — the
 * authority was a convention the type system did not know about. A branded type
 * cannot be constructed outside this file, so "only this module assembles a
 * registrant" is now something the compiler enforces rather than something a
 * comment asks for.
 */
export type ResolvedRegistrantContact = DomainRegistrantContact & {
  readonly [registrantBrand]: true;
};

declare const registrantBrand: unique symbol;

export type RegistrantResolution =
  | {
      ok: true;
      contact: ResolvedRegistrantContact;
      /** Which brand identity it came from, so a caller can record it. */
      brandKitId: string;
    }
  | { ok: false; missing: MissingRegistrantField[] };

/**
 * Resolve the registrant contact for a user, or say exactly what is missing.
 *
 * There is no partial success and no default for anything. A caller that gets
 * `ok: false` has one correct response: stop, and tell the owner which fields
 * to complete.
 */
export async function resolveRegistrantContact(userId: string): Promise<RegistrantResolution> {
  const [brandKit, user] = await Promise.all([
    // **Default first, then the oldest.** The schema allows a user several
    // brand kits and puts no unique constraint on `isDefault`, so a bare
    // `findFirst` returns whichever row the database felt like — real data,
    // from the wrong business. That is not fabrication, but it is still an
    // inaccurate registrant, and it is the same class of error: an identity
    // nobody chose. This matches `lib/brand/get-brand`, with a deterministic
    // tie-break so two kits flagged default cannot alternate between calls.
    prisma.brandKit.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        ownerFirstName: true,
        ownerLastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        country: true,
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  return registrantFrom(brandKit, user?.email ?? null);
}

/**
 * The decision, with no database in it.
 *
 * Split out so the rules can be tested against the code that actually runs
 * rather than a transcription of it. Everything that decides whether a
 * registration may proceed lives here.
 */
export function registrantFrom(
  brandKit: RegistrantSource | null,
  fallbackEmail: string | null
): RegistrantResolution {

  const missing: MissingRegistrantField[] = [];
  const need = (value: string | null | undefined, field: string, label: string, why: string) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) {
      missing.push({ field, label, why });
      return "";
    }
    return trimmed;
  };

  // The registrant is a person, and a business name is not one. Splitting
  // "Acme Plumbing" into Acme / Plumbing filed a company as a human being on a
  // contact the registrar uses for identity verification.
  const firstName = need(
    brandKit?.ownerFirstName,
    "ownerFirstName",
    "Owner first name",
    "The registrar verifies the person who owns the domain, so this has to be a real name rather than the business name."
  );
  const lastName = need(
    brandKit?.ownerLastName,
    "ownerLastName",
    "Owner last name",
    "The registrar verifies the person who owns the domain, so this has to be a real name rather than the business name."
  );

  const address1 = need(brandKit?.address, "address", "Street address", "Registrars require a real postal address for the owner.");
  const city = need(brandKit?.city, "city", "City", "Registrars require a real postal address for the owner.");
  const state = need(brandKit?.state, "state", "State or region", "Registrars require a real postal address for the owner.");
  const postalCode = need(brandKit?.zip, "zip", "Postal code", "Registrars require a real postal address for the owner.");

  const email = need(
    brandKit?.email || fallbackEmail,
    "email",
    "Owner email",
    "The registrar sends a verification email here, and the domain is suspended if nobody answers it."
  );

  // Two-letter ISO, which is what registrars accept. A country stored as
  // "United States" is not wrong, it is just not this — and the old code
  // answered that by substituting "US", which is a guess about somebody's
  // country of residence.
  const rawCountry = (brandKit?.country ?? "").trim().toUpperCase();
  let country = "";
  if (!rawCountry) {
    missing.push({
      field: "country",
      label: "Country",
      why: "Registrars need the owner's country as a two-letter code.",
    });
  } else if (!/^[A-Z]{2}$/.test(rawCountry)) {
    missing.push({
      field: "country",
      label: "Country",
      why: `Save the country as a two-letter code (US, CA, GB) rather than "${rawCountry}".`,
    });
  } else {
    country = rawCountry;
  }

  // Full international format, because there is no way to know a country
  // dialling code from a bare string. The old code assumed +1, which quietly
  // filed every non-US owner under a North American number.
  const rawPhone = (brandKit?.phone ?? "").trim();
  let phone = "";
  if (!rawPhone) {
    missing.push({
      field: "phone",
      label: "Owner phone",
      why: "Registrars require a reachable phone number for the owner.",
    });
  } else if (!rawPhone.startsWith("+")) {
    missing.push({
      field: "phone",
      label: "Owner phone",
      why: "Include the country code, like +1 555 123 4567. We will not guess which country a number belongs to.",
    });
  } else if (!country) {
    // The country failed its own check above and already said so. Without it
    // there is nothing to check the dialling code against, and guessing is the
    // thing this function exists not to do.
  } else if (!DIAL_CODES[country]) {
    missing.push({
      field: "phone",
      label: "Owner phone",
      why: `We do not yet have the dialling code for ${country} on file, so we cannot confirm where this number's country code ends. Get in touch and we will add it.`,
    });
  } else {
    const split = splitDialCode(rawPhone, country);
    if (!split.ok) {
      missing.push({
        field: "phone",
        label: "Owner phone",
        why: `This number does not begin with +${DIAL_CODES[country]}, the dialling code for ${country}. Use a phone number in the owner's own country, or correct the country.`,
      });
    } else {
      phone = split.formatted;
    }
  }

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    brandKitId: brandKit?.id ?? "",
    contact: Object.freeze({
      first_name: firstName,
      last_name: lastName,
      // The business name is an organization, which is exactly what it is —
      // and optional, because a personal domain has no organization.
      ...(brandKit?.name?.trim() ? { org_name: brandKit.name.trim() } : {}),
      address1,
      city,
      state,
      postal_code: postalCode,
      country,
      phone,
      email,
    }) as ResolvedRegistrantContact,
  };
}

/**
 * OpenSRS wants `+CC.NNNNNNN`, where `CC` is the real country dialling code.
 *
 * The hard part is knowing where the code ends, and the previous version
 * guessed it with a regex whose only three-digit branch was `2xx`. A Finnish
 * number then split in the wrong place:
 *
 *     +358401234567  ->  +35.8401234567
 *
 * It had not invented a country code, but it had moved one — which is the same
 * kind of untruth on a registrar filing, and harder to notice.
 *
 * There is no phone-number metadata library in this project, so the boundary is
 * not inferred at all. It is **looked up** from the registrant's ISO country,
 * which is a fact this module already requires and validates, and then the
 * number is *checked* against it. A number that does not start with its own
 * country's dialling code is refused rather than reinterpreted — see
 * `registrantPhone` below, which returns the reason instead of a value.
 */
function splitDialCode(e164: string, isoCountry: string): { ok: true; formatted: string } | { ok: false } {
  const digits = e164.replace(/\D/g, "");
  const dial = DIAL_CODES[isoCountry];
  if (!dial || !digits.startsWith(dial)) return { ok: false };
  return { ok: true, formatted: `+${dial}.${digits.slice(dial.length)}` };
}

/**
 * ITU-assigned country dialling codes, by ISO 3166-1 alpha-2.
 *
 * A table rather than a pattern, because these are assignments, not a rule you
 * can derive: 1, 44, 358 and 1809 are all legitimate and no amount of regex
 * tells you where one ends. Covers the countries this product sells into; a
 * country that is missing produces a refusal naming it, which is a support
 * ticket and a one-line addition rather than a wrong number filed with a
 * registrar.
 */
const DIAL_CODES: Record<string, string> = {
  US: "1", CA: "1", GB: "44", IE: "353", FR: "33", DE: "49", ES: "34", IT: "39",
  PT: "351", NL: "31", BE: "32", LU: "352", CH: "41", AT: "43", DK: "45",
  SE: "46", NO: "47", FI: "358", IS: "354", PL: "48", CZ: "420", SK: "421",
  HU: "36", RO: "40", BG: "359", GR: "30", HR: "385", SI: "386", EE: "372",
  LV: "371", LT: "370", AU: "61", NZ: "64", JP: "81", KR: "82", CN: "86",
  IN: "91", SG: "65", HK: "852", MY: "60", TH: "66", PH: "63", ID: "62",
  VN: "84", AE: "971", SA: "966", IL: "972", TR: "90", ZA: "27", NG: "234",
  GH: "233", KE: "254", CI: "225", SN: "221", CM: "237", MA: "212", EG: "20",
  BR: "55", MX: "52", AR: "54", CL: "56", CO: "57", PE: "51", UY: "598",
};

/** The sentence an owner sees when their details are not complete enough. */
export function describeMissingRegistrant(missing: MissingRegistrantField[]): string {
  const labels = missing.map((m) => m.label).join(", ");
  return `Domain registrars require accurate owner contact details. Add the missing information in Brand Identity before registration can continue: ${labels}.`;
}
