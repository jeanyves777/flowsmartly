import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  enforceRate,
  loadPublicSmartForm,
  resolveRespondentSession,
} from "@/lib/data-forms/public-route";
import { RATE_RULES } from "@/lib/data-forms/rate-limit";
import { SESSION_PURPOSE_PREFILL } from "@/lib/data-forms/respondent-session";
import { SMART_COLLECT_FIELDS } from "@/types/data-form";

// POST /api/data-forms/public/[slug]/prefill/apply
//
// The single mutation a verified respondent may make: fill in the fields we do
// not already hold, on their own record.
//
// Three things it deliberately does NOT do:
//
//   - It sets no opt-in flags. Proving control of a mailbox is not consent to
//     be marketed to, and a phone number typed into a form is not verified at
//     all. Consent has to be captured on a surface that asks for it; it must
//     never be inferred from someone correcting their address.
//   - It enrols no device credential. The old flow accepted any caller-supplied
//     string as a returning-device fingerprint, which turned one lookup into
//     renewable access. Device recognition stays off until it can be issued by
//     the server and revoked.
//   - It merges nothing from other contacts. Only what this respondent typed.
//
// It is one-time: the session is claimed atomically, so a replayed request is
// acknowledged but changes nothing.

const BIRTHDAY_PATTERN = /^\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const rateLimited = await enforceRate(request.headers, RATE_RULES.session, slug);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => null);
    const submitted =
      body && typeof body.data === "object" && body.data !== null
        ? (body.data as Record<string, unknown>)
        : null;

    if (!submitted) {
      return NextResponse.json(
        { success: false, error: { message: "No details were supplied." } },
        { status: 400 }
      );
    }

    const form = await loadPublicSmartForm(slug);
    if (!form) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    const resolved = await resolveRespondentSession(
      request.headers,
      body,
      form.id,
      SESSION_PURPOSE_PREFILL,
      false // a consumed session may not mutate again
    );

    if (!resolved.ok) {
      // A replay of an already-applied session is not an error — the caller's
      // intent is already satisfied.
      if (resolved.reason === "consumed") {
        return NextResponse.json({
          success: true,
          data: { updated: 0, alreadyApplied: true },
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: { message: "Your verification has expired. Please request a new code." },
        },
        { status: 401 }
      );
    }

    // Claim the session before writing anything. Whoever wins this update owns
    // the one permitted mutation; a concurrent duplicate loses and no-ops.
    const claimed = await prisma.dataFormRespondentSession.updateMany({
      where: { id: resolved.session.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({
        success: true,
        data: { updated: 0, alreadyApplied: true },
      });
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: resolved.session.contactId,
        userId: form.userId,
        status: "ACTIVE",
        lists: { some: { contactListId: form.contactListId } },
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        phone: true,
        birthday: true,
        imageUrl: true,
        lastName: true,
        address: true,
        city: true,
        state: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    const updateData: Record<string, string> = {};

    for (const field of SMART_COLLECT_FIELDS) {
      const key = field.key;

      // Never overwrite something we already hold — this flow fills gaps.
      const current = contact[key as keyof typeof contact];
      if (current && String(current).trim()) continue;

      const raw = submitted[key];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) continue;

      if (key === "birthday") {
        if (!BIRTHDAY_PATTERN.test(value)) continue;
        const [mm, dd] = value.split("-").map(Number);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
      }
      if (key === "email" && !EMAIL_PATTERN.test(value)) continue;

      updateData[key] = value;
    }

    // email and phone are unique per owner; drop rather than crash on a clash.
    if (updateData.email) {
      const clash = await prisma.contact.findFirst({
        where: { userId: form.userId, email: updateData.email, id: { not: contact.id } },
        select: { id: true },
      });
      if (clash) delete updateData.email;
    }
    if (updateData.phone) {
      const clash = await prisma.contact.findFirst({
        where: { userId: form.userId, phone: updateData.phone, id: { not: contact.id } },
        select: { id: true },
      });
      if (clash) delete updateData.phone;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.contact.update({ where: { id: contact.id }, data: updateData });
    }

    await prisma.dataFormSubmission.create({
      data: {
        formId: form.id,
        data: JSON.stringify(updateData),
        respondentName: contact.firstName || null,
        respondentEmail: updateData.email || contact.email || null,
        respondentPhone: updateData.phone || contact.phone || null,
      },
    });

    await prisma.dataForm.update({
      where: { id: form.id },
      data: { responseCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: { updated: Object.keys(updateData).length, alreadyApplied: false },
    });
  } catch (error) {
    console.error("Respondent prefill apply error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Could not save your details." } },
      { status: 500 }
    );
  }
}
