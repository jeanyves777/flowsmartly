import { prisma } from "@/lib/db/client";
import { addDays, startOfDay, endOfDay } from "date-fns";
import {
  resolveCalendarSourceDate,
  type CalendarSourceType,
} from "@/lib/content/calendar-sources";

interface OffsetSpec {
  days: number;
  time: string;
}

interface RecurringConfig {
  frequency?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: number; // 0-6 for WEEKLY, 1-31 for MONTHLY
  time?: string;     // "HH:mm"
  firstRunDate?: string | null;
}

function safePlatforms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export interface CampaignAutomationOccurrence {
  id: string; // composite key: automationId:occurrenceKey
  automationId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  itemName: string;
  reviewStatus: string;
  triggerType: string;
  scheduledAt: string; // ISO
  platforms: string[];
  topic: string | null;
  mediaMode: string;
}

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

/**
 * Read-only enumeration of upcoming ContentAutomation occurrences for the
 * given user inside a date range, used to render the schedule calendar.
 *
 * Only includes automations whose parent campaign is ACTIVE and that are
 * APPROVED and enabled. Does NOT create Posts or write logs — pure preview.
 *
 * Handles CALENDAR_EVENT (resolves source date + applies offsets),
 * ONE_OFF (startDate), and RECURRING (DAILY / WEEKLY / MONTHLY).
 *
 * Past occurrences (before today) are excluded — they've already fired
 * (real Posts in the posts table) or were missed, so showing them as
 * "upcoming" misleads the user. We clamp the effective floor to today.
 */
export async function enumerateCampaignAutomationOccurrences(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CampaignAutomationOccurrence[]> {
  // Clamp the lower bound to today so past dates in the visible calendar
  // grid don't get filled with virtual "scheduled" tiles for recurring
  // automations that may have already fired or been skipped.
  const now = new Date();
  const todayFloor = startOfDay(now);
  const effectiveStart = rangeStart > todayFloor ? rangeStart : todayFloor;
  if (effectiveStart > rangeEnd) {
    // Entire range is in the past — nothing to emit.
    return [];
  }
  const automations = await prisma.contentAutomation.findMany({
    where: {
      userId,
      enabled: true,
      reviewStatus: "APPROVED",
      status: { notIn: ["CANCELED", "COMPLETED", "FAILED"] },
      campaign: { status: "ACTIVE" },
    },
    include: {
      campaign: { select: { id: true, name: true, status: true } },
    },
  });

  const out: CampaignAutomationOccurrence[] = [];

  for (const a of automations) {
    const platforms = safePlatforms(a.platforms);
    const base = {
      automationId: a.id,
      campaignId: a.campaign.id,
      campaignName: a.campaign.name,
      campaignStatus: a.campaign.status,
      itemName: a.name,
      reviewStatus: a.reviewStatus,
      triggerType: a.triggerType,
      platforms,
      topic: a.topic,
      mediaMode: a.mediaMode,
    };

    if (a.triggerType === "CALENDAR_EVENT") {
      if (!a.calendarSourceType || !a.calendarSourceId) continue;
      const src = await resolveCalendarSourceDate(
        userId,
        a.calendarSourceType as CalendarSourceType,
        a.calendarSourceId,
      );
      if (!src || !src.valid) continue;

      const offsets = parseJson<OffsetSpec[]>(a.calendarOffsets, []);
      if (!offsets.length) continue;

      for (const off of offsets) {
        const occurrenceAt = applyTime(
          addDays(src.date, off.days),
          off.time,
        );
        if (occurrenceAt < effectiveStart || occurrenceAt > rangeEnd) continue;

        const occurrenceKey = `${a.calendarSourceType}-${a.calendarSourceId}:offset-${off.days}`;
        out.push({
          ...base,
          id: `${a.id}:${occurrenceKey}`,
          scheduledAt: occurrenceAt.toISOString(),
        });
      }
      continue;
    }

    if (a.triggerType === "ONE_OFF") {
      if (!a.startDate) continue;
      if (a.startDate < effectiveStart || a.startDate > rangeEnd) continue;
      out.push({
        ...base,
        id: `${a.id}:one-off`,
        scheduledAt: a.startDate.toISOString(),
      });
      continue;
    }

    if (a.triggerType === "RECURRING" || a.triggerType === "AI_GENERATED") {
      // AI_GENERATED is legacy — historically used as a recurring "AI picks
      // when" placeholder. Treat it the same as RECURRING here so the user
      // sees something on the calendar instead of nothing.
      const cfg = parseJson<RecurringConfig>(a.triggerConfig, {});
      const time = cfg.time ?? "09:00";
      const freq = cfg.frequency ?? "ONCE";

      const startCursor = startOfDay(effectiveStart);
      const endCursor = endOfDay(rangeEnd);

      if (freq === "ONCE") {
        const ref = cfg.firstRunDate ? new Date(cfg.firstRunDate) : null;
        if (ref) {
          const at = applyTime(ref, time);
          if (at >= effectiveStart && at <= rangeEnd) {
            out.push({
              ...base,
              id: `${a.id}:once-${at.toISOString().slice(0, 10)}`,
              scheduledAt: at.toISOString(),
            });
          }
        }
      } else if (freq === "DAILY") {
        // One occurrence per day in range at the configured time.
        for (let cur = new Date(startCursor); cur <= endCursor; cur = addDays(cur, 1)) {
          const at = applyTime(cur, time);
          if (at < effectiveStart || at > rangeEnd) continue;
          out.push({
            ...base,
            id: `${a.id}:daily-${at.toISOString().slice(0, 10)}`,
            scheduledAt: at.toISOString(),
          });
        }
      } else if (freq === "WEEKLY") {
        const targetDow = cfg.dayOfWeek ?? 1;
        for (let cur = new Date(startCursor); cur <= endCursor; cur = addDays(cur, 1)) {
          if (cur.getDay() !== targetDow) continue;
          const at = applyTime(cur, time);
          if (at < effectiveStart || at > rangeEnd) continue;
          out.push({
            ...base,
            id: `${a.id}:weekly-${at.toISOString().slice(0, 10)}`,
            scheduledAt: at.toISOString(),
          });
        }
      } else if (freq === "MONTHLY") {
        const targetDay = cfg.dayOfWeek ?? 1; // dayOfWeek is repurposed as day-of-month
        // Iterate months covered by the range — usually 1 or 2.
        const cursor = new Date(startCursor);
        while (cursor <= endCursor) {
          const d = new Date(cursor.getFullYear(), cursor.getMonth(), targetDay);
          const at = applyTime(d, time);
          if (at >= effectiveStart && at <= rangeEnd) {
            out.push({
              ...base,
              id: `${a.id}:monthly-${at.toISOString().slice(0, 10)}`,
              scheduledAt: at.toISOString(),
            });
          }
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
      continue;
    }
  }

  out.sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
  return out;
}
