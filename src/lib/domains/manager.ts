/**
 * Domain Manager — orchestrates OpenSRS, Cloudflare, and Prisma for domain operations.
 */
import { prisma } from "@/lib/db/client";
import { searchDomain, registerDomain, getDomainInfo, isAvailable as isOpenSrsAvailable } from "./opensrs-client";
import { searchDomainsRdap } from "./rdap-client";
import { createZone, configureStoreDns, getZone, getSslStatus, deleteZone } from "./cloudflare-client";
import { DOMAIN_PRICING, SUPPORTED_TLDS, FREE_DOMAIN_TLDS, isFreeDomainEligible } from "./pricing";

// ── Types ──

export interface DomainSearchItem {
  domain: string;
  tld: string;
  available: boolean;
  retailCents: number;
  costCents: number;
  isFreeEligible: boolean;
}

export interface PurchaseDomainParams {
  storeId: string;
  userId: string;
  domainName: string;
  tld: string;
  isFree: boolean;
}

export interface ConnectDomainParams {
  storeId: string;
  userId: string;
  domain: string;
}

export interface ConnectDomainResult {
  domainId: string;
  nameservers: string[];
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
  return {
    regUsername: `fs-${storeId.slice(0, 8)}`,
    regPassword: `fp-${userId.slice(0, 8)}-${Date.now().toString(36)}`,
  };
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
export async function purchaseDomain(params: PurchaseDomainParams) {
  const { storeId, userId, domainName, tld, isFree } = params;
  const fullDomain = `${domainName}.${tld}`;

  // Step 1: Validate availability
  let isAvailable = false;
  try {
    const lookupResults = await searchDomain(domainName, [tld]);
    const match = lookupResults.find((r) => r.tld === tld);
    isAvailable = match?.available ?? false;
  } catch (error) {
    console.error("Domain availability check failed:", error);
    throw new Error(
      `Could not verify domain availability for ${fullDomain}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isAvailable) {
    throw new Error(`Domain ${fullDomain} is not available for registration`);
  }

  // Step 2: Register domain via OpenSRS
  const { regUsername, regPassword } = generateRegCredentials(storeId, userId);
  let orderId: string | null = null;

  try {
    const regResult = await registerDomain({
      domain: fullDomain,
      period: 1,
      regUsername,
      regPassword,
      nameservers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
      whoisPrivacy: true,
    });
    orderId = regResult.orderId;
  } catch (error) {
    console.error("Domain registration failed:", error);
    throw new Error(
      `Failed to register ${fullDomain}: ${error instanceof Error ? error.message : String(error)}`
    );
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
    }
  } catch (cfError) {
    console.error("Cloudflare zone creation failed (domain registered, CF pending):", cfError);
  }

  // Step 5: Determine pricing
  const pricing = DOMAIN_PRICING[tld] ?? { costCents: 0, retailCents: 0 };

  // Check if this is the first domain for the store
  const existingDomains = await prisma.storeDomain.count({
    where: { storeId },
  });
  const isFirstDomain = existingDomains === 0;

  // Step 6: Save StoreDomain record
  const storeDomain = await prisma.storeDomain.create({
    data: {
      storeId,
      userId,
      domainName: fullDomain,
      tld,
      registrarOrderId: orderId,
      registrarStatus: "active",
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
      isPrimary: isFirstDomain,
      isConnected: false,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });

  // Step 7: If first domain, update store's customDomain
  if (isFirstDomain) {
    try {
      await prisma.store.update({
        where: { id: storeId },
        data: {
          customDomain: fullDomain,
          ...(isFree ? { freeDomainClaimed: true } : {}),
        },
      });
    } catch (error) {
      console.error("Failed to update store customDomain:", error);
      // Non-fatal: domain is registered, just the store pointer failed
    }
  }

  return storeDomain;
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

  // Extract TLD from domain
  const parts = domain.split(".");
  const tld = parts.length > 1 ? parts.slice(1).join(".") : "com";

  // Step 1: Create Cloudflare zone
  let cloudflareZoneId: string | null = null;
  let nameservers: string[] = [];

  try {
    const zone = await createZone(domain);
    if (zone) {
      cloudflareZoneId = zone.zoneId;
      nameservers = zone.nameservers;

      // Step 2: Configure DNS records
      try {
        await configureStoreDns(zone.zoneId, domain);
      } catch (dnsError) {
        console.error("DNS configuration failed for BYOD domain:", dnsError);
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
      storeId,
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
      dnsRecords: "[]",
      isPrimary: false,
      isConnected: true,
      expiresAt: null,
    },
  });

  // Step 4: Build instructions
  const instructions = [
    `To connect ${domain} to your FlowSmartly store, update your domain's nameservers at your current registrar:`,
    "",
    ...nameservers.map((ns, i) => `  Nameserver ${i + 1}: ${ns}`),
    "",
    "Steps:",
    "1. Log in to the registrar where you purchased this domain (e.g., GoDaddy, Namecheap, Google Domains)",
    "2. Find the DNS or Nameserver settings for this domain",
    "3. Replace the existing nameservers with the ones listed above",
    "4. Save your changes",
    "",
    "Note: DNS propagation can take up to 24-48 hours. SSL will be automatically provisioned once nameservers are active.",
  ].join("\n");

  return {
    domainId: storeDomain.id,
    nameservers,
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

  try {
    nameservers = JSON.parse(storeDomain.nameservers);
  } catch {
    nameservers = [];
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

  // Step 3: If was primary domain, clear store.customDomain
  if (wasPrimary) {
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

  try {
    await prisma.$transaction([
      // Unset isPrimary on all domains for this store
      prisma.storeDomain.updateMany({
        where: { storeId: storeDomain.storeId },
        data: { isPrimary: false },
      }),
      // Set the target domain as primary
      prisma.storeDomain.update({
        where: { id: domainId },
        data: { isPrimary: true },
      }),
      // Update the store's customDomain
      prisma.store.update({
        where: { id: storeDomain.storeId },
        data: { customDomain: storeDomain.domainName },
      }),
    ]);
  } catch (error) {
    console.error("Failed to set primary domain:", error);
    throw new Error(
      `Failed to set ${storeDomain.domainName} as primary: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
