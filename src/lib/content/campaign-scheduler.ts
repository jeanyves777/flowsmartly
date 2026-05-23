import { prisma } from "@/lib/db/client";
import { addDays, startOfDay, addMinutes } from "date-fns";
import { resolveCalendarSourceDate, type CalendarSourceType } from "@/lib/content/calendar-sources";
import { pickNextFromFolder, resolveSpecificMedia } from "@/lib/content/media-rotation";
import { generateAutomationMedia } from "@/lib/content/automation-media-generator";

interface OffsetSpec {
  days: number;
  time: string; // "HH:mm"
}

interface RecurringConfig {
  frequency?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: number; // 0-6 for WEEKLY, 1-31 for MONTHLY
  time?: string;
  firstRunDate?: string | null;
}

interface ProcessOptions {
  now?: Date;
  limit?: number; // Max automations to process per tick
}

export interface ProcessResult {
  checked: number;
  emitted: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const DEFAULT_LIMIT = 100;
const POST_LEAD_MINUTES = 60;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function applyTime(date: Date, time: string): Date {
  const [h, m] = (time || "09:00").split(":");
  const out = new Date(date);
  out.setHours(parseInt(h || "9", 10), parseInt(m || "0", 10), 0, 0);
  return out;
}

function nextRecurringOccurrence(cfg: RecurringConfig, now: Date): Date | null {
  const time = cfg.time ?? "09:00";
  if (!cfg.frequency || cfg.frequency === "ONCE") {
    const ref = cfg.firstRunDate ? new Date(cfg.firstRunDate) : null;
    return ref ? applyTime(ref, time) : null;
  }
  if (cfg.frequency === "DAILY") {
    return applyTime(now, time);
  }
  if (cfg.frequency === "WEEKLY") {
    const dow = cfg.dayOfWeek ?? 1;
    const today = startOfDay(now);
    const todayDow = today.getDay();
    let diff = dow - todayDow;
    if (diff > 3) diff -= 7; // back-fill same-week if we're past it
    return applyTime(addDays(today, diff), time);
  }
  if (cfg.frequency === "MONTHLY") {
    const day = cfg.dayOfWeek ?? 1;
    const target = new Date(now.getFullYear(), now.getMonth(), day);
    return applyTime(target, time);
  }
  return null;
}

interface MediaResolution {
  mediaUrl: string | null;
  mediaType: string | null;
  mediaFileId: string | null;
  nextFolderIndex: number | null;
  skipReason: string | null;
}

async function resolveMedia(
  automation: {
    id: string;
    userId: string;
    mediaMode: string;
    mediaUrl: string | null;
    mediaFileId: string | null;
    mediaFolderId: string | null;
    mediaFolderLastUsedIndex: number;
    aiMediaConfig?: string | null;
  },
  occurrenceYear?: number,
): Promise<MediaResolution> {
  switch (automation.mediaMode) {
    case "UPLOAD": {
      // For CALENDAR_EVENT automations, the pre-generated image may be scoped
      // to a specific year via aiMediaConfig.appliesTo. If the current
      // occurrence's year doesn't match, fall through to text-only so the
      // user can pre-generate a fresh image for that year.
      const cfg = parseJson<{ appliesTo?: string }>(
        automation.aiMediaConfig ?? null,
        {},
      );
      if (
        cfg.appliesTo &&
        cfg.appliesTo !== "all" &&
        occurrenceYear !== undefined &&
        cfg.appliesTo !== String(occurrenceYear)
      ) {
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: null,
        };
      }
      return {
        mediaUrl: automation.mediaUrl,
        mediaType: automation.mediaUrl ? "image" : null,
        mediaFileId: null,
        nextFolderIndex: null,
        skipReason: automation.mediaUrl ? null : "no_upload_url",
      };
    }
    case "SPECIFIC_FILE": {
      if (!automation.mediaFileId) {
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: "no_media_file",
        };
      }
      const file = await resolveSpecificMedia(automation.mediaFileId);
      if (!file) {
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: "media_file_missing",
        };
      }
      return {
        mediaUrl: file.url,
        mediaType: file.mediaType,
        mediaFileId: automation.mediaFileId,
        nextFolderIndex: null,
        skipReason: null,
      };
    }
    case "FOLDER": {
      if (!automation.mediaFolderId) {
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: "no_media_folder",
        };
      }
      const result = await pickNextFromFolder(
        automation.mediaFolderId,
        automation.mediaFolderLastUsedIndex,
      );
      if (result.folderMissing) {
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: "folder_missing",
        };
      }
      if (result.emptyFolder) {
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: "folder_empty",
        };
      }
      return {
        mediaUrl: result.url,
        mediaType: result.mediaType,
        mediaFileId: result.fileId,
        nextFolderIndex: result.nextIndex,
        skipReason: null,
      };
    }
    case "AI_AT_POST_TIME": {
      // Generate a fresh AI-branded image right now using the same helper
      // the manual "Pre-generate" flow uses. Reads tier/style/aspect from
      // aiMediaConfig so the user's preferences propagate. Charges credits
      // after success; falls through to no-media on failure (post still
      // fires, just text-only) so we don't block the whole occurrence.
      const cfg = parseJson<{
        tier?: "premium" | "standard";
        style?: "realistic" | "3d";
        aspect?: "square" | "portrait" | "landscape";
        appliesTo?: string;
      }>(automation.aiMediaConfig ?? null, {});
      try {
        const gen = await generateAutomationMedia({
          userId: automation.userId,
          automationId: automation.id,
          tier: cfg.tier,
          style: cfg.style,
          aspect: cfg.aspect,
          appliesTo: cfg.appliesTo,
          occurrenceYearOverride: occurrenceYear ?? null,
          keyTag: "scheduled",
        });
        return {
          mediaUrl: gen.url,
          mediaType: "image",
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: null,
        };
      } catch (err) {
        const e = err as Error & { code?: string };
        if (e.code === "INSUFFICIENT_CREDITS") {
          return {
            mediaUrl: null,
            mediaType: null,
            mediaFileId: null,
            nextFolderIndex: null,
            skipReason: "insufficient_credits",
          };
        }
        console.warn(
          "[scheduler] AI_AT_POST_TIME generation failed; firing text-only:",
          e instanceof Error ? e.message : e,
        );
        return {
          mediaUrl: null,
          mediaType: null,
          mediaFileId: null,
          nextFolderIndex: null,
          skipReason: null,
        };
      }
    }
    case "NONE":
    default:
      return {
        mediaUrl: null,
        mediaType: null,
        mediaFileId: null,
        nextFolderIndex: null,
        skipReason: null,
      };
  }
}

/**
 * Emit a single Post for this automation occurrence, race-safe against a
 * concurrent cancel. Re-reads automation status inside the transaction and
 * aborts if CANCELED/COMPLETED.
 */
async function emitPost(params: {
  automationId: string;
  userId: string;
  occurrenceKey: string;
  scheduledAt: Date;
  caption: string;
  hashtags: string;
  platforms: string;
  mediaUrl: string | null;
  mediaType: string | null;
  aiMediaConfig: string | null;
}): Promise<{ created: boolean; postId?: string; reason?: string }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.contentAutomation.findUnique({
        where: { id: params.automationId },
        select: { status: true, enabled: true, reviewStatus: true },
      });
      if (!fresh) return { created: false as const, reason: "missing" };
      if (
        !fresh.enabled ||
        fresh.status === "CANCELED" ||
        fresh.status === "COMPLETED" ||
        fresh.reviewStatus !== "APPROVED"
      ) {
        return { created: false as const, reason: "state_changed" };
      }

      // Pre-check log dedupe (race against another scheduler tick)
      const existing = await tx.contentAutomationLog.findFirst({
        where: {
          contentAutomationId: params.automationId,
          occurrenceKey: params.occurrenceKey,
        },
        select: { id: true },
      });
      if (existing) {
        return { created: false as const, reason: "already_emitted" };
      }

      const post = await tx.post.create({
        data: {
          userId: params.userId,
          caption: params.caption,
          hashtags: params.hashtags,
          platforms: params.platforms,
          mediaUrl: params.mediaUrl,
          mediaType: params.mediaType,
          mediaMeta: params.aiMediaConfig,
          status: "SCHEDULED",
          scheduledAt: params.scheduledAt,
          contentAutomationId: params.automationId,
        },
        select: { id: true },
      });

      await tx.contentAutomationLog.create({
        data: {
          contentAutomationId: params.automationId,
          postId: post.id,
          status: "TRIGGERED",
          occurrenceKey: params.occurrenceKey,
        },
      });

      return { created: true as const, postId: post.id };
    });
    return result;
  } catch (err) {
    // Unique-constraint violation on (contentAutomationId, occurrenceKey) means
    // another tick beat us to this occurrence — treat as success-of-other-tick.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      return { created: false, reason: "already_emitted" };
    }
    throw err;
  }
}

async function logSkipped(
  automationId: string,
  occurrenceKey: string | null,
  reason: string,
) {
  try {
    await prisma.contentAutomationLog.create({
      data: {
        contentAutomationId: automationId,
        status: "SKIPPED",
        reason,
        occurrenceKey: occurrenceKey ?? null,
      },
    });
  } catch {
    // If the unique constraint fires it means a parallel TRIGGERED row exists;
    // nothing to do.
  }
}

/**
 * Main entry point — called by the scheduler tick. Walks all eligible
 * ContentAutomation rows, fires due occurrences, writes logs.
 */
export async function processDueContentAutomations(
  opts: ProcessOptions = {},
): Promise<ProcessResult> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const result: ProcessResult = {
    checked: 0,
    emitted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const automations = await prisma.contentAutomation.findMany({
    where: {
      enabled: true,
      reviewStatus: "APPROVED",
      status: { notIn: ["CANCELED", "COMPLETED", "FAILED"] },
      // Parent campaign must be ACTIVE — DRAFT / PAUSED / CANCELED /
      // COMPLETED campaigns don't emit. PAUSED is the user's manual brake.
      campaign: { status: "ACTIVE" },
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    take: limit,
    orderBy: { lastTriggered: { sort: "asc", nulls: "first" } },
  });

  for (const a of automations) {
    result.checked += 1;
    try {
      if (a.triggerType === "CALENDAR_EVENT") {
        if (!a.calendarSourceType || !a.calendarSourceId) {
          await logSkipped(a.id, null, "missing_calendar_source");
          result.skipped += 1;
          continue;
        }
        const src = await resolveCalendarSourceDate(
          a.userId,
          a.calendarSourceType as CalendarSourceType,
          a.calendarSourceId,
        );
        if (!src) {
          await logSkipped(a.id, null, "source_missing");
          result.skipped += 1;
          continue;
        }
        if (!src.valid) {
          await logSkipped(a.id, null, "source_invalid");
          result.skipped += 1;
          continue;
        }
        const offsets = parseJson<OffsetSpec[]>(a.calendarOffsets, []);
        if (!offsets.length) {
          await logSkipped(a.id, null, "no_offsets");
          result.skipped += 1;
          continue;
        }

        let emittedForThis = 0;
        let folderIndex = a.mediaFolderLastUsedIndex;
        for (const off of offsets) {
          const occurrenceAt = applyTime(addDays(src.date, off.days), off.time);
          if (occurrenceAt > now) continue; // not yet due

          const occurrenceKey = `${a.calendarSourceType}-${a.calendarSourceId}:offset-${off.days}`;

          // Already logged?
          const seen = await prisma.contentAutomationLog.findFirst({
            where: { contentAutomationId: a.id, occurrenceKey },
            select: { id: true },
          });
          if (seen) continue;

          const media = await resolveMedia(
            { ...a, mediaFolderLastUsedIndex: folderIndex },
            occurrenceAt.getFullYear(),
          );
          if (media.skipReason) {
            await logSkipped(a.id, occurrenceKey, media.skipReason);
            result.skipped += 1;
            continue;
          }

          const platforms = a.platforms || "[]";
          const caption = a.copy ?? a.topic ?? a.name;
          const scheduledAt = occurrenceAt < now
            ? addMinutes(now, POST_LEAD_MINUTES)
            : occurrenceAt;

          const emit = await emitPost({
            automationId: a.id,
            userId: a.userId,
            occurrenceKey,
            scheduledAt,
            caption,
            hashtags: a.hashtags ?? "[]",
            platforms,
            mediaUrl: media.mediaUrl,
            mediaType: media.mediaType,
            aiMediaConfig: a.aiMediaConfig,
          });

          if (emit.created) {
            emittedForThis += 1;
            result.emitted += 1;
            if (media.nextFolderIndex !== null) {
              folderIndex = media.nextFolderIndex;
            }
          } else {
            result.skipped += 1;
          }
        }

        if (emittedForThis > 0) {
          await prisma.contentAutomation.update({
            where: { id: a.id },
            data: {
              lastTriggered: now,
              totalGenerated: { increment: emittedForThis },
              mediaFolderLastUsedIndex: folderIndex,
              firstPostCreatedAt: a.firstPostCreatedAt ?? now,
            },
          });
        } else if (folderIndex !== a.mediaFolderLastUsedIndex) {
          await prisma.contentAutomation.update({
            where: { id: a.id },
            data: { mediaFolderLastUsedIndex: folderIndex },
          });
        }
      } else {
        // RECURRING | ONE_OFF | AI_GENERATED  → single occurrence per tick
        const cfg = parseJson<RecurringConfig>(a.triggerConfig, {});
        const occurrenceAt = nextRecurringOccurrence(
          {
            ...cfg,
            frequency: cfg.frequency ?? (a.triggerType === "ONE_OFF" ? "ONCE" : "WEEKLY"),
          },
          now,
        );
        if (!occurrenceAt) {
          await logSkipped(a.id, null, "no_schedule");
          result.skipped += 1;
          continue;
        }
        if (occurrenceAt > now) continue; // not yet due

        // For ONE_OFF, fire only once ever
        if (a.triggerType === "ONE_OFF" && a.lastTriggered) continue;

        // For recurring, dedupe by date-of-occurrence
        const occurrenceKey = `recurring:${occurrenceAt.toISOString().slice(0, 10)}T${occurrenceAt.toISOString().slice(11, 16)}`;
        const seen = await prisma.contentAutomationLog.findFirst({
          where: { contentAutomationId: a.id, occurrenceKey },
          select: { id: true },
        });
        if (seen) continue;

        const media = await resolveMedia(a);
        if (media.skipReason) {
          await logSkipped(a.id, occurrenceKey, media.skipReason);
          result.skipped += 1;
          continue;
        }

        const platforms = a.platforms || "[]";
        const caption = a.copy ?? a.topic ?? a.name;
        const scheduledAt = addMinutes(now, POST_LEAD_MINUTES);

        const emit = await emitPost({
          automationId: a.id,
          userId: a.userId,
          occurrenceKey,
          scheduledAt,
          caption,
          hashtags: a.hashtags ?? "[]",
          platforms,
          mediaUrl: media.mediaUrl,
          mediaType: media.mediaType,
          aiMediaConfig: a.aiMediaConfig,
        });

        if (emit.created) {
          result.emitted += 1;
          await prisma.contentAutomation.update({
            where: { id: a.id },
            data: {
              lastTriggered: now,
              totalGenerated: { increment: 1 },
              mediaFolderLastUsedIndex:
                media.nextFolderIndex ?? a.mediaFolderLastUsedIndex,
              firstPostCreatedAt: a.firstPostCreatedAt ?? now,
              status: a.triggerType === "ONE_OFF" ? "COMPLETED" : a.status,
            },
          });
        } else {
          result.skipped += 1;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed += 1;
      result.errors.push(`automation ${a.id}: ${msg}`);
      await logSkipped(a.id, null, `error: ${msg.slice(0, 120)}`);
    }
  }

  return result;
}
