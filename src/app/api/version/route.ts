import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GET /api/version — the deployed build's commit SHA + build time, and the
 * deploy pipeline's own health. Public and uncached, so a deploy is verifiable
 * from the outside even when the change is entirely behind auth (e.g. /home
 * surfaces) and doesn't alter any public asset.
 *
 * Source order for the SHA:
 *  1. NEXT_PUBLIC_BUILD_SHA / NEXT_PUBLIC_BUILD_TIME — baked in at build time by
 *     scripts/deploy-vps.sh (exact commit that was compiled).
 *  2. .git/HEAD read at runtime from the app's cwd — the checked-out commit (the
 *     deploy hard-resets to origin/main), so this works even before the baked env
 *     lands, and never throws.
 *
 * `deploy` mirrors DEPLOY_STATUS, written by scripts/poll-deploy.sh. This is the
 * signal that used to be missing: a FAILED deploy leaves the previous build
 * serving (pm2 only reloads after a successful build), so the app answers
 * normally while being silently out of date. `deploy.state` distinguishes
 * "up to date" from "the last deploy failed and production is behind":
 *
 *   ok        deployedSha === origin/main; nothing pending
 *   deploying a deploy is running right now
 *   failed    the last attempt failed; another retry is scheduled
 *   stuck     retries exhausted — nothing further will happen without a human
 *
 * Deliberately carries no error text or paths: it is a public endpoint, and the
 * detail belongs in /var/log/flowsmartly-deploy.log.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DeployStatus = {
  state: "ok" | "deploying" | "failed" | "stuck";
  deployedSha: string;
  targetSha: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  failedStep: string | null;
  updatedAt: string;
};

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

function deployStatus(): DeployStatus | null {
  try {
    const raw = readFileSync(join(process.cwd(), "DEPLOY_STATUS"), "utf8");
    const parsed = JSON.parse(raw) as Partial<DeployStatus>;
    if (!parsed || typeof parsed.state !== "string") return null;
    return {
      state: parsed.state as DeployStatus["state"],
      deployedSha: String(parsed.deployedSha ?? "unknown"),
      targetSha: String(parsed.targetSha ?? "unknown"),
      attempts: Number(parsed.attempts ?? 0),
      maxAttempts: Number(parsed.maxAttempts ?? 0),
      nextAttemptAt: parsed.nextAttemptAt ?? null,
      failedStep: parsed.failedStep ?? null,
      updatedAt: String(parsed.updatedAt ?? ""),
    };
  } catch {
    return null; // no poller state on this box (dev, or not yet installed)
  }
}

export function GET() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || gitHead() || "unknown";
  return NextResponse.json(
    {
      sha,
      shortSha: sha.slice(0, 8),
      builtAt: process.env.NEXT_PUBLIC_BUILD_TIME || null,
      deploy: deployStatus(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
