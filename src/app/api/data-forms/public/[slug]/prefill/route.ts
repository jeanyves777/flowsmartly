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

// POST /api/data-forms/public/[slug]/prefill
//
// Returns what we already hold for the VERIFIED respondent, so they do not have
// to type it again. POST, not GET, because the bearer belongs in a body or a
// header and not in a URL that proxies and APM tooling will log.
//
// It reads exactly one contact: the one the challenge proved. There is no
// same-first-name merge. Two people who share a first name are two people, and
// a first name was never an identity boundary — the old merge both disclosed a
// stranger's email, phone and address to whoever was filling the form and wrote
// those values onto someone else's record.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const rateLimited = await enforceRate(request.headers, RATE_RULES.session, slug);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => null);

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
      SESSION_PURPOSE_PREFILL
    );
    if (!resolved.ok) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Your verification has expired. Please request a new code." },
        },
        { status: 401 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: resolved.session.contactId,
        userId: form.userId,
        status: "ACTIVE",
        lists: { some: { contactListId: form.contactListId } },
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        birthday: true,
        imageUrl: true,
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

    const knownFields: { key: string; label: string; value: string }[] = [];
    const missingFields: { key: string; label: string; type: string }[] = [];

    for (const field of SMART_COLLECT_FIELDS) {
      const raw = contact[field.key as keyof typeof contact];
      const value = raw ? String(raw).trim() : "";
      if (value) knownFields.push({ key: field.key, label: field.label, value });
      else missingFields.push({ key: field.key, label: field.label, type: field.type });
    }

    return NextResponse.json({
      success: true,
      data: {
        firstName: contact.firstName,
        knownFields,
        missingFields,
        isComplete: missingFields.length === 0,
      },
    });
  } catch (error) {
    console.error("Respondent prefill error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Could not load your details." } },
      { status: 500 }
    );
  }
}
