import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getNarration } from "@/lib/voice-studio/store";
import { buildExplainerComposition, buildOverlayComposition } from "@/lib/voice-studio/explainer-composition";
import { getUserBrand } from "@/lib/brand/get-brand";
import type { ExplainerGraphic } from "@/lib/voice-studio/types";

/**
 * GET — a self-contained HTML page that PLAYS one beat's animated graphic live in the browser
 * (GSAP auto-plays + loops), so the user can preview the style/motion BEFORE the expensive full
 * render. No server-side video render — just the composition HTML, loaded in an iframe.
 * [[hyperframes-oncam-graphics]]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const shotId = sp.get("shot");
  const layout = sp.get("layout") === "overlay" ? "overlay" : "split";

  const p = await getNarration(id, session.userId);
  if (!p) return new NextResponse("Not found", { status: 404 });

  const shot = (shotId && p.shots.find((s) => s.id === shotId)) || p.shots.find((s) => s.graphic) || p.shots[0];
  const graphic: ExplainerGraphic = shot?.graphic || { kind: "title", headline: p.title, caption: shot?.line || p.title };

  const brand = await getUserBrand(session.userId).catch(() => null);
  const gBrand = {
    accent: brand?.colors?.accent || brand?.colors?.primary || undefined,
    accent2: brand?.colors?.secondary || undefined,
  };
  const opts = {
    width: 1080, height: 1920,
    holdSec: Math.max(2.5, shot?.holdSec || 4),
    style: p.explainerStyle, brand: gBrand, preview: true,
  };
  const html = layout === "overlay" ? buildOverlayComposition(graphic, opts) : buildExplainerComposition(graphic, opts);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
