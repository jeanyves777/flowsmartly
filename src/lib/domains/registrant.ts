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

/** A field somebody has to fill in, in the words the owner will read. */
export interface MissingRegistrantField {
  field: string;
  label: string;
  why: string;
}

export type RegistrantResolution =
  | { ok: true; contact: DomainRegistrantContact }
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
    prisma.brandKit.findFirst({
      where: { userId },
      select: {
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
    brandKit?.email || user?.email,
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
  } else {
    phone = toRegistrarPhone(rawPhone);
  }

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
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
    }),
  };
}

/**
 * OpenSRS wants `+CC.NNNNNNN`. This only reformats a number that already
 * carries its own country code — it never adds one.
 */
function toRegistrarPhone(e164: string): string {
  if (e164.includes(".")) return e164;
  const digits = e164.replace(/\D/g, "");
  // One to three digits of country code, which is the whole range E.164 uses.
  const match = /^(1|7|2[0-9]{2}|[2-9][0-9]?)(\d+)$/.exec(digits);
  if (!match) return `+${digits}`;
  return `+${match[1]}.${match[2]}`;
}

/** The sentence an owner sees when their details are not complete enough. */
export function describeMissingRegistrant(missing: MissingRegistrantField[]): string {
  const labels = missing.map((m) => m.label).join(", ");
  return `Domain registrars require accurate owner contact details. Add the missing information in Brand Identity before registration can continue: ${labels}.`;
}
