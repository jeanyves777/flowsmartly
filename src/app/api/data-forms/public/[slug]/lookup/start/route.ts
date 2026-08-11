import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  CODE_TTL_MS,
  generateCode,
  hashCode,
} from "@/lib/data-forms/challenge";
import { enforceRate, loadPublicSmartForm } from "@/lib/data-forms/public-route";
import { RATE_RULES } from "@/lib/data-forms/rate-limit";
import { exactNameClauses, parseRespondentName } from "@/lib/data-forms/respondent-name";
import { sendEmail } from "@/lib/email/core";

// POST /api/data-forms/public/[slug]/lookup/start
//
// Step one of two. The caller supplies the name AND the email address already
// on record. If both match a contact in this form's list, a one-time code is
// sent to that stored address — never to an address the caller supplied for
// delivery. Nothing is disclosed here.
//
// The response is IDENTICAL whether or not anything matched. This endpoint is
// not an oracle for "is this person on this list": a caller who guesses a name
// learns nothing, and a caller who guesses a name and an address still only
// causes an email to a mailbox they must then control.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const rateLimited = await enforceRate(request.headers, RATE_RULES.challengeStart, slug);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const parsed = parseRespondentName(body?.fullName);

    // Uniform answer for every outcome below. Do not vary it.
    const uniform = NextResponse.json({
      success: true,
      data: {
        message:
          "If those details match a record, we have sent a code to the email address we have on file.",
      },
    });

    // Malformed input is rejected explicitly — including over-long names, which
    // are never silently truncated, because truncating changes the identity
    // being matched.
    if (!parsed.ok) {
      const message =
        parsed.reason === "too_many_words"
          ? "That name is too long. Please enter your name as it was registered."
          : parsed.reason === "too_long"
            ? "That name is too long."
            : "Please enter your full name.";
      return NextResponse.json({ success: false, error: { message } }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: { message: "Please enter a valid email address." } },
        { status: 400 }
      );
    }

    const form = await loadPublicSmartForm(slug);
    if (!form) return uniform;

    // Name AND stored email must both match, inside this form's own list.
    const where: any = {
      userId: form.userId,
      status: "ACTIVE",
      lists: { some: { contactListId: form.contactListId } },
      email: { equals: email, mode: "insensitive" },
      OR: exactNameClauses(parsed.tokens),
    };

    const contact = await prisma.contact.findFirst({
      where,
      select: { id: true, email: true, firstName: true },
    });

    if (!contact?.email) return uniform;

    // Retire any code still outstanding for this contact, so only the newest
    // one can be used and a caller cannot accumulate guesses across codes.
    await prisma.dataFormChallenge.updateMany({
      where: { formId: form.id, contactId: contact.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateCode();
    await prisma.dataFormChallenge.create({
      data: {
        formId: form.id,
        contactId: contact.id,
        channel: "email",
        codeHash: hashCode(form.id, contact.id, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    const greeting = contact.firstName ? `Hi ${contact.firstName},` : "Hi,";
    await sendEmail({
      to: contact.email,
      subject: `Your code is ${code}`,
      html: `<p>${greeting}</p><p>Your one-time code is <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.</p><p>It expires in 10 minutes. If you did not ask for it, you can ignore this email — nothing has changed.</p>`,
      text: `${greeting}\n\nYour one-time code is ${code}. It expires in 10 minutes.\n\nIf you did not ask for it, you can ignore this email — nothing has changed.`,
    });

    return uniform;
  } catch (error) {
    console.error("Respondent challenge start error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Could not send a code. Please try again." } },
      { status: 500 }
    );
  }
}
