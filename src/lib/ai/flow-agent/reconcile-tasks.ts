import { prisma } from "@/lib/db/client";
import { notifyAgentTaskComplete } from "./notify-task-complete";
import { saveToMediaLibrary } from "./save-media";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { veoClient } from "@/lib/ai/veo-client";
import { overlayBrandLogoOnVideo } from "@/lib/video/overlay-brand-logo";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";

/**
 * AgentTask recovery — the safety net for Flow-AI background jobs.
 *
 * Background tasks run IN-PROCESS (setImmediate). A `pm2 reload` (deploy) or
 * crash kills the worker mid-render, but the provider (Veo/Grok) keeps
 * rendering the job AND bills us for it. So the right move on restart is NOT
 * to mark the task "failed" — it's to RESUME: poll the provider job we already
 * submitted, pull the finished video, and complete the task (charging only on
 * real success). We only fail a task when there is no provider handle to
 * resume (it never actually got submitted) or the provider itself reports
 * failure/expiry.
 *
 * Drive this from the recover-tasks cron (node runtime).
 */

const RESUME_GRACE_MS = 90_000; // ignore very fresh tasks still owned by a live worker
const HANDLELESS_FAIL_MIN = 15; // running this long with NO provider handle → unrecoverable
const RESUME_MAX_MIN = 45; // provider still not done after this → give up

interface TaskRow {
  id: string;
  userId: string;
  kind: string;
  conversationId: string | null;
  creditCost: number;
  output: string | null;
  createdAt: Date;
}

interface PendingHandle {
  provider?: string;
  jobId?: string;
}

function ageMinutes(t: TaskRow): number {
  return (Date.now() - new Date(t.createdAt).getTime()) / 60_000;
}

function deepLinkFor(t: TaskRow): string {
  return t.conversationId ? `/flow-ai?conversationId=${t.conversationId}&taskId=${t.id}` : "/flow-ai";
}

function readPending(output: string | null): PendingHandle | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as { pending?: PendingHandle };
    return parsed?.pending ?? null;
  } catch {
    return null;
  }
}

/** Mark a task failed (only if still running/pending) + notify the user. */
async function failTask(t: TaskRow, error: string, summary: string): Promise<void> {
  const res = await prisma.agentTask.updateMany({
    where: { id: t.id, status: { in: ["running", "pending"] } },
    data: { status: "failed", error, completedAt: new Date() },
  });
  if (res.count > 0) {
    notifyAgentTaskComplete({
      userId: t.userId,
      taskId: t.id,
      kind: t.kind,
      ok: false,
      summary,
      deepLink: deepLinkFor(t),
    }).catch(() => {});
  }
}

type RecoverOutcome = "recovered" | "pending" | "failed" | "no_handle";

/**
 * Shared "the render finished — bring it home" path: brand, upload, persist,
 * claim the task (lock), charge once, notify. Used by both provider resumers.
 */
async function finalizeRecoveredVideo(t: TaskRow, rawBuffer: Buffer): Promise<RecoverOutcome> {
  let buffer = rawBuffer;
  try {
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: t.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { logo: true, iconLogo: true },
    });
    const logoSource = brandKit?.iconLogo || brandKit?.logo || null;
    if (logoSource) buffer = await overlayBrandLogoOnVideo(buffer, logoSource);
  } catch {
    /* branding is best-effort */
  }
  const key = `flow-ai/${t.userId}/${t.conversationId || "recovered"}-${t.id}.mp4`;
  const finalUrl = await uploadToS3(key, buffer, "video/mp4");

  await saveToMediaLibrary({
    userId: t.userId,
    url: finalUrl,
    type: "video",
    mimeType: "video/mp4",
    size: buffer.length,
    tags: ["flow-ai", "video", "recovered"],
    metadata: { taskId: t.id, recovered: true },
  }).catch(() => {});

  // Flip to completed FIRST (acts as the lock so a concurrent tick / the charge
  // can't double-run), only if still running/pending.
  const claimed = await prisma.agentTask.updateMany({
    where: { id: t.id, status: { in: ["running", "pending"] } },
    data: { status: "completed", completedAt: new Date(), output: JSON.stringify({ url: finalUrl, recovered: true }) },
  });
  if (claimed.count === 0) return "recovered"; // someone else finished it

  if (t.creditCost > 0) {
    await creditService
      .deductCredits({
        userId: t.userId,
        amount: t.creditCost,
        type: "USAGE",
        description: "Flow-AI agent: video (recovered after restart)",
        referenceType: "flow_ai_task",
        referenceId: t.id,
      })
      .catch((e) => console.error("[reconcile-tasks] recovered-video charge failed:", e));
  }

  notifyAgentTaskComplete({
    userId: t.userId,
    taskId: t.id,
    kind: t.kind,
    ok: true,
    summary: "Your video is ready",
    deepLink: deepLinkFor(t),
    previewImageUrl: finalUrl,
  }).catch(() => {});

  return "recovered";
}

/** Resume a grok video job from its persisted request_id. */
async function recoverGrokVideo(t: TaskRow, jobId: string): Promise<RecoverOutcome> {
  const status = await grokVideoClient.pollOnce(jobId);

  if (status.state === "pending") {
    if (ageMinutes(t) > RESUME_MAX_MIN) {
      await failTask(
        t,
        "The video provider did not finish in time. Please try again.",
        "Your video timed out — please try again",
      );
      return "failed";
    }
    return "pending"; // still rendering — re-check next cron tick
  }

  if (status.state === "failed") {
    await failTask(
      t,
      `The video provider could not finish this render${status.error ? ` (${status.error})` : ""}. Please try again.`,
      "Your video couldn't be generated — please try again",
    );
    return "failed";
  }

  // done → pull + finalize.
  const buffer = await grokVideoClient.fetchVideoBuffer(status.url!);
  return finalizeRecoveredVideo(t, buffer);
}

/**
 * Resume a Veo (premium) video from its persisted operation name. Defensive:
 * a "done" pulls + finalizes; a transient/unknown poll error is treated like
 * "still pending" but is age-bounded (RESUME_MAX_MIN) so a handle we can't
 * re-poll can NEVER strand the task — it fails gracefully with a retry note.
 */
async function recoverVeoVideo(t: TaskRow, operationName: string): Promise<RecoverOutcome> {
  const status = await veoClient.pollOnceByName(operationName);

  if (status.state === "done" && status.uri) {
    const buffer = await veoClient.fetchVideoByUri(status.uri);
    return finalizeRecoveredVideo(t, buffer);
  }

  if (status.state === "failed") {
    await failTask(
      t,
      `The video provider could not finish this render${status.error ? ` (${status.error})` : ""}. Please try again.`,
      "Your video couldn't be generated — please try again",
    );
    return "failed";
  }

  // "pending" or "unknown" (couldn't re-poll the handle). Keep trying until the
  // grace window, then fail so the user is never stuck on a stale render.
  if (ageMinutes(t) > RESUME_MAX_MIN) {
    await failTask(
      t,
      "The video render was interrupted and couldn't be recovered in time. Please try again.",
      "Your video timed out — please try again",
    );
    return "failed";
  }
  return "pending";
}

export interface RecoveryResult {
  scanned: number;
  recovered: number;
  failed: number;
  stillPending: number;
}

/**
 * Walk orphaned tasks. Video tasks with a provider handle are RESUMED; tasks
 * with no handle (or non-video) that have been stuck too long are failed.
 */
export async function runTaskRecovery(): Promise<RecoveryResult> {
  const result: RecoveryResult = { scanned: 0, recovered: 0, failed: 0, stillPending: 0 };
  try {
    const cutoff = new Date(Date.now() - RESUME_GRACE_MS);
    const tasks = (await prisma.agentTask.findMany({
      where: { status: { in: ["running", "pending"] }, createdAt: { lt: cutoff } },
      select: { id: true, userId: true, kind: true, conversationId: true, creditCost: true, output: true, createdAt: true },
      take: 50,
    })) as TaskRow[];

    result.scanned = tasks.length;

    for (const t of tasks) {
      try {
        const pending = readPending(t.output);

        if (t.kind === "generate_video" && pending?.jobId && pending.provider === "grok") {
          const outcome = await recoverGrokVideo(t, pending.jobId);
          if (outcome === "recovered") result.recovered++;
          else if (outcome === "failed") result.failed++;
          else result.stillPending++;
          continue;
        }

        if (t.kind === "generate_video" && pending?.jobId && pending.provider === "veo3") {
          const outcome = await recoverVeoVideo(t, pending.jobId);
          if (outcome === "recovered") result.recovered++;
          else if (outcome === "failed") result.failed++;
          else result.stillPending++;
          continue;
        }

        // No resumable handle (never submitted, or a provider we can't resume).
        // Give it a generous grace, then fail so the user isn't stuck forever.
        if (ageMinutes(t) >= HANDLELESS_FAIL_MIN) {
          await failTask(
            t,
            "Rendering was interrupted and couldn't be recovered. Please try again.",
            "Your request was interrupted — please try again",
          );
          result.failed++;
        } else {
          result.stillPending++;
        }
      } catch (e) {
        console.error(`[reconcile-tasks] recovery error for task ${t.id}:`, e);
        result.stillPending++;
      }
    }

    if (result.recovered || result.failed) {
      console.log(
        `[reconcile-tasks] recovery: scanned=${result.scanned} recovered=${result.recovered} failed=${result.failed} pending=${result.stillPending}`,
      );
    }
  } catch (e) {
    console.error("[reconcile-tasks] runTaskRecovery failed:", e);
  }
  return result;
}
