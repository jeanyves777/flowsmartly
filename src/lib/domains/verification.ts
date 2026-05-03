import { randomBytes } from "crypto";
import { Resolver } from "dns/promises";

const DEFAULT_RESOLVERS = ["1.1.1.1", "8.8.8.8"];

export type DomainVerificationStatus = "pending" | "verified" | "failed";

export interface DomainVerificationRecord {
  type: "TXT";
  name: string;
  value: string;
}

export interface DomainVerificationResult {
  status: DomainVerificationStatus;
  record: DomainVerificationRecord;
  foundTxtRecords: string[];
  nameservers: string[];
  error?: string;
}

function resolver() {
  const r = new Resolver();
  r.setServers(
    (process.env.DOMAIN_DNS_RESOLVERS || DEFAULT_RESOLVERS.join(","))
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
  return r;
}

function cleanDnsValue(value: string) {
  return value.trim().replace(/^"|"$/g, "");
}

export function createDomainVerificationToken() {
  return `flowsmartly-domain-verification=${randomBytes(24).toString("base64url")}`;
}

export function getDomainVerificationRecord(
  domain: string,
  token: string
): DomainVerificationRecord {
  return {
    type: "TXT",
    name: `_flowsmartly.${domain}`,
    value: token,
  };
}

export async function verifyDomainOwnership(
  domain: string,
  token: string
): Promise<DomainVerificationResult> {
  const record = getDomainVerificationRecord(domain, token);
  const dns = resolver();
  let foundTxtRecords: string[] = [];
  let nameservers: string[] = [];

  try {
    const txt = await dns.resolveTxt(record.name);
    foundTxtRecords = txt.map((chunks) => cleanDnsValue(chunks.join("")));
  } catch {
    foundTxtRecords = [];
  }

  try {
    const ns = await dns.resolveNs(domain);
    nameservers = ns.map((value) => value.toLowerCase().replace(/\.$/, ""));
  } catch {
    nameservers = [];
  }

  const verified = foundTxtRecords.some(
    (value) => cleanDnsValue(value) === record.value
  );

  return {
    status: verified ? "verified" : "failed",
    record,
    foundTxtRecords,
    nameservers,
    error: verified
      ? undefined
      : `TXT record ${record.name} was not found with the expected FlowSmartly token.`,
  };
}

export function getEffectiveVerificationStatus(params: {
  isConnected: boolean;
  verificationStatus: string | null;
  verifiedAt: Date | string | null;
}): DomainVerificationStatus {
  if (!params.isConnected) return "verified";
  if (params.verifiedAt || params.verificationStatus === "verified") return "verified";
  if (params.verificationStatus === "failed") return "failed";
  return "pending";
}

export function isDomainVerified(params: {
  isConnected: boolean;
  verificationStatus: string | null;
  verifiedAt: Date | string | null;
}) {
  return getEffectiveVerificationStatus(params) === "verified";
}
