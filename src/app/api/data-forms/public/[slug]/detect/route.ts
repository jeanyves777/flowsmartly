import { NextResponse } from "next/server";

// POST /api/data-forms/public/[slug]/detect — DISABLED (fail closed).
//
// This endpoint identified a returning respondent from a device fingerprint
// and returned their name and photo without authentication. The fingerprint is
// a deterministic hash of coarse device attributes, not a secret, and it could
// be enrolled by an unverified caller through /complete — so possessing one
// proved nothing about who was asking.
//
// It returns no contact data and touches no database. A returning respondent
// now simply fills the form in again, which is the correct behaviour until
// device recognition is rebuilt on a server-issued, revocable credential.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: { message: "Device recognition is no longer available." },
    },
    { status: 410 }
  );
}
