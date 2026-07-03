import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, requirePermission } from "@/lib/admin/auth";
import {
  getImagePipelinePolicy,
  setImagePipelinePolicy,
  defaultImagePolicy,
  IMAGE_MODEL_CATALOG,
} from "@/lib/ai/media-policy";

/**
 * Admin Control Hub — image-generation provider pipeline.
 * GET  → the effective policy (override merged over defaults) + the code default
 *        + the model catalog + which providers have API keys configured.
 * PUT  → persist a new policy (sanitized) to the SystemSetting row; hot-swaps the
 *        live pipeline with no deploy.
 */

function providerAvailability() {
  return {
    xai: !!process.env.XAI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  };
}

export async function GET() {
  const session = await getAdminSession();
  const denied = requirePermission(session, "EDIT_SETTINGS");
  if (denied) return denied;
  const policy = await getImagePipelinePolicy();
  return NextResponse.json({
    success: true,
    data: {
      policy,
      defaults: defaultImagePolicy(),
      catalog: IMAGE_MODEL_CATALOG,
      availability: providerAvailability(),
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  const denied = requirePermission(session, "EDIT_SETTINGS");
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  const policyInput = (body && typeof body === "object" && "policy" in body ? (body as { policy: unknown }).policy : body);
  const saved = await setImagePipelinePolicy(policyInput, session?.adminId ?? null);
  return NextResponse.json({ success: true, data: { policy: saved } });
}
