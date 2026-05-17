import { prisma } from "@/lib/db/client";
import { getListSmartlyDirectoryPriority } from "@/lib/constants/listsmartly";
import { reconcileListingCatalog } from "./sync-engine";

const LIVE_STATUSES = new Set(["live", "submitted", "claimed"]);
const WORKABLE_STATUSES = new Set(["missing", "unverified", "needs_update", "error"]);

const API_CANDIDATE_SLUGS = new Set([
  "google-business",
  "bing-places",
  "apple-maps",
  "facebook",
  "linkedin",
  "youtube",
]);

const PROVIDER_CANDIDATE_CATEGORIES = new Set([
  "critical",
  "major_general",
  "maps",
]);

const PROVIDER_EXCLUDED_SLUGS = new Set([
  "linkedin",
  "thumbtack",
  "bark",
  "angi",
  "expertise",
  "trustpilot",
  "reviews-io",
  "sitejabber",
  "consumeraffairs",
  "birdeye",
  "g2",
  "clutch",
  "goodfirms",
  "upcity",
  "openstreetmap",
]);

type DirectoryForOperations = {
  slug: string;
  name: string;
  url: string;
  tier: number;
  category: string;
  submitUrl: string | null;
  claimUrl: string | null;
  apiAvailable: boolean;
  isActive: boolean;
};

type ListingForOperations = {
  id: string;
  status: string;
  listingUrl: string | null;
  lastCheckedAt: Date | null;
  lastUpdatedAt: Date | null;
  isConsistent: boolean;
  inconsistencies: string;
  directory: DirectoryForOperations;
};

function providerConfigured(): boolean {
  return Boolean(
    process.env.LISTSMARTLY_PROVIDER_API_KEY ||
      process.env.SEMRUSH_LISTING_API_KEY ||
      process.env.YEXT_API_KEY ||
      process.env.BRIGHTLOCAL_API_KEY ||
      process.env.UBERALL_API_KEY
  );
}

function getRegistrationUrl(directory: DirectoryForOperations): string | null {
  return directory.claimUrl || directory.submitUrl || null;
}

function isProviderCandidate(directory: DirectoryForOperations): boolean {
  if (PROVIDER_EXCLUDED_SLUGS.has(directory.slug)) return false;
  return PROVIDER_CANDIDATE_CATEGORIES.has(directory.category);
}

function classifyListing(listing: ListingForOperations) {
  const registrationUrl = getRegistrationUrl(listing.directory);
  const providerCandidate = isProviderCandidate(listing.directory);
  const apiCandidate = API_CANDIDATE_SLUGS.has(listing.directory.slug);
  const apiReady = listing.directory.apiAvailable;
  const providerReady = providerCandidate && providerConfigured();
  const priority = getListSmartlyDirectoryPriority(listing.directory);
  const live = LIVE_STATUSES.has(listing.status);
  const needsWork = WORKABLE_STATUSES.has(listing.status);
  const needsFix = listing.status === "needs_update" || (live && !listing.isConsistent);

  if (!listing.directory.isActive) {
    return {
      bucket: "unsupported" as const,
      method: "excluded",
      priority: 9000,
      label: "Unsupported",
      message: "Not a supported listing target.",
      registrationUrl: null,
      providerCandidate,
      apiCandidate,
      apiReady,
      providerReady,
    };
  }

  if (live && !needsFix) {
    return {
      bucket: "found" as const,
      method: "monitor",
      priority,
      label: "Found",
      message: "Listing is already found and monitored.",
      registrationUrl,
      providerCandidate,
      apiCandidate,
      apiReady,
      providerReady,
    };
  }

  if ((apiReady || providerReady) && (needsWork || needsFix)) {
    return {
      bucket: "auto_ready" as const,
      method: apiReady ? "api" : "provider",
      priority,
      label: apiReady ? "API ready" : "Provider ready",
      message: apiReady ? "Can be handled by a configured API." : "Can be sent through the configured provider.",
      registrationUrl,
      providerCandidate,
      apiCandidate,
      apiReady,
      providerReady,
    };
  }

  if (registrationUrl && (needsWork || needsFix)) {
    return {
      bucket: "registration_link" as const,
      method: "external_registration",
      priority,
      label: "Registration needed",
      message: "Open the listing site, register or claim it there, then mark it submitted.",
      registrationUrl,
      providerCandidate,
      apiCandidate,
      apiReady,
      providerReady,
    };
  }

  if (providerCandidate && (needsWork || needsFix)) {
    return {
      bucket: "provider_needed" as const,
      method: "provider_needed",
      priority,
      label: "Provider needed",
      message: "This target needs a listing distribution provider before FlowSmartly can submit it at scale.",
      registrationUrl,
      providerCandidate,
      apiCandidate,
      apiReady,
      providerReady,
    };
  }

  return {
    bucket: "monitor_only" as const,
    method: "monitor_only",
    priority,
    label: "Monitor only",
    message: "FlowSmartly can scan and monitor this target, but no reliable action path is configured.",
    registrationUrl,
    providerCandidate,
    apiCandidate,
    apiReady,
    providerReady,
  };
}

async function ensureListingCatalog(profileId: string) {
  const [activeDirectoryCount, listingCount] = await Promise.all([
    prisma.listingDirectory.count({ where: { isActive: true } }),
    prisma.businessListing.count({ where: { profileId, directory: { isActive: true } } }),
  ]);

  if (activeDirectoryCount === 0 || listingCount < activeDirectoryCount) {
    await reconcileListingCatalog(profileId);
  }
}

export async function getListingOperationsState(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
    include: { user: { select: { aiCredits: true } } },
  });
  if (!profile) return null;

  await ensureListingCatalog(profile.id);

  const [listings, statusCounts, savedAccounts] = await Promise.all([
    prisma.businessListing.findMany({
      where: { profileId: profile.id, directory: { isActive: true } },
      include: {
        directory: {
          select: {
            slug: true,
            name: true,
            url: true,
            tier: true,
            category: true,
            submitUrl: true,
            claimUrl: true,
            apiAvailable: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.businessListing.groupBy({
      by: ["status"],
      where: { profileId: profile.id, directory: { isActive: true } },
      _count: { status: true },
    }),
    prisma.listSmartlyAccountCredential.count({ where: { profileId: profile.id } }),
  ]);

  const operations = listings
    .map((listing) => {
      const classification = classifyListing(listing);
      const parsedInconsistencies = (() => {
        try {
          return JSON.parse(listing.inconsistencies || "[]") as string[];
        } catch {
          return [];
        }
      })();

      return {
        listingId: listing.id,
        directory: {
          slug: listing.directory.slug,
          name: listing.directory.name,
          url: listing.directory.url,
          tier: listing.directory.tier,
          category: listing.directory.category,
        },
        status: listing.status,
        listingUrl: listing.listingUrl,
        lastCheckedAt: listing.lastCheckedAt,
        lastUpdatedAt: listing.lastUpdatedAt,
        isConsistent: listing.isConsistent,
        inconsistencies: parsedInconsistencies,
        ...classification,
      };
    })
    .sort((a, b) => {
      const bucketRank: Record<string, number> = {
        auto_ready: 0,
        registration_link: 1,
        provider_needed: 2,
        monitor_only: 3,
        found: 4,
        unsupported: 5,
      };
      return (
        (bucketRank[a.bucket] ?? 9) - (bucketRank[b.bucket] ?? 9) ||
        a.priority - b.priority ||
        a.directory.name.localeCompare(b.directory.name)
      );
    });

  const operationCounts = operations.reduce<Record<string, number>>((acc, operation) => {
    acc[operation.bucket] = (acc[operation.bucket] || 0) + 1;
    return acc;
  }, {});

  const directoryCounts = operations.reduce(
    (acc, operation) => {
      if (operation.apiReady) acc.apiReady += 1;
      if (operation.apiCandidate) acc.apiCandidates += 1;
      if (operation.registrationUrl) acc.registrationLinks += 1;
      if (operation.providerCandidate) acc.providerCandidates += 1;
      if (operation.bucket === "monitor_only") acc.monitorOnly += 1;
      return acc;
    },
    {
      totalActive: operations.length,
      apiReady: 0,
      apiCandidates: 0,
      registrationLinks: 0,
      providerCandidates: 0,
      monitorOnly: 0,
    }
  );

  const taskCounts = {
    queued: operationCounts.registration_link || 0,
    in_progress: 0,
    needs_user: operationCounts.registration_link || 0,
    blocked: operationCounts.provider_needed || 0,
    completed: operationCounts.found || 0,
  };

  return {
    settings: {
      enabled: profile.listSmartlyAutopilotEnabled,
      autoFix: profile.listSmartlyAutoFixEnabled,
      autoDescriptions: profile.listSmartlyAutoDescriptionEnabled,
      mode: profile.listSmartlyAutopilotMode,
      lastRunAt: profile.listSmartlyAutopilotLastRunAt,
    },
    stats: {
      listingStatusCounts: statusCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      taskCounts,
      savedAccounts,
      operationCounts,
      directoryCounts,
    },
    runtime: {
      queueReady: (operationCounts.registration_link || 0) > 0,
      canPrepareQueue: true,
      canRun: (operationCounts.auto_ready || 0) > 0,
      canRunExtra: false,
      extraRunCost: 0,
      creditsAvailable: profile.user?.aiCredits || 0,
      activeTask: null,
      lastStartedAt: null,
      nextRunAt: null,
      message:
        (operationCounts.auto_ready || 0) > 0
          ? "Automatic listing actions are available."
          : "No automatic listing action is configured yet. Use scan, registration links, and monitoring.",
    },
    operations: {
      counts: operationCounts,
      directoryCounts,
      items: operations.slice(0, 150),
      providerConfigured: providerConfigured(),
    },
    tasks: [],
    credentials: [],
  };
}

export async function updateListingOperationsSettings(
  userId: string,
  data: {
    enabled?: boolean;
    autoFix?: boolean;
    autoDescriptions?: boolean;
    mode?: string;
  }
) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  return prisma.listSmartlyProfile.update({
    where: { id: profile.id },
    data: {
      ...(data.enabled !== undefined ? { listSmartlyAutopilotEnabled: data.enabled } : {}),
      ...(data.autoFix !== undefined ? { listSmartlyAutoFixEnabled: data.autoFix } : {}),
      ...(data.autoDescriptions !== undefined
        ? { listSmartlyAutoDescriptionEnabled: data.autoDescriptions }
        : {}),
      ...(data.mode ? { listSmartlyAutopilotMode: data.mode } : {}),
    },
  });
}

export async function handleListingOperationsAction(
  userId: string,
  action: string,
  body: Record<string, unknown>
) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  if (action === "refresh_plan" || action === "prepare_queue") {
    await ensureListingCatalog(profile.id);
    return {
      status: "ready",
      message: "Listing plan refreshed.",
    };
  }

  if (action === "automate_available" || action === "run_next" || action === "run_extra") {
    const state = await getListingOperationsState(userId);
    const autoReady = state?.operations?.counts?.auto_ready || 0;
    return {
      status: autoReady > 0 ? "provider_required" : "empty",
      message:
        autoReady > 0
          ? "Automatic listing actions need a configured provider or directory API before execution."
          : "No automatic listing action is configured yet.",
    };
  }

  if (action === "mark_registered") {
    const listingId = String(body.listingId || "");
    const listingUrl = typeof body.listingUrl === "string" ? body.listingUrl.trim() : "";
    if (!listingId) throw new Error("LISTING_ID_REQUIRED");

    const listing = await prisma.businessListing.findFirst({
      where: {
        id: listingId,
        profileId: profile.id,
        directory: { isActive: true },
      },
      include: { directory: { select: { name: true, url: true } } },
    });
    if (!listing) throw new Error("LISTING_NOT_FOUND");

    const updated = await prisma.businessListing.update({
      where: { id: listing.id },
      data: {
        status: "submitted",
        listingUrl: listingUrl || listing.listingUrl,
        submittedAt: listing.submittedAt || new Date(),
        lastUpdatedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });

    await prisma.listingChange.create({
      data: {
        listingId: listing.id,
        changeType: "user_registration_marked",
        fieldChanged: "status",
        oldValue: listing.status,
        newValue: updated.status,
        changedBy: "user",
      },
    });

    return {
      status: "marked_registered",
      message: `${listing.directory.name} was marked as submitted. FlowSmartly will monitor it on the next scan.`,
      listingId: updated.id,
    };
  }

  throw new Error("UNKNOWN_ACTION");
}
