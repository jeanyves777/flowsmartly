import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { AdminPermission, getAdminSession, requirePermission } from "@/lib/admin/auth";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import {
  listProposalVisualAssets,
  normalizeKind,
  normalizePreset,
  parseProposalVisualTags,
  PROPOSAL_VISUAL_TAG,
} from "@/lib/pitch/proposal-asset-library";
import { toTransparentPngCutout } from "@/lib/pitch/proposal-visuals";
import { uploadToS3 } from "@/lib/utils/s3-client";

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

async function ensureFlowSmartlyUser() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: "flowsmartly" }, { email: "system@flowsmartly.local" }],
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: "system@flowsmartly.local",
      username: "flowsmartly",
      name: "FlowSmartly",
      avatarUrl: "/icon.png",
      plan: "ENTERPRISE",
      aiCredits: 0,
      freeCredits: 0,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "proposal-visual";
}

async function saveVisualAsset(input: {
  title: string;
  source: "admin-upload" | "admin-generated";
  originalName: string;
  originalSize: number;
  buffer: Buffer;
  kind: unknown;
  preset: unknown;
  tags: string;
  prompt?: string;
}) {
  const systemUser = await ensureFlowSmartlyUser();
  const kind = normalizeKind(input.kind);
  const preset = normalizePreset(input.preset);
  const tags = Array.from(new Set([
    PROPOSAL_VISUAL_TAG,
    kind,
    preset,
    ...parseProposalVisualTags(input.tags),
  ].filter(Boolean)));
  const filename = `${slugify(input.title)}-${randomUUID().slice(0, 8)}.png`;
  const key = `proposal-visual-assets/${filename}`;
  const url = await uploadToS3(key, input.buffer, "image/png");
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(input.buffer).metadata();

  return prisma.mediaFile.create({
    data: {
      userId: systemUser.id,
      filename,
      originalName: input.originalName,
      url,
      type: "image",
      mimeType: "image/png",
      size: input.buffer.length || input.originalSize,
      width: metadata.width || undefined,
      height: metadata.height || undefined,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify({
        title: input.title,
        kind,
        preset,
        source: input.source,
        prompt: input.prompt,
        transparentCutout: true,
      }),
    },
  });
}

function buildCutoutPrompt(prompt: string) {
  return [
    prompt,
    "Create one isolated premium 3D PNG-style illustration cutout on a pure white/off-white background.",
    "Use a clean object cluster with soft contact shadows only.",
    "No full background scene, no room background, no gradient background, no border frame.",
    "No text, no words, no letters, no numbers, no captions, no logos, no brand marks, no placeholder boxes.",
    "Keep the subject fully visible and centered so the white/off-white background can be removed after generation.",
  ].join(" ");
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset");
    const kind = searchParams.get("kind");
    const search = searchParams.get("search")?.trim().toLowerCase();

    let assets = await listProposalVisualAssets({ presign: true });
    if (preset && preset !== "all") assets = assets.filter((asset) => asset.preset === preset || asset.preset === "any");
    if (kind && kind !== "all") assets = assets.filter((asset) => asset.kind === kind || asset.kind === "general");
    if (search) {
      assets = assets.filter((asset) =>
        [asset.title, asset.preset, asset.kind, ...asset.tags].join(" ").toLowerCase().includes(search),
      );
    }

    return NextResponse.json({ success: true, data: { assets } });
  } catch (error) {
    console.error("Admin proposal visual assets GET error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch proposal visuals" } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.EDIT_SETTINGS);
    if (denied) return denied;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: { message: "Image file is required" } }, { status: 400 });
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ success: false, error: { message: "Use PNG, JPG, JPEG, or WebP" } }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ success: false, error: { message: "Image is too large" } }, { status: 400 });
      }

      const original = Buffer.from(await file.arrayBuffer());
      const cutout = await toTransparentPngCutout(original);
      await saveVisualAsset({
        title: String(formData.get("title") || file.name.replace(/\.[a-z0-9]+$/i, "")),
        source: "admin-upload",
        originalName: file.name,
        originalSize: file.size,
        buffer: cutout.buffer,
        kind: formData.get("kind"),
        preset: formData.get("preset"),
        tags: String(formData.get("tags") || ""),
      });

      return NextResponse.json({ success: true, data: { assets: await listProposalVisualAssets({ presign: true }) } });
    }

    const body = await request.json();
    const action = String(body.action || "generate");
    if (action !== "generate") {
      return NextResponse.json({ success: false, error: { message: "Unsupported action" } }, { status: 400 });
    }

    const prompt = String(body.prompt || "").replace(/\s+/g, " ").trim();
    if (!prompt) {
      return NextResponse.json({ success: false, error: { message: "Prompt is required" } }, { status: 400 });
    }

    const generated = await generateImageXaiFirst(buildCutoutPrompt(prompt), 1536, 1024, {
      quality: "high",
      strictProvider: true,
      preferredProvider: "xai",
    });
    if (!generated.base64) {
      return NextResponse.json({ success: false, error: { message: "Image generation returned no image" } }, { status: 503 });
    }

    const cutout = await toTransparentPngCutout(generated.base64);
    await saveVisualAsset({
      title: String(body.title || "Generated proposal visual"),
      source: "admin-generated",
      originalName: "xai-generated-proposal-visual.png",
      originalSize: cutout.buffer.length,
      buffer: cutout.buffer,
      kind: body.kind,
      preset: body.preset,
      tags: String(body.tags || ""),
      prompt,
    });

    return NextResponse.json({ success: true, data: { assets: await listProposalVisualAssets({ presign: true }) } });
  } catch (error) {
    console.error("Admin proposal visual assets POST error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to save proposal visual" } },
      { status: 500 },
    );
  }
}
