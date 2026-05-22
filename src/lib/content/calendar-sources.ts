import { addMonths, startOfDay, isAfter, isBefore } from "date-fns";
import { prisma } from "@/lib/db/client";
import {
  getUpcomingHolidays,
  getHolidayById,
  getHolidayDate,
} from "@/lib/marketing/holidays";

export type CalendarSourceType = "EVENT" | "SCHEDULED_POST" | "HOLIDAY";

export interface CalendarSource {
  type: CalendarSourceType;
  id: string;
  label: string;
  date: string; // ISO
  meta?: {
    venue?: string;
    description?: string;
    icon?: string;
    platforms?: string[];
    status?: string;
  };
}

interface ListOptions {
  monthsAhead?: number;
  includeHolidays?: boolean;
  includeEvents?: boolean;
  includeScheduledPosts?: boolean;
}

/**
 * Return a unified, chronologically-sorted list of calendar entries the user
 * can target as a ContentAutomation source.
 */
export async function listCalendarSources(
  userId: string,
  opts: ListOptions = {},
): Promise<CalendarSource[]> {
  const monthsAhead = opts.monthsAhead ?? 12;
  const today = startOfDay(new Date());
  const cutoff = addMonths(today, monthsAhead);

  const results: CalendarSource[] = [];

  if (opts.includeHolidays !== false) {
    const days = Math.ceil((cutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const holidays = getUpcomingHolidays(days);
    for (const h of holidays) {
      results.push({
        type: "HOLIDAY",
        id: h.id,
        label: h.name,
        date: h.date.toISOString(),
        meta: { icon: h.icon, description: h.promptHint },
      });
    }
  }

  if (opts.includeEvents !== false) {
    const events = await prisma.event.findMany({
      where: {
        userId,
        eventDate: { gte: today, lte: cutoff },
        status: { notIn: ["CANCELLED"] },
      },
      orderBy: { eventDate: "asc" },
      select: {
        id: true,
        title: true,
        eventDate: true,
        venueName: true,
        description: true,
        status: true,
      },
    });
    for (const e of events) {
      results.push({
        type: "EVENT",
        id: e.id,
        label: e.title,
        date: e.eventDate.toISOString(),
        meta: {
          venue: e.venueName ?? undefined,
          description: e.description ?? undefined,
          status: e.status,
        },
      });
    }
  }

  if (opts.includeScheduledPosts !== false) {
    const posts = await prisma.post.findMany({
      where: {
        userId,
        status: "SCHEDULED",
        scheduledAt: { gte: today, lte: cutoff },
        deletedAt: null,
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        caption: true,
        scheduledAt: true,
        platforms: true,
      },
      take: 200,
    });
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      let platforms: string[] = [];
      try {
        platforms = JSON.parse(p.platforms || "[]");
      } catch {
        platforms = [];
      }
      results.push({
        type: "SCHEDULED_POST",
        id: p.id,
        label: (p.caption ?? "Scheduled post").slice(0, 80),
        date: p.scheduledAt.toISOString(),
        meta: { platforms },
      });
    }
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

/**
 * Resolve a single calendar source by type + id to its current date (or null
 * when the source no longer exists / has been cancelled). Used by the
 * scheduler at trigger time.
 */
export async function resolveCalendarSourceDate(
  userId: string,
  type: CalendarSourceType,
  sourceId: string,
): Promise<{ date: Date; label: string; valid: boolean } | null> {
  if (type === "HOLIDAY") {
    const h = getHolidayById(sourceId);
    if (!h) return null;
    // Pick the next occurrence (this year or next)
    const now = new Date();
    const year = now.getFullYear();
    for (const y of [year, year + 1]) {
      const { month, day } = getHolidayDate(h, y);
      const d = new Date(y, month - 1, day);
      if (isAfter(d, now) || isBefore(now, d)) {
        return { date: d, label: h.name, valid: true };
      }
    }
    return null;
  }
  if (type === "EVENT") {
    const e = await prisma.event.findFirst({
      where: { id: sourceId, userId },
      select: { id: true, title: true, eventDate: true, status: true },
    });
    if (!e) return null;
    const valid = e.status !== "CANCELLED";
    return { date: e.eventDate, label: e.title, valid };
  }
  if (type === "SCHEDULED_POST") {
    const p = await prisma.post.findFirst({
      where: { id: sourceId, userId, deletedAt: null },
      select: { id: true, caption: true, scheduledAt: true, status: true },
    });
    if (!p || !p.scheduledAt) return null;
    const valid = p.status === "SCHEDULED";
    return {
      date: p.scheduledAt,
      label: (p.caption ?? "Scheduled post").slice(0, 80),
      valid,
    };
  }
  return null;
}
