import { NextResponse } from "next/server";

// GET /api/data-forms/public/[slug]/search — DISABLED (fail closed).
//
// This endpoint had no authentication of any kind. The only gate was the form
// slug, which is designed to be shared publicly, and the query was scoped to
// the form owner rather than to the form's contact list — so it returned the
// owner's entire contact book (first name, last name, birthday) on a
// two-character prefix, ten at a time, enumerable by walking the alphabet.
//
// Looking a person up by name cannot be made safe by narrowing the match: a
// name is not a credential, and anything this endpoint returns is returned to
// whoever typed the name. It stays closed until the flow is rebuilt behind a
// real proof-of-possession challenge.
//
// It returns no data, touches no database, and reveals nothing about whether
// the slug exists.
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "Looking yourself up is no longer available. Please enter your details below.",
      },
    },
    { status: 410 }
  );
}
