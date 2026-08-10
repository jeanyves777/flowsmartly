/**
 * Domain Manager — orchestrates OpenSRS, Cloudflare, and Prisma for domain operations.
 */
import { prisma } from "@/lib/db/client";
import {
  describeMissingRegistrant,
  resolveRegistrantContact,
  type MissingRegistrantField,
} from "./registrant";
import { searchDomain, registerDomain, getDomainInfo, setNameservers, isAvailable as isOpenSrsAvailable } from "./opensrs-client";
import { searchDomainsRdap } from "./rdap-client";
import { createZone, configureStoreDns, configureZoneSecurity, getZone, getSslStatus, deleteZone } from "./cloudflare-client";
import { DOMAIN_PRICING, SUPPORTED_TLDS, FREE_DOMAIN_TLDS, isFreeDomainEligible } from "./pricing";
import {
  createDomainVerificationToken,
  getDomainVerificationRecord,
  getEffectiveVerificationStatus,
  isDomainVerified,
} from "./verification";

// ── Types ──

export interface DomainSearchItem {
  domain: string;
  tld: string;
  available: boolean;
  retailCents: number;
  costCents: number;
  isFreeEligible: boolean;
}

export interface DomainContact {
  first_name: string;
  last_name: string;
  /** optional: an individual registrant legitimately has no organisation */
  org_name?: string;
  address1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
}

export interface PurchaseDomainParams {
  storeId: string | null;
  userId: string;
  domainName: string;
  tld: string;
  isFree: boolean;
  contact?: DomainContact;
}

export interface ConnectDomainParams {
  storeId: string | null;
  userId: string;
  domain: string;
}

export interface ConnectDomainResult {
  domainId: string;
  nameservers: string[];
  verification: {
    status: "pending" | "verified" | "failed";
    record: {
      type: "TXT";
      name: string;
      value: string;
    };
  };
  instructions: string;
}

export interface DomainStatusResult {
  id: string;
  domainName: string;
  registrarStatus: string;
  cloudflareStatus: string | null;
  sslStatus: string;
  nameservers: string[];
  isPrimary: boolean;
  isConnected: boolean;
  expiresAt: Date | null;
  verification: {
    status: "pending" | "verified" | "failed";
    token: string | null;
    record: {
      type: "TXT";
      name: string;
      value: string;
    } | null;
    verifiedAt: Date | null;
    lastCheckedAt: Date | null;
    error: string | null;
  } | null;
  registrantVerification: {
    status: string | null;
    deadline: Date | null;
    daysToSuspend: number | null;
    emailBounced: boolean | null;
    lastCheckedAt: Date | null;
    lastSentAt: Date | null;
    error: string | null;
    actionRequired: boolean;
  };
}

// ── Helpers ──

/**
 * Clean a domain query: strip spaces, special chars, extract SLD if a full domain was given.
 */
function cleanQuery(query: string): string {
  // Remove protocol and path
  let cleaned = query
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  // If it looks like a full domain (contains dot), extract the SLD (part before first dot)
  if (cleaned.includes(".")) {
    cleaned = cleaned.split(".")[0];
  }

  // Remove anything that's not alphanumeric or hyphen
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");

  // Remove leading/trailing hyphens
  cleaned = cleaned.replace(/^-+|-+$/g, "");

  return cleaned;
}

/**
 * Generate a unique registrant username/password for OpenSRS from store + user IDs.
 */
function generateRegCredentials(storeId: string, userId: string) {
  // OpenSRS only allows alphanumerics (A-Z, a-z, 0-9) — no hyphens or special chars
  const cleanStore = storeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const cleanUser = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const ts = Date.now().toString(36).replace(/[^a-zA-Z0-9]/g, "");
  return {
    regUsername: `fs${cleanStore}`,
    regPassword: `fp${cleanUser}${ts}`,
  };
}

/**
 * The registrant contact for a user, or a refusal naming what is missing.
 *
 * Delegates to the single authority in `./registrant`. Nothing in this file
 * assembles a contact any more: the previous version derived a person's first
 * and last name by splitting the *business* name, and turned a bare phone
 * number into `+1.` on the assumption that anything without a country code is
 * North American. Both were inventions, and both satisfied the completeness
 * guard that was supposed to catch exactly this.
 */
export async function getRegistrantContactForUser(
  userId: string,
  providedContact?: DomainContact
): Promise<DomainContact> {
  // A caller may pass a contact it has already resolved through the authority.
  // It may not pass one it assembled itself — `assertCompleteRegistrant` in the
  // OpenSRS client is the backstop for that, and it refuses on any empty field.
  if (providedContact) return providedContact;

  const resolved = await resolveRegistrantContact(userId);
  if (!resolved.ok) {
    throw new RegistrantIncompleteError(resolved.missing);
  }
  return resolved.contact;
}

/**
 * The owner has not told us who they are yet.
 *
 * Its own type because every caller has to distinguish it from a registrar
 * outage: this one is fixed by the owner filling in a form, and saying "domain
 * registration failed, try again" would send them round a loop that cannot
 * terminate.
 */
export class RegistrantIncompleteError extends Error {
  readonly missing: MissingRegistrantField[];

  constructor(missing: MissingRegistrantField[]) {
    super(describeMissingRegistrant(missing));
    this.name = 'RegistrantIncompleteError';
    this.missing = missing;
  }
}

// ── Public API ──

/**
 * Search for available domains across supported TLDs.
 *
 * Cleans the query string, performs OpenSRS lookups in parallel, and combines
 * with pricing information.
 */
export async function searchDomains(
  query: string,
  tlds?: string[]
): Promise<DomainSearchItem[]> {
  const sld = cleanQuery(query);
  if (!sld) {
    throw new Error("Invalid domain search query: no valid characters after cleaning");
  }

  const searchTlds = tlds ?? SUPPORTED_TLDS;

  // Helper to enrich results with pricing
  const enrichResults = (results: Array<{ domain: string; tld: string; available: boolean }>) =>
    results.map((r) => {
      const pricing = DOMAIN_PRICING[r.tld] ?? { costCents: 0, retailCents: 0 };
      return {
        domain: r.domain,
        tld: r.tld,
        available: r.available,
        retailCents: pricing.retailCents,
        costCents: pricing.costCents,
        isFreeEligible: isFreeDomainEligible(r.tld),
      };
    });

  // Try OpenSRS first if configured
  if (isOpenSrsAvailable()) {
    try {
      const results = await searchDomain(sld, searchTlds);
      return enrichResults(results);
    } catch (error) {
      console.error("[domains] OpenSRS lookup failed, falling back to RDAP:", error instanceof Error ? error.message : error);
      // Fall through to RDAP
    }
  } else {
    console.warn("[domains] OpenSRS not configured — using RDAP fallback");
  }

  // Fallback: RDAP (free, no credentials)
  try {
    const rdapResults = await searchDomainsRdap(sld, searchTlds);
    return enrichResults(rdapResults);
  } catch (error) {
    console.error("[domains] RDAP fallback also failed:", error);
    throw new Error(
      `Domain search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Purchase and provision a new domain.
 *
 * Full flow:
 * 1. Validate domain availability via OpenSRS lookup
 * 2. Register domain via OpenSRS with Cloudflare nameservers
 * 3. Create Cloudflare zone
 * 4. Configure DNS records (A record -> server IP, CNAME www -> domain)
 * 5. Save StoreDomain record to database
 * 6. If first domain or explicitly primary, update store.customDomain
 * 7. Return the created StoreDomain record
 *
 * If registration succeeds but Cloudflare fails, the domain record is still
 * saved with pending Cloudflare status so it can be retried.
 */
/**
 * What a purchase attempt actually did.
 *
 * A discriminated result rather than a row, because the row was the bug. The
 * registrar refusal was caught, written to `registrarStatus` and then the
 * function returned normally — so every caller read "it returned" as "it
 * worked". A free-domain request could answer `{ success: true, status:
 * "registration_failed" }`, and the paid webhook logged "Domain registered",
 * raised a registration invoice and sent a "your domain is registered" email
 * for a domain the registrar had rejected.
 *
 * The failed row is still worth keeping — it is how a retry finds the domain.
 * What may never happen is a refusal travelling back through the success
 * channel.
 *
 *   > A registrar refusal may create a durable failed or pending recovery
 *   > record, but it can never return through the success channel or trigger
 *   > any artifact that claims registration succeeded.
 */
export type DomainPurchaseOutcome =
  /** The registrar accepted it. Only this may be described as registered. */
  | { status: "registered"; domain: StoreDomainRecord }
  /** The registrar rejected it. The row exists so a retry can find it. */
  | { status: "registration_failed"; domain: StoreDomainRecord; error: string }
  /** No registrar is configured here. Not a refusal, and not a registration. */
  | { status: "pending_registration"; domain: StoreDomainRecord };

type StoreDomainRecord = Awaited<ReturnType<typeof prisma.storeDomain.create>>;

export async function purchaseDomain(params: PurchaseDomainParams): Promise<DomainPurchaseOutcome> {
  const { storeId, userId, domainName, tld, isFree, contact } = params;
  const fullDomain = `${domainName}.${tld}`;

  // Step 1: Validate availability (try OpenSRS, fall back to RDAP)
  let isAvailable = false;
  try {
    if (isOpenSrsAvailable()) {
      const lookupResults = await searchDomain(domainName, [tld]);
      const match = lookupResults.find((r) => r.tld === tld);
      isAvailable = match?.available ?? false;
    } else {
      throw new Error("OpenSRS not available");
    }
  } catch {
    // Fallback to RDAP for availability check
    try {
      const rdapResults = await searchDomainsRdap(domainName, [tld]);
      const match = rdapResults.find((r) => r.tld === tld);
      isAvailable = match?.available ?? false;
    } catch (rdapError) {
      console.error("Both OpenSRS and RDAP availability checks failed:", rdapError);
      // If we can't verify, allow the purchase attempt — OpenSRS will reject if taken
      isAvailable = true;
    }
  }

  if (!isAvailable) {
    throw new Error(`Domain ${fullDomain} is not available for registration`);
  }

  // Step 2: Register domain via OpenSRS (non-fatal — domain record is still created)
  const { regUsername, regPassword } = generateRegCredentials(storeId || "standalone", userId);
  let orderId: string | null = null;
  let registrarStatus = "pending";
  let registrationError: string | null = null;
  const registrantContact = await getRegistrantContactForUser(userId, contact);

  if (isOpenSrsAvailable()) {
    try {
      const regResult = await registerDomain({
        domain: fullDomain,
        period: 1,
        regUsername,
        regPassword,
        nameservers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
        contact: registrantContact,
        whoisPrivacy: true,
      });
      orderId = regResult.orderId;
      registrarStatus = "active";
    } catch (error) {
      // The record is still created, because a retry needs something to find.
      // What changes is that this no longer leaves through the success channel.
      console.error("OpenSRS registration failed (record kept for retry):", error);
      registrarStatus = "registration_failed";
      registrationError = error instanceof Error ? error.message : String(error);
    }
  } else {
    console.warn("OpenSRS not configured — skipping domain registration, creating DNS + DB record only");
    registrarStatus = "pending_registration";
  }

  // Step 3: Create Cloudflare zone
  let cloudflareZoneId: string | null = null;
  let cfNameservers: string[] = ["ns1.cloudflare.com", "ns2.cloudflare.com"];
  let dnsRecordIds: string[] = [];

  try {
    const zone = await createZone(fullDomain);
    if (zone) {
      cloudflareZoneId = zone.zoneId;
      cfNameservers = zone.nameservers;

      // Step 4: Configure DNS records
      try {
        const recordIds = await configureStoreDns(zone.zoneId, fullDomain);
        if (recordIds) {
          dnsRecordIds = recordIds;
        }
      } catch (dnsError) {
        console.error("DNS configuration failed (zone created, DNS pending):", dnsError);
      }

      // Step 4b: Configure SSL and security settings
      try {
        await configureZoneSecurity(zone.zoneId);
      } catch (secError) {
        console.error("Zone security configuration failed (non-fatal):", secError);
      }

      // Step 4c: Auto-update nameservers at OpenSRS to match Cloudflare
      if (isOpenSrsAvailable() && registrarStatus === "active") {
        try {
          await setNameservers(fullDomain, cfNameservers);
          console.log(`[Domain] Nameservers auto-updated at OpenSRS for ${fullDomain}`);
        } catch (nsError) {
          console.error("Nameserver update at OpenSRS failed (non-fatal):", nsError);
        }
      }
    }
  } catch (cfError) {
    console.error("Cloudflare zone creation failed (domain registered, CF pending):", cfError);
  }

  // Step 5: Determine pricing
  const pricing = DOMAIN_PRICING[tld] ?? { costCents: 0, retailCents: 0 };

  // Check if this is the first domain for the store (if store exists)
  let isFirstDomain = false;
  if (storeId) {
    const existingDomains = await prisma.storeDomain.count({
      where: { storeId },
    });
    isFirstDomain = existingDomains === 0;
  }

  // Step 6: Save StoreDomain record
  const storeDomain = await prisma.storeDomain.create({
    data: {
      storeId: storeId ?? null,
      userId,
      domainName: fullDomain,
      tld,
      registrarOrderId: orderId,
      registrarStatus,
      cloudflareZoneId,
      sslStatus: cloudflareZoneId ? "pending" : "pending",
      isFree,
      purchasePriceCents: isFree ? 0 : pricing.retailCents,
      renewalPriceCents: isFree ? 0 : pricing.retailCents,
      costCents: pricing.costCents,
      whoisPrivacy: true,
      autoRenew: true,
      nameservers: JSON.stringify(cfNameservers),
      dnsRecords: JSON.stringify(dnsRecordIds),
      verificationStatus: "verified",
      verifiedAt: new Date(),
      isPrimary: isFirstDomain,
      isConnected: false,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });

  // Step 7: Update store if linked — set customDomain if first, set freeDomainClaimed if free
  if (storeId) {
    const storeUpdate: Record<string, unknown> = {};
    if (isFirstDomain) {
      storeUpdate.customDomain = fullDomain;
    }
    if (isFree) {
      storeUpdate.freeDomainClaimed = true;
    }
    if (Object.keys(storeUpdate).length > 0) {
      try {
        await prisma.store.update({
          where: { id: storeId },
          data: storeUpdate,
        });
      } catch (error) {
        console.error("Failed to update store after domain purchase:", error);
      }
    }
  }

  // The outcome, not the row. A caller that wants to say "registered" now has
  // to look at what the registrar actually did.
  if (registrarStatus === "active") {
    return { status: "registered", domain: storeDomain };
  }
  if (registrarStatus === "registration_failed") {
    return {
      status: "registration_failed",
      domain: storeDomain,
      error: registrationError ?? "The registrar rejected this registration.",
    };
  }
  return { status: "pending_registration", domain: storeDomain };
}

/**
 * Connect a user's existing domain (BYOD — Bring Your Own Domain).
 *
 * 1. Create Cloudflare zone (returns required nameservers)
 * 2. Configure DNS records
 * 3. Save StoreDomain record with isConnected: true
 * 4. Return domain ID, nameservers, and instructions for the user
 */
export async function connectExistingDomain(
  params: ConnectDomainParams
): Promise<ConnectDomainResult> {
  const { storeId, userId, domain } = params;
  const verificationToken = createDomainVerificationToken();
  const verificationRecord = getDomainVerificationRecord(domain, verificationToken);

  // Extract TLD from domain
  const parts = domain.split(".");
  const tld = parts.length > 1 ? parts.slice(1).join(".") : "com";

  // Step 1: Create Cloudflare zone
  let cloudflareZoneId: string | null = null;
  let nameservers: string[] = [];
  let dnsRecordIds: string[] = [];

  try {
    const zone = await createZone(domain);
    if (zone) {
      cloudflareZoneId = zone.zoneId;
      nameservers = zone.nameservers;

      // Step 2: Configure DNS records
      try {
        const recordIds = await configureStoreDns(zone.zoneId, domain);
        if (recordIds) {
          dnsRecordIds = recordIds;
        }
      } catch (dnsError) {
        console.error("DNS configuration failed for BYOD domain:", dnsError);
      }

      // Configure SSL and security settings
      try {
        await configureZoneSecurity(zone.zoneId);
      } catch (secError) {
        console.error("Zone security configuration failed for BYOD (non-fatal):", secError);
      }
    } else {
      throw new Error("Cloudflare zone creation returned null");
    }
  } catch (error) {
    console.error("Cloudflare setup failed for BYOD domain:", error);
    throw new Error(
      `Failed to set up DNS for ${domain}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Step 3: Save StoreDomain record
  const storeDomain = await prisma.storeDomain.create({
    data: {
      storeId: storeId ?? null,
      userId,
      domainName: domain,
      tld,
      registrarOrderId: null,
      registrarStatus: "external",
      cloudflareZoneId,
      sslStatus: "pending",
      isFree: false,
      purchasePriceCents: 0,
      renewalPriceCents: 0,
      costCents: 0,
      whoisPrivacy: false,
      autoRenew: false,
      nameservers: JSON.stringify(nameservers),
      dnsRecords: JSON.stringify(dnsRecordIds),
      verificationToken,
      verificationStatus: "pending",
      verifiedAt: null,
      lastVerificationCheckAt: null,
      verificationError: null,
      isPrimary: false,
      isConnected: true,
      expiresAt: null,
    },
  });

  // Step 4: Build instructions
  const instructions = [
    `To connect ${domain} to FlowSmartly, prove ownership by adding this TXT record at your current DNS provider:`,
    "",
    `  Type: ${verificationRecord.type}`,
    `  Name: ${verificationRecord.name}`,
    `  Value: ${verificationRecord.value}`,
    "",
    "Then update your domain's nameservers at your current registrar if you want FlowSmartly to manage DNS automatically:",
    "",
    ...nameservers.map((ns, i) => `  Nameserver ${i + 1}: ${ns}`),
    "",
    "Steps:",
    "1. Log in to the DNS provider that currently manages this domain",
    "2. Add the TXT record shown above",
    "3. Click Verify in FlowSmartly",
    "4. If you want FlowSmartly-managed DNS, replace the existing nameservers with the ones listed above",
    "",
    "Note: DNS propagation can take a few minutes, and nameserver changes can take up to 24-48 hours. FlowSmartly will not route traffic for this domain until ownership is verified.",
  ].join("\n");

  return {
    domainId: storeDomain.id,
    nameservers,
    verification: {
      status: "pending",
      record: verificationRecord,
    },
    instructions,
  };
}

/**
 * Get the current status of a domain including Cloudflare zone and SSL status.
 */
export async function getDomainStatus(
  domainId: string
): Promise<DomainStatusResult> {
  const storeDomain = await prisma.storeDomain.findUnique({
    where: { id: domainId },
  });

  if (!storeDomain) {
    throw new Error(`Domain not found: ${domainId}`);
  }

  let cloudflareStatus: string | null = null;
  let sslStatus = storeDomain.sslStatus;
  let nameservers: string[] = [];
  let verificationToken = storeDomain.verificationToken;
  let verificationStatus = getEffectiveVerificationStatus({
    isConnected: storeDomain.isConnected,
    verificationStatus: storeDomain.verificationStatus,
    verifiedAt: storeDomain.verifiedAt,
  });

  try {
    nameservers = JSON.parse(storeDomain.nameservers);
  } catch {
    nameservers = [];
  }

  if (storeDomain.isConnected && !verificationToken) {
    verificationToken = createDomainVerificationToken();
    verificationStatus = "pending";
    try {
      await prisma.storeDomain.update({
        where: { id: domainId },
        data: {
          verificationToken,
          verificationStatus: "pending",
          verificationError: null,
        },
      });
    } catch (error) {
      console.error("Failed to create domain verification token:", error);
    }
  }

  // Check Cloudflare zone status if we have a zone ID
  if (storeDomain.cloudflareZoneId) {
    try {
      const zone = await getZone(storeDomain.cloudflareZoneId);
      if (zone) {
        cloudflareStatus = zone.status; // "active", "pending", "initializing", etc.
        nameservers = zone.name_servers;
      }
    } catch (error) {
      console.error("Failed to fetch Cloudflare zone status:", error);
    }

    // Check SSL status
    try {
      const sslVerifications = await getSslStatus(storeDomain.cloudflareZoneId);
      if (sslVerifications && sslVerifications.length > 0) {
        // Use the root domain's certificate status
        const rootSsl = sslVerifications.find(
          (v) => v.hostname === storeDomain.domainName
        );
        const certStatus = rootSsl?.certificate_status ?? sslVerifications[0].certificate_status;
        sslStatus = certStatus; // "active_certificate", "pending_validation", etc.

        // Update DB if SSL status changed
        if (certStatus !== storeDomain.sslStatus) {
          try {
            await prisma.storeDomain.update({
              where: { id: domainId },
              data: { sslStatus: certStatus },
            });
          } catch (updateError) {
            console.error("Failed to update SSL status in DB:", updateError);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch SSL status:", error);
    }
  }

  return {
    id: storeDomain.id,
    domainName: storeDomain.domainName,
    registrarStatus: storeDomain.registrarStatus,
    cloudflareStatus,
    sslStatus,
    nameservers,
    isPrimary: storeDomain.isPrimary,
    isConnected: storeDomain.isConnected,
    expiresAt: storeDomain.expiresAt,
    verification: storeDomain.isConnected
      ? {
          status: verificationStatus,
          token: verificationToken,
          record: verificationToken
            ? getDomainVerificationRecord(storeDomain.domainName, verificationToken)
            : null,
          verifiedAt: storeDomain.verifiedAt,
          lastCheckedAt: storeDomain.lastVerificationCheckAt,
          error: storeDomain.verificationError,
        }
      : null,
    registrantVerification: {
      status: storeDomain.registrarVerificationStatus,
      deadline: storeDomain.registrarVerificationDeadline,
      daysToSuspend: storeDomain.registrarVerificationDaysToSuspend,
      emailBounced: storeDomain.registrarVerificationEmailBounced,
      lastCheckedAt: storeDomain.registrarVerificationLastCheckedAt,
      lastSentAt: storeDomain.registrarVerificationLastSentAt,
      error: storeDomain.registrarVerificationError,
      actionRequired: ["pending", "verifying", "suspended", "admin_reviewing"].includes(
        storeDomain.registrarVerificationStatus || ""
      ),
    },
  };
}

/**
 * Disconnect and remove a domain from a store.
 *
 * 1. Delete the Cloudflare zone if one exists
 * 2. Delete the StoreDomain record
 * 3. If this was the primary domain, clear store.customDomain
 */
export async function disconnectDomain(domainId: string): Promise<void> {
  const storeDomain = await prisma.storeDomain.findUnique({
    where: { id: domainId },
  });

  if (!storeDomain) {
    throw new Error(`Domain not found: ${domainId}`);
  }

  // Step 1: Delete Cloudflare zone
  if (storeDomain.cloudflareZoneId) {
    try {
      const deleted = await deleteZone(storeDomain.cloudflareZoneId);
      if (!deleted) {
        console.error(
          `Failed to delete Cloudflare zone ${storeDomain.cloudflareZoneId} for domain ${storeDomain.domainName}`
        );
      }
    } catch (error) {
      console.error("Cloudflare zone deletion failed:", error);
      // Continue with DB cleanup even if Cloudflare fails
    }
  }

  const wasPrimary = storeDomain.isPrimary;
  const storeId = storeDomain.storeId;

  // Step 2: Delete the StoreDomain record
  await prisma.storeDomain.delete({
    where: { id: domainId },
  });

  // Step 3: If was primary domain and linked to a store, update store
  if (wasPrimary && storeId) {
    try {
      // Check if there's another domain to promote
      const nextDomain = await prisma.storeDomain.findFirst({
        where: { storeId },
        orderBy: { createdAt: "asc" },
      });

      if (nextDomain) {
        // Promote the next domain to primary
        await prisma.$transaction([
          prisma.storeDomain.update({
            where: { id: nextDomain.id },
            data: { isPrimary: true },
          }),
          prisma.store.update({
            where: { id: storeId },
            data: { customDomain: nextDomain.domainName },
          }),
        ]);
      } else {
        // No more domains, clear store.customDomain
        await prisma.store.update({
          where: { id: storeId },
          data: { customDomain: null },
        });
      }
    } catch (error) {
      console.error("Failed to update store after domain disconnection:", error);
    }
  }
}

/**
 * Set a domain as the primary domain for its store.
 *
 * Unsets isPrimary on all other domains for the same store, then sets the
 * target domain as primary and updates store.customDomain.
 */
export async function setPrimaryDomain(domainId: string): Promise<void> {
  const storeDomain = await prisma.storeDomain.findUnique({
    where: { id: domainId },
  });

  if (!storeDomain) {
    throw new Error(`Domain not found: ${domainId}`);
  }

  if (storeDomain.isPrimary) {
    return; // Already primary, nothing to do
  }

  if (!isDomainVerified({
    isConnected: storeDomain.isConnected,
    verificationStatus: storeDomain.verificationStatus,
    verifiedAt: storeDomain.verifiedAt,
  })) {
    throw new Error(`Verify ${storeDomain.domainName} before setting it as primary`);
  }

  try {
    const txOps = [
      // Unset isPrimary on all domains for this user
      prisma.storeDomain.updateMany({
        where: { userId: storeDomain.userId },
        data: { isPrimary: false },
      }),
      // Set the target domain as primary
      prisma.storeDomain.update({
        where: { id: domainId },
        data: { isPrimary: true },
      }),
    ];

    // Update store's customDomain if domain is linked to a store
    if (storeDomain.storeId) {
      txOps.push(
        prisma.store.update({
          where: { id: storeDomain.storeId },
          data: { customDomain: storeDomain.domainName },
        }) as any
      );
    }

    await prisma.$transaction(txOps);
  } catch (error) {
    console.error("Failed to set primary domain:", error);
    throw new Error(
      `Failed to set ${storeDomain.domainName} as primary: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
