import { NextRequest, NextResponse } from "next/server";
import { safeCorsHeaders } from "@/lib/store/cors";

const corsHeaders = safeCorsHeaders;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ success: true }, { headers: corsHeaders(request) });
  res.cookies.set("sc_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 0,
  });
  return res;
}
