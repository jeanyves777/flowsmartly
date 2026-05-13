import { prisma } from "@/lib/db/client";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";

const LIVE_STATUSES = ["live", "submitted", "claimed"];
const WORKABLE_STATUSES = ["missing", "unverified", "needs_update"];

type AutopilotAction =
  | "prepare_queue"
  | "run_next"
  | "complete_task"
  | "block_task"
  | "request_validation"
  | "save_credential";

type SaveCredentialInput = {
  listingId?: string;
  directoryName?: string;
  loginUrl?: string;
  accountEmail?: string;
  username?: string;
  recoveryEmail?: string;
  passwordHint?: string;
  secureNotes?: string;
  verificationStatus?: string;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value || {});
}

function taskPriority(status: string, tier: number): number {
  const statusWeight: Record<string, number> = {
    missing: 0,
    needs_update: 10,
    unverified: 20,
  };
  return (statusWeight[status] ?? 30) + tier;
}

function taskTypeForStatus(status: string): string {
  if (status === "missing") return "create_or_claim_listing";
  if (status === "needs_update") return "fix_inconsistency";
  return "verify_presence";
}

function taskTitle(status: string, directoryName: string): string {
  if (status === "missing") return `Create or claim ${directoryName}`;
  if (status === "needs_update") return `Fix ${directoryName} listing`;
  return `Verify ${directoryName}`;
}

function requiredActionForStatus(status: string): string {
  if (status === "missing") {
    return "Create or claim the business listing, complete email/phone verification if prompted, then save the account details here.";
  }
  if (status === "needs_update") {
    return "Update the listing with the approved business profile, then mark it complete after the directory accepts the change.";
  }
  return "Confirm whether the listing exists. If it exists, save the live URL; if it does not, move it into the create/claim queue.";
}

function buildDirectoryPayload(profile: {
  businessName: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  description: string | null;
}, listing: {
  id: string;
  status: string;
  directory: {
    name: string;
    url: string;
    submitUrl: string | null;
    claimUrl: string | null;
    tier: number;
    apiAvailable: boolean;
  };
}) {
  const businessProfile = {
    name: profile.businessName,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    country: profile.country || "US",
    description: profile.description,
  };

  return {
    businessProfile,
    directory: {
      name: listing.directory.name,
      url: listing.directory.url,
      submitUrl: listing.directory.submitUrl,
      claimUrl: listing.directory.claimUrl,
      tier: listing.directory.tier,
      apiAvailable: listing.directory.apiAvailable,
    },
    safety: {
      mode: listing.directory.apiAvailable ? "official_api_or_assisted" : "assisted_manual_handoff",
      policy:
        "Use official APIs or a human-assisted browser handoff. Do not bypass rate limits, CAPTCHAs, email verification, phone verification, or directory terms.",
      pacing: "One directory at a time with verification checkpoints.",
    },
    steps: [
      "Review directory requirements and business data.",
      "Open the official submit or claim URL.",
      "Create or claim the account using the approved business contact.",
      "Pause for email, SMS, or phone verification when required.",
      "Save the account details and verification status in ListSmartly.",
      "Validate the public listing URL after approval.",
    ],
  };
}

export async function getAutopilotState(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
  });
  if (!profile) return null;

  const [tasks, credentials, statusCounts] = await Promise.all([
    prisma.listSmartlyAutopilotTask.findMany({
      where: { profileId: profile.id },
      include: {
        listing: {
          include: {
            directory: {
              select: { name: true, url: true, tier: true, slug: true },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
      take: 80,
    }),
    prisma.listSmartlyAccountCredential.findMany({
      where: { profileId: profile.id },
      include: {
        listing: {
          include: { directory: { select: { slug: true, name: true, url: true, tier: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    prisma.businessListing.groupBy({
      by: ["status"],
      where: { profileId: profile.id },
      _count: { status: true },
    }),
  ]);

  const taskCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

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
      savedAccounts: credentials.length,
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      listingId: task.listingId,
      type: task.type,
      status: task.status,
      priority: task.priority,
      title: task.title,
      description: task.description,
      requiredAction: task.requiredAction,
      assignedTo: task.assignedTo,
      payload: JSON.parse(task.payload || "{}"),
      result: JSON.parse(task.result || "{}"),
      failureReason: task.failureReason,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      dueAt: task.dueAt,
      directory: task.listing?.directory || null,
      listingStatus: task.listing?.status || null,
      listingUrl: task.listing?.listingUrl || null,
    })),
    credentials: credentials.map((credential) => ({
      id: credential.id,
      listingId: credential.listingId,
      directoryName: credential.directoryName,
      directory: credential.listing?.directory || null,
      loginUrl: credential.loginUrl,
      accountEmail: credential.accountEmail,
      username: credential.username,
      recoveryEmail: credential.recoveryEmail,
      passwordHint: credential.passwordHint,
      secureNotes: credential.secureNotes,
      status: credential.status,
      verificationStatus: credential.verificationStatus,
      lastVerifiedAt: credential.lastVerifiedAt,
      updatedAt: credential.updatedAt,
    })),
  };
}

export async function updateAutopilotSettings(
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

export async function prepareAutopilotQueue(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const listings = await prisma.businessListing.findMany({
    where: {
      profileId: profile.id,
      status: { in: WORKABLE_STATUSES },
    },
    include: {
      directory: {
        select: {
          name: true,
          url: true,
          submitUrl: true,
          claimUrl: true,
          tier: true,
          apiAvailable: true,
        },
      },
    },
    orderBy: [{ directory: { tier: "asc" } }, { updatedAt: "desc" }],
  });

  let created = 0;
  for (const listing of listings) {
    const type = taskTypeForStatus(listing.status);
    const existing = await prisma.listSmartlyAutopilotTask.findFirst({
      where: {
        profileId: profile.id,
        listingId: listing.id,
        type,
        status: { in: ["queued", "in_progress", "needs_user", "blocked"] },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.listSmartlyAutopilotTask.create({
      data: {
        profileId: profile.id,
        listingId: listing.id,
        type,
        status: "queued",
        priority: taskPriority(listing.status, listing.directory.tier),
        title: taskTitle(listing.status, listing.directory.name),
        description: `${listing.directory.name} is ${listing.status.replace("_", " ")} and needs a controlled listing workflow.`,
        requiredAction: requiredActionForStatus(listing.status),
        assignedTo: listing.directory.apiAvailable ? "agent" : "user",
        payload: safeJson(buildDirectoryPayload(profile, listing)),
      },
    });
    created++;
  }

  await prisma.listSmartlyProfile.update({
    where: { id: profile.id },
    data: {
      listSmartlyAutopilotEnabled: true,
      listSmartlyAutopilotLastRunAt: new Date(),
    },
  });

  if (created > 0) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "ListSmartly autopilot queue prepared",
      message: `${created} listing workflow${created === 1 ? "" : "s"} are ready for guided action.`,
      actionUrl: "/listsmartly/dashboard",
      data: { feature: "listsmartly", created },
    });
  }

  return { created, considered: listings.length };
}

export async function runNextAutopilotStep(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, status: "queued" },
    include: {
      listing: {
        include: {
          directory: {
            select: { name: true, url: true, submitUrl: true, claimUrl: true, apiAvailable: true },
          },
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (!task) return { task: null };

  const loginUrl = task.listing?.directory.submitUrl || task.listing?.directory.claimUrl || task.listing?.directory.url || null;

  if (task.listing) {
    await prisma.listSmartlyAccountCredential.upsert({
      where: { listingId: task.listing.id },
      update: {
        directoryName: task.listing.directory.name,
        loginUrl,
        accountEmail: profile.email || null,
        username: profile.email || null,
      },
      create: {
        profileId: profile.id,
        listingId: task.listing.id,
        directoryName: task.listing.directory.name,
        loginUrl,
        accountEmail: profile.email || null,
        username: profile.email || null,
        verificationStatus: "pending",
        createdBy: "agent",
      },
    });
  }

  const updated = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: task.listing?.directory.apiAvailable ? "in_progress" : "needs_user",
      assignedTo: task.listing?.directory.apiAvailable ? "agent" : "user",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      startedAt: task.startedAt || new Date(),
      requiredAction:
        task.listing?.directory.apiAvailable
          ? "Use the official integration if available; otherwise continue with the guided handoff."
          : requiredActionForStatus(task.listing?.status || "missing"),
    },
  });

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "ListSmartly action needs review",
    message: `${task.title} is ready. Complete any email or phone verification in the guided workflow.`,
    actionUrl: "/listsmartly/dashboard",
    data: { feature: "listsmartly", taskId: task.id },
  });

  return { task: updated };
}

export async function completeAutopilotTask(userId: string, taskId: string, result: Record<string, unknown> = {}) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const task = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { id: taskId, profileId: profile.id },
    include: { listing: true },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  if (task.listingId && result.listingUrl) {
    await prisma.businessListing.update({
      where: { id: task.listingId },
      data: {
        status: "submitted",
        listingUrl: String(result.listingUrl),
        submittedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  }

  return prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "completed",
      result: safeJson(result),
      completedAt: new Date(),
    },
  });
}

export async function blockAutopilotTask(userId: string, taskId: string, reason: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  return prisma.listSmartlyAutopilotTask.updateMany({
    where: { id: taskId, profileId: profile.id },
    data: {
      status: "blocked",
      assignedTo: "user",
      failureReason: reason || "Manual intervention required",
      requiredAction: reason || "Manual intervention required",
    },
  });
}

export async function requestAutopilotValidation(userId: string, taskId: string, reason: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const message = reason || "Manual verification is required before this listing can continue.";

  const result = await prisma.listSmartlyAutopilotTask.updateMany({
    where: { id: taskId, profileId: profile.id },
    data: {
      status: "needs_user",
      assignedTo: "user",
      requiredAction: message,
      failureReason: null,
    },
  });

  if (result.count > 0) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "ListSmartly verification needed",
      message,
      actionUrl: "/listsmartly/dashboard",
      data: { feature: "listsmartly", taskId },
    });
  }

  return result;
}

export async function saveAutopilotCredential(userId: string, input: SaveCredentialInput) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const listing = input.listingId
    ? await prisma.businessListing.findFirst({
        where: { id: input.listingId, profileId: profile.id },
        include: { directory: { select: { name: true, url: true } } },
      })
    : null;

  if (input.listingId && !listing) throw new Error("LISTING_NOT_FOUND");

  const directoryName = input.directoryName || listing?.directory.name;
  if (!directoryName) throw new Error("DIRECTORY_REQUIRED");

  const credential = input.listingId
    ? await prisma.listSmartlyAccountCredential.upsert({
        where: { listingId: input.listingId },
        update: {
          directoryName,
          loginUrl: input.loginUrl || listing?.directory.url || null,
          accountEmail: input.accountEmail || null,
          username: input.username || null,
          recoveryEmail: input.recoveryEmail || null,
          passwordHint: input.passwordHint || null,
          secureNotes: input.secureNotes || null,
          verificationStatus: input.verificationStatus || "pending",
          lastVerifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
        },
        create: {
          profileId: profile.id,
          listingId: input.listingId,
          directoryName,
          loginUrl: input.loginUrl || listing?.directory.url || null,
          accountEmail: input.accountEmail || null,
          username: input.username || null,
          recoveryEmail: input.recoveryEmail || null,
          passwordHint: input.passwordHint || null,
          secureNotes: input.secureNotes || null,
          verificationStatus: input.verificationStatus || "pending",
          lastVerifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
          createdBy: "user",
        },
      })
    : await prisma.listSmartlyAccountCredential.create({
        data: {
          profileId: profile.id,
          directoryName,
          loginUrl: input.loginUrl || null,
          accountEmail: input.accountEmail || null,
          username: input.username || null,
          recoveryEmail: input.recoveryEmail || null,
          passwordHint: input.passwordHint || null,
          secureNotes: input.secureNotes || null,
          verificationStatus: input.verificationStatus || "pending",
          lastVerifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
          createdBy: "user",
        },
      });

  if (input.listingId && input.verificationStatus === "verified") {
    await prisma.businessListing.update({
      where: { id: input.listingId },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  }

  return credential;
}

export async function handleAutopilotAction(userId: string, action: AutopilotAction, body: Record<string, unknown>) {
  if (action === "prepare_queue") return prepareAutopilotQueue(userId);
  if (action === "run_next") return runNextAutopilotStep(userId);
  if (action === "complete_task") return completeAutopilotTask(userId, String(body.taskId), body.result as Record<string, unknown>);
  if (action === "block_task") return blockAutopilotTask(userId, String(body.taskId), String(body.reason || ""));
  if (action === "request_validation") return requestAutopilotValidation(userId, String(body.taskId), String(body.reason || ""));
  if (action === "save_credential") return saveAutopilotCredential(userId, body.credential as SaveCredentialInput);
  throw new Error("UNKNOWN_ACTION");
}
