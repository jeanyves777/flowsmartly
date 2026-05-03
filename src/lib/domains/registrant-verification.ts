import { prisma } from "@/lib/db/client";
import {
  getRegistrantVerificationStatus,
  sendRegistrantVerificationEmail,
  isAvailable as isOpenSrsAvailable,
  type RegistrantVerificationStatus,
} from "@/lib/domains/opensrs-client";

export const REGISTRANT_VERIFICATION_ACTION_STATUSES = new Set([
  "pending",
  "verifying",
  "suspended",
  "admin_reviewing",
]);

export function parseOpenSrsDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s+(UTC|GMT))?$/i
  );
  const normalized = match
    ? `${match[1]}T${match[2]}${match[3] ? "Z" : ""}`
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOpenSrsManaged(registrarStatus: string | null, isConnected: boolean) {
  return !isConnected && registrarStatus !== "external";
}

export async function syncRegistrantVerificationStatus(domainId: string) {
  const domain = await prisma.storeDomain.findUnique({
    where: { id: domainId },
    select: {
      id: true,
      domainName: true,
      registrarStatus: true,
      isConnected: true,
    },
  });

  if (!domain) {
    throw new Error("Domain not found");
  }

  if (!isOpenSrsManaged(domain.registrarStatus, domain.isConnected)) {
    return {
      domainName: domain.domainName,
      status: "not_applicable",
      actionRequired: false,
      responseText: "External/BYOD domains do not use OpenSRS registrant email verification.",
    };
  }

  if (!isOpenSrsAvailable()) {
    throw new Error("OpenSRS API credentials are not configured");
  }

  const status = await getRegistrantVerificationStatus(domain.domainName);
  await saveRegistrantVerificationStatus(domain.id, status);
  return {
    domainName: domain.domainName,
    ...status,
    actionRequired: REGISTRANT_VERIFICATION_ACTION_STATUSES.has(status.status),
  };
}

export async function resendRegistrantVerificationEmail(domainId: string) {
  const domain = await prisma.storeDomain.findUnique({
    where: { id: domainId },
    select: {
      id: true,
      domainName: true,
      registrarStatus: true,
      isConnected: true,
    },
  });

  if (!domain) {
    throw new Error("Domain not found");
  }

  if (!isOpenSrsManaged(domain.registrarStatus, domain.isConnected)) {
    throw new Error("Registrant verification email is only available for OpenSRS-registered domains");
  }

  if (!isOpenSrsAvailable()) {
    throw new Error("OpenSRS API credentials are not configured");
  }

  const result = await sendRegistrantVerificationEmail(domain.domainName);
  const status = await getRegistrantVerificationStatus(domain.domainName).catch(() => null);

  await prisma.storeDomain.update({
    where: { id: domain.id },
    data: {
      registrarVerificationLastSentAt: new Date(),
      registrarVerificationError: null,
      ...(status ? statusToUpdateData(status) : {}),
    },
  });

  return {
    ...result,
    status: status
      ? {
          ...status,
          actionRequired: REGISTRANT_VERIFICATION_ACTION_STATUSES.has(status.status),
        }
      : null,
  };
}

export async function syncRegistrantVerificationStatuses(limit = 100) {
  if (!isOpenSrsAvailable()) {
    return {
      total: 0,
      checked: 0,
      actionRequired: 0,
      failed: 0,
      skipped: true,
      reason: "OpenSRS API credentials are not configured",
      domains: [],
    };
  }

  const domains = await prisma.storeDomain.findMany({
    where: {
      isConnected: false,
      registrarStatus: { notIn: ["external", "registration_failed", "pending_registration"] },
    },
    select: {
      id: true,
      domainName: true,
    },
    orderBy: [
      { registrarVerificationLastCheckedAt: "asc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  const synced: Array<{
    domainName: string;
    status: string;
    actionRequired: boolean;
  }> = [];
  let failed = 0;

  for (const domain of domains) {
    try {
      const status = await syncRegistrantVerificationStatus(domain.id);
      synced.push({
        domainName: domain.domainName,
        status: status.status,
        actionRequired: status.actionRequired,
      });
    } catch (error) {
      failed++;
      await prisma.storeDomain.update({
        where: { id: domain.id },
        data: {
          registrarVerificationLastCheckedAt: new Date(),
          registrarVerificationError:
            error instanceof Error ? error.message : "Failed to sync registrant verification",
        },
      });
      console.error(`[RegistrantVerification] Failed to sync ${domain.domainName}:`, error);
    }
  }

  return {
    total: domains.length,
    checked: synced.length,
    actionRequired: synced.filter((domain) => domain.actionRequired).length,
    failed,
    skipped: false,
    domains: synced,
  };
}

export async function saveRegistrantVerificationStatus(
  domainId: string,
  status: RegistrantVerificationStatus
) {
  await prisma.storeDomain.update({
    where: { id: domainId },
    data: statusToUpdateData(status),
  });
}

function statusToUpdateData(status: RegistrantVerificationStatus) {
  return {
    registrarVerificationStatus: status.status,
    registrarVerificationDeadline: parseOpenSrsDate(status.verificationDeadline),
    registrarVerificationDaysToSuspend: status.daysToSuspend,
    registrarVerificationEmailBounced: status.emailBounced,
    registrarVerificationLastCheckedAt: new Date(),
    registrarVerificationError: null,
  };
}
