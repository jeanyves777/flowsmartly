import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCalendarSources } from "@/lib/content/calendar-sources";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const monthsAhead = Number(
    request.nextUrl.searchParams.get("monthsAhead") ?? "12",
  );
  const includeHolidays =
    request.nextUrl.searchParams.get("includeHolidays") !== "false";
  const includeEvents =
    request.nextUrl.searchParams.get("includeEvents") !== "false";
  const includeScheduledPosts =
    request.nextUrl.searchParams.get("includeScheduledPosts") !== "false";

  const sources = await listCalendarSources(session.userId, {
    monthsAhead: Number.isFinite(monthsAhead) ? monthsAhead : 12,
    includeHolidays,
    includeEvents,
    includeScheduledPosts,
  });

  return NextResponse.json({ success: true, data: { sources } });
}
