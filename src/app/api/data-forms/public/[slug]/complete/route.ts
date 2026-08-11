import { NextResponse } from "next/server";

// /api/data-forms/public/[slug]/complete — DISABLED (fail closed).
//
// GET returned a contact's stored email, phone, birthday, address, city, state
// and photo — plus values merged in from other contacts who happened to share a
// first name — to anyone holding a contact reference obtained from the public
// name lookup.
//
// POST wrote to that same record without authentication: it filled fields
// (including values belonging to those same-first-name strangers), marked
// supplied email and phone addresses as email and SMS opt-ins, created a
// submission, incremented the response count, and enrolled a caller-supplied
// device fingerprint as a returning-device credential.
//
// None of that had any proof that the caller was the person concerned. Both
// halves are closed: no PII is read, no contact is written, no consent flag is
// set, no fingerprint is enrolled, and no submission is created here.
//
// Respondents submit through POST /api/data-forms/public/[slug] instead, which
// records what they typed as a form submission and touches no contact. The
// owner turns those submissions into contacts from the back office, where the
// request is authenticated and reviewed.

const CLOSED = {
  success: false,
  error: {
    message: "Prefilling your details is no longer available. Please enter them below.",
  },
} as const;

export async function GET() {
  return NextResponse.json(CLOSED, { status: 410 });
}

export async function POST() {
  return NextResponse.json(CLOSED, { status: 410 });
}
