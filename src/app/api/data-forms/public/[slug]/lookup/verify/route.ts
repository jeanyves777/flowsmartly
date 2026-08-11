import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { checkChallenge, MAX_CODE_ATTEMPTS } from "@/lib/data-forms/challenge";
import { enforceRate, loadPublicSmartForm } from "@/lib/data-forms/public-route";
import { RATE_RULES } from "@/lib/data-forms/rate-limit";
import { exactNameClauses, parseRespondentName } from "@/lib/data-forms/respondent-name";
import {
  mintSessionToken,
  SESSION_PURPOSE_PREFILL,
  SESSION_TTL_MS,
} from "@/lib/data-forms/respondent-session";

// POST /api/data-forms/public/[slug]/lookup/verify
//
// Step two. The code proves the caller controls the mailbox we already held for
// this contact, which is the first point in the flow where anything is proven.
// Only then is a bearer issued — opaque, purpose-bound, revocable, and returned
// in the response body rather than a URL.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const rateLimited = await enforceRate(request.headers, RATE_RULES.challengeVerify, slug);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const parsed = parseRespondentName(body?.fullName);

    // One message for every failure, so the response never separates "no such
    // person" from "wrong code".
    const rejected = NextResponse.json(
      {
        success: false,
        error: { message: "That code is not valid or has expired. Please request a new one." },
      },
      { status: 401 }
    );

    if (!parsed.ok || !email || !/^\d{6}$/.test(code)) return rejected;

    const form = await loadPublicSmartForm(slug);
    if (!form) return rejected;

    const where: any = {
      userId: form.userId,
      status: "ACTIVE",
      lists: { some: { contactListId: form.contactListId } },
      email: { equals: email, mode: "insensitive" },
      OR: exactNameClauses(parsed.tokens),
    };

    const contact = await prisma.contact.findFirst({ where, select: { id: true } });
    if (!contact) return rejected;

    const challenge = await prisma.dataFormChallenge.findFirst({
      where: { formId: form.id, contactId: contact.id, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) return rejected;

    // Count the guess before judging it, so a burst of parallel guesses is
    // recorded even if they are all evaluated against the same loaded row.
    const attempted = await prisma.dataFormChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });

    const verdict = checkChallenge(
      {
        id: challenge.id,
        formId: challenge.formId,
        contactId: challenge.contactId,
        codeHash: challenge.codeHash,
        // Judge against the post-increment count so the Nth parallel guess
        // cannot slip in under the cap.
        attempts: attempted.attempts - 1,
        expiresAt: challenge.expiresAt,
        consumedAt: challenge.consumedAt,
      },
      code
    );

    if (!verdict.ok) {
      if (attempted.attempts >= MAX_CODE_ATTEMPTS) {
        // Burn it rather than leave a partially-guessed code alive.
        await prisma.dataFormChallenge.update({
          where: { id: challenge.id },
          data: { consumedAt: new Date() },
        });
      }
      return rejected;
    }

    // Single-use: whoever wins this update owns the code.
    const claimed = await prisma.dataFormChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) return rejected;

    const { token, tokenHash } = mintSessionToken();
    await prisma.dataFormRespondentSession.create({
      data: {
        tokenHash,
        formId: form.id,
        contactId: contact.id,
        purpose: SESSION_PURPOSE_PREFILL,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    return NextResponse.json({
      success: true,
      data: { token, expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000) },
    });
  } catch (error) {
    console.error("Respondent challenge verify error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Could not verify that code. Please try again." } },
      { status: 500 }
    );
  }
}
