/**
 * RDAP (Registration Data Access Protocol) domain availability checker.
 * Free, no credentials needed. Works for all gTLDs via rdap.org bootstrap.
 *
 * - 200 response = domain is registered (taken)
 * - 404 response = domain is not registered (available)
 * - Other = unknown, treat as unavailable
 *
 * Note: rdap.org is a bootstrap service that redirects to the TLD-specific
 * RDAP server. First requests can be slow due to DNS + TLS cold start, so
 * we include retry logic and stagger parallel requests.
 */

export interface RdapSearchResult {
  domain: string;
  tld: string;
  available: boolean;
}

const MAX_RETRIES = 1;
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * Check availability of a single domain via RDAP with retry.
 */
async function checkDomain(domain: string, tld: string): Promise<RdapSearchResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`https://rdap.org/domain/${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "follow",
      });

      if (response.status === 404) {
        return { domain, tld, available: true };
      }

      // 200 = registered (taken)
      if (response.status === 200) {
        return { domain, tld, available: false };
      }

      // Other status (429, 5xx, etc.) — retry if we can
      if (attempt < MAX_RETRIES) {
        await sleep(1000);
        continue;
      }

      return { domain, tld, available: false };
    } catch {
      // Network error / timeout — retry once before giving up
      if (attempt < MAX_RETRIES) {
        await sleep(1000);
        continue;
      }
      return { domain, tld, available: false };
    }
  }

  return { domain, tld, available: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search domain availability across multiple TLDs using RDAP.
 * Free alternative when OpenSRS credentials are unavailable/invalid.
 *
 * Staggers requests in small batches to avoid cold-start timeouts when all
 * connections to rdap.org (and its redirect targets) are new.
 */
export async function searchDomainsRdap(
  sld: string,
  tlds: string[]
): Promise<RdapSearchResult[]> {
  const cleanSld = sld.replace(/[^a-z0-9-]/gi, "").toLowerCase();

  // Stagger: fire first request alone (warms rdap.org connection),
  // then fire the rest in parallel after a short delay.
  if (tlds.length <= 1) {
    return Promise.all(tlds.map((tld) => checkDomain(`${cleanSld}.${tld}`, tld)));
  }

  // First request warms the connection to rdap.org
  const firstResult = await checkDomain(`${cleanSld}.${tlds[0]}`, tlds[0]);

  // Now fire the rest in parallel — rdap.org connection is warm
  const restResults = await Promise.all(
    tlds.slice(1).map((tld) => checkDomain(`${cleanSld}.${tld}`, tld))
  );

  return [firstResult, ...restResults];
}
