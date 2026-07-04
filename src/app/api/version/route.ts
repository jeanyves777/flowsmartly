import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GET /api/version — the deployed build's commit SHA + build time. Public and
 * uncached, so a deploy is verifiable from the outside even when the change is
 * entirely behind auth (e.g. /home surfaces) and doesn't alter any public asset.
 *
 * Source order:
 *  1. NEXT_PUBLIC_BUILD_SHA / NEXT_PUBLIC_BUILD_TIME — baked in at build time by
 *     scripts/deploy-vps.sh (exact commit that was compiled).
 *  2. .git/HEAD read at runtime from the app's cwd — the checked-out commit (the
 *     deploy hard-resets to origin/main), so this works even before the baked env
 *     lands, and never throws.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function gitHead(): string | null {
  try {
    const dir = join(process.cwd(), ".git");
    const head = readFileSync(join(dir, "HEAD"), "utf8").trim();
    if (head.startsWith("ref:")) {
      const ref = head.slice(4).trim();
      return readFileSync(join(dir, ref), "utf8").trim();
    }
    return head; // detached HEAD → raw sha
  } catch {
    return null;
  }
}

export function GET() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || gitHead() || "unknown";
  return NextResponse.json(
    {
      sha,
      shortSha: sha.slice(0, 8),
      builtAt: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
