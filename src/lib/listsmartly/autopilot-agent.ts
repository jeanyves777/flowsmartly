import { prisma } from "@/lib/db/client";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";

const WORKABLE_STATUSES = ["missing", "unverified", "needs_update"];
const DAILY_AUTOPILOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
    return "Autopilot will create or claim this listing and pause only if the directory requires email, SMS, phone, payment, or CAPTCHA verification.";
  }
  if (status === "needs_update") {
    return "Autopilot will update the listing with the approved business profile and pause only if the directory requires user validation.";
  }
  return "Autopilot will verify the public listing state through the directory workflow, then create, claim, or pause if user validation is required.";
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
      mode: listing.directory.apiAvailable ? "api_or_web_workflow" : "web_workflow",
      policy:
        "Use official APIs when available, otherwise use public directory pages, submit/claim URLs, and low-rate web research. Do not bypass login protections, CAPTCHAs, email/SMS/phone verification, rate limits, payment requirements, or directory terms.",
      pacing: "One account or listing workflow per day with verification checkpoints.",
    },
    steps: [
      "Research the directory requirements and public business listing state.",
      "Use the submit, claim, or public directory workflow.",
      "Create or claim the account using the approved business contact when allowed.",
      "Pause for email, SMS, or phone verification when required.",
      "Save the account details and verification status in ListSmartly.",
      "Validate the public listing URL after approval.",
    ],
  };
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

export async function getAutopilotState(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
  });
  if (!profile) return null;

  const [
    tasks,
    credentials,
    statusCounts,
    taskStatusCounts,
    savedAccounts,
    activeTask,
    lastStartedTask,
  ] = await Promise.all([
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
      take: 120,
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
    prisma.listSmartlyAutopilotTask.groupBy({
      by: ["status"],
      where: { profileId: profile.id },
      _count: { status: true },
    }),
    prisma.listSmartlyAccountCredential.count({
      where: { profileId: profile.id },
    }),
    prisma.listSmartlyAutopilotTask.findFirst({
      where: { profileId: profile.id, status: { in: ["in_progress", "needs_user"] } },
      orderBy: { updatedAt: "desc" },
      include: {
        listing: {
          include: {
            directory: {
              select: { name: true, url: true, tier: true, slug: true },
            },
          },
        },
      },
    }),
    prisma.listSmartlyAutopilotTask.findFirst({
      where: { profileId: profile.id, startedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, title: true },
    }),
  ]);

  const taskCounts = taskStatusCounts.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count.status;
    return acc;
  }, {});

  const now = new Date();
  const nextRunAt = lastStartedTask?.startedAt
    ? addMs(lastStartedTask.startedAt, DAILY_AUTOPILOT_INTERVAL_MS)
    : null;
  const dailyLimitActive = Boolean(nextRunAt && nextRunAt > now);
  const queuedCount = taskCounts.queued || 0;
  const activeTaskSummary = activeTask
    ? {
        id: activeTask.id,
        title: activeTask.title,
        status: activeTask.status,
        directory: activeTask.listing?.directory || null,
        updatedAt: activeTask.updatedAt,
      }
    : null;

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
    },
    runtime: {
      queueReady: queuedCount > 0 || Boolean(activeTask),
      canPrepareQueue: queuedCount === 0 && !activeTask,
      canRun: queuedCount > 0 && !activeTask && !dailyLimitActive,
      activeTask: activeTaskSummary,
      lastStartedAt: lastStartedTask?.startedAt || null,
      nextRunAt,
      message: activeTask
        ? `${activeTask.title} is already running. Status refreshes automatically.`
        : dailyLimitActive && nextRunAt
          ? `Daily limit reached. Next autopilot run is available ${nextRunAt.toISOString()}.`
          : queuedCount > 0
            ? "Queue is ready. Autopilot runs one listing workflow per day."
            : "No prepared listing workflow is waiting.",
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
    if (existing) {
      await prisma.listSmartlyAutopilotTask.update({
        where: { id: existing.id },
        data: {
          assignedTo: "agent",
          requiredAction: requiredActionForStatus(listing.status),
          payload: safeJson(buildDirectoryPayload(profile, listing)),
        },
      });
      continue;
    }

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
        assignedTo: "agent",
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

  return {
    created,
    considered: listings.length,
    status: created > 0 ? "prepared" : "ready",
    message:
      created > 0
        ? `${created} listing workflow${created === 1 ? "" : "s"} prepared.`
        : "Agent queue is already ready.",
  };
}

export async function runNextAutopilotStep(userId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const activeTask = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, status: { in: ["in_progress", "needs_user"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (activeTask) {
    return {
      status: "already_running",
      message: `${activeTask.title} is already running. Autopilot will not start another workflow at the same time.`,
      task: activeTask,
    };
  }

  const lastStartedTask = await prisma.listSmartlyAutopilotTask.findFirst({
    where: { profileId: profile.id, startedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    select: { id: true, title: true, startedAt: true },
  });
  if (lastStartedTask?.startedAt) {
    const nextRunAt = addMs(lastStartedTask.startedAt, DAILY_AUTOPILOT_INTERVAL_MS);
    if (nextRunAt > new Date()) {
      return {
        status: "daily_limit",
        message: `Autopilot is limited to one account or listing workflow per day. Next run is available ${nextRunAt.toISOString()}.`,
        task: null,
        nextRunAt,
      };
    }
  }

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

  if (!task) {
    return { status: "empty", message: "No prepared listing workflow is waiting.", task: null };
  }

  const updated = await prisma.listSmartlyAutopilotTask.update({
    where: { id: task.id },
    data: {
      status: "in_progress",
      assignedTo: "agent",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      startedAt: task.startedAt || new Date(),
      requiredAction:
        "Autopilot is running a compliant directory web workflow. It will pause only if email, SMS, phone, CAPTCHA, payment, or owner approval is required.",
    },
  });

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "ListSmartly autopilot started",
    message: `${task.title} started. The agent will run one listing workflow today and pause only if user validation is required.`,
    actionUrl: "/listsmartly/dashboard",
    data: { feature: "listsmartly", taskId: task.id },
  });

  return {
    status: "started",
    message: `${task.title} started. Autopilot runs one listing workflow per day.`,
    task: updated,
    nextRunAt: addMs(new Date(), DAILY_AUTOPILOT_INTERVAL_MS),
  };
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
