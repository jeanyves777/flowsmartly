import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// Common categories the client sends today. We accept anything (lenient) up to
// 32 chars so the mobile app can add new IDs without a backend deploy.
// Reference list: "incorrect" | "not_helpful" | "too_long" | "too_short" |
// "off_topic" | "other".

const MAX_COMMENT_LEN = 500;
const MAX_SNAPSHOT_LEN = 32_000; // characters of the JSON-stringified snapshot

const bodySchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEGATIVE"]),
  messageId: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(128).nullish(),
  category: z.string().min(1).max(32).optional(),
  comment: z.string().max(MAX_COMMENT_LEN).optional(),
  // snapshot is any JSON-serializable object the client wants to attach. We
  // require an object (not a primitive) so the admin UI can rely on key/value
  // access; we re-stringify server-side to enforce the 32k char cap.
  snapshot: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "BAD_JSON", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_BODY",
            message: parsed.error.issues[0]?.message || "Invalid request body",
          },
        },
        { status: 400 }
      );
    }

    const { sentiment, messageId, conversationId, category, comment } = parsed.data;

    // Stringify snapshot for storage. We measure characters (not bytes) because
    // Postgres text fields are character-counted and the 32k spec was given in
    // chars. Reject anything bigger up front with 413.
    let snapshotJson: string;
    try {
      snapshotJson = JSON.stringify(parsed.data.snapshot ?? {});
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "BAD_SNAPSHOT", message: "Snapshot is not JSON-serializable" } },
        { status: 400 }
      );
    }
    if (snapshotJson.length > MAX_SNAPSHOT_LEN) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SNAPSHOT_TOO_LARGE",
            message: `Snapshot exceeds ${MAX_SNAPSHOT_LEN} characters`,
          },
        },
        { status: 413 }
      );
    }

    // Trim/normalize the category. The 32-char cap is already enforced by the
    // zod schema above, so we don't need a second guard here.
    const normalizedCategory = category?.trim() || null;

    const data = {
      userId: session.user.id,
      conversationId: conversationId ?? null,
      messageId,
      sentiment,
      category: normalizedCategory,
      comment: comment?.trim() || null,
      snapshot: snapshotJson,
      // If the user re-rates, reset the review state so the new sentiment shows
      // up in the admin queue again.
      reviewed: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    };

    // Idempotent on (userId, messageId): if the user re-rates the same AI turn,
    // overwrite their previous rating instead of creating a duplicate. The
    // @@unique([userId, messageId]) on the model makes upsert clean.
    const row = await prisma.aIFeedback.upsert({
      where: {
        userId_messageId: {
          userId: session.user.id,
          messageId,
        },
      },
      create: data,
      update: {
        sentiment: data.sentiment,
        category: data.category,
        comment: data.comment,
        snapshot: data.snapshot,
        conversationId: data.conversationId,
        reviewed: false,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: { id: row.id } });
  } catch (error) {
    console.error("Flow-AI feedback submit error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "Failed to submit feedback" } },
      { status: 500 }
    );
  }
}
