import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { generateFilmCharacterPreview } from "@/lib/video-director/cast";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

export const maxDuration = 300;

/**
 * POST — generate a character's portrait + turnaround sheet. Charges
 * AI_VISUAL_DESIGN, but only if the preview actually succeeds (a failed gen
 * costs the user nothing). Optional body { baseImageUrl } uses an uploaded/
 * library image as the portrait and derives the sheet from it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, characterId } = await params;
  const body = await request.json().catch(() => ({}));
  const baseImageUrl = typeof body?.baseImageUrl === "string" && body.baseImageUrl.trim() ? body.baseImageUrl.trim() : null;
  // Optional wardrobe applied atomically with the (re)generate (empty string clears it → auto from description).
  const wardrobe = typeof body?.wardrobe === "string" ? body.wardrobe.slice(0, 600) : undefined;

  const cost = await getDynamicCreditCost("AI_VISUAL_DESIGN");
  const balance = await creditService.getBalance(session.userId);
  if (balance < cost) {
    return NextResponse.json(
      { success: false, error: { code: "insufficient_credits", message: `This character preview needs ${cost} credits — you have ${balance}.` } },
      { status: 402 },
    );
  }

  const film = await generateFilmCharacterPreview(id, session.userId, characterId, { baseImageUrl, wardrobe });
  if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  // Charge only when the preview came back ready — a failed gen is free.
  const character = (film.characters || []).find((c) => c.id === characterId);
  if (character?.previewStatus === "ready") {
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: cost,
      description: "Film character preview",
      referenceType: "Design",
      referenceId: id,
    }).catch(() => {});
  } else if (character?.previewStatus === "failed") {
    return NextResponse.json(
      { success: false, error: { message: character.previewError || "The character preview couldn't be generated — please try again." } },
      { status: 502 },
    );
  }

  const data = await presignAllUrls({ film });
  return NextResponse.json({ success: true, data });
}
