import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { checkLookupRate, clientIp, recordLookupMiss } from "@/lib/data-forms/rate-limit";
import { issueRespondentToken } from "@/lib/data-forms/respondent-token";

// GET /api/data-forms/public/[slug]/search?q=<full name>
//
// Unauthenticated: the only thing the caller holds is the form slug, which is
// meant to be shared publicly. So this endpoint is deliberately narrow.
//   - it looks only inside the contact list this form is bound to, and returns
//     nothing at all when the form is bound to no list;
//   - it matches the WHOLE name exactly, never a prefix, so the caller cannot
//     walk the alphabet and harvest the list;
//   - it returns a short-lived form-bound token and the name the caller already
//     typed — no contact id, no birthday, no other stored field;
//   - it is rate limited, with a tighter ceiling on misses than on hits.

/** Cap the token count so a pathological query cannot fan out the OR clause. */
const MAX_NAME_TOKENS = 5;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const raw = request.nextUrl.searchParams.get("q") || "";
    const tokens = raw.trim().split(/\s+/).filter(Boolean).slice(0, MAX_NAME_TOKENS);
    const fullName = tokens.join(" ");

    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        status: true,
        contactListId: true,
        userId: true,
      },
    });

    if (!form || form.status !== "ACTIVE" || !['SMART_COLLECT','ATTENDANCE'].includes(form.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found or not configured" } },
        { status: 404 }
      );
    }

    const rate = checkLookupRate(clientIp(request), form.id);
    if (rate.limited) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Too many attempts. Please wait a moment and try again." },
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    // Fail closed: a form with no linked list has no audience to look in. We do
    // NOT fall back to the owner's whole contact book.
    if (!form.contactListId) {
      return NextResponse.json({ success: true, data: [] });
    }

    if (fullName.length < 3) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Exact, case-insensitive, whole-name match. Names are stored split across
    // firstName/lastName inconsistently, so try every split of what was typed:
    // the whole string as a first name with no last name on record, plus each
    // "first words | remaining words" division.
    // The `any`-typed where mirrors the submissions route so `mode` type-checks
    // against the local SQLite client while staying correct in production.
    const nameMatches: any[] = [
      {
        firstName: { equals: fullName, mode: "insensitive" },
        OR: [{ lastName: null }, { lastName: "" }],
      },
    ];
    for (let i = 1; i < tokens.length; i++) {
      nameMatches.push({
        firstName: { equals: tokens.slice(0, i).join(" "), mode: "insensitive" },
        lastName: { equals: tokens.slice(i).join(" "), mode: "insensitive" },
      });
    }

    const where: any = {
      userId: form.userId,
      status: "ACTIVE",
      // Scoped to this form's own list — not the owner's contact book.
      lists: { some: { contactListId: form.contactListId } },
      OR: nameMatches,
    };

    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true, firstName: true, lastName: true },
      take: 5,
    });

    if (contacts.length === 0) {
      recordLookupMiss(clientIp(request), form.id);
      return NextResponse.json({ success: true, data: [] });
    }

    // The caller had to type the exact full name to get here, so echoing the
    // matched name back discloses nothing they did not already supply.
    const results = contacts.map((c) => ({
      token: issueRespondentToken(form.id, c.id),
      displayName: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || fullName,
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Smart collect search error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Search failed" } },
      { status: 500 }
    );
  }
}
