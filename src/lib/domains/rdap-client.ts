/**
 * RDAP (Registration Data Access Protocol) domain availability checker.
 * Free, no credentials needed. Works for all gTLDs via rdap.org bootstrap.
 *
 * - 200 response = domain is registered (taken)
 * - 404 response = domain is not registered (available)
 * - Other = unknown, treat as unavailable
 */

export interface RdapSearchResult {
  domain: string;
  tld: string;
  available: boolean;
}

/**
 * Check availability of a single domain via RDAP.
 */
async function checkDomain(domain: string, tld: string): Promise<RdapSearchResult> {
  try {
    const response = await fetch(`https://rdap.org/domain/${domain}`, {
      method: "HEAD", // HEAD is faster — we only need the status code
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    if (response.status === 404) {
      return { domain, tld, available: true };
    }

    // 200 = registered, anything else = assume unavailable
    return { domain, tld, available: false };
  } catch {
    // Network error / timeout — can't determine, assume unavailable
    return { domain, tld, available: false };
  }
}

/**
 * Search domain availability across multiple TLDs using RDAP.
 * Free alternative when OpenSRS credentials are unavailable/invalid.
 */
export async function searchDomainsRdap(
  sld: string,
  tlds: string[]
): Promise<RdapSearchResult[]> {
  const cleanSld = sld.replace(/[^a-z0-9-]/gi, "").toLowerCase();

  // Run all lookups in parallel (RDAP has no strict rate limit)
  const lookups = tlds.map((tld) => checkDomain(`${cleanSld}.${tld}`, tld));
  return Promise.all(lookups);
}
