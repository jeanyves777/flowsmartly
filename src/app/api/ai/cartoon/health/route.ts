import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/cartoon/health
 *
 * Diagnostic — reports which optional dependencies the cartoon-maker
 * pipeline needs and which are actually available on this server.
 *
 * The cartoon feature is currently MAINTENANCE per the recovery plan
 * (hidden from sidebar, generation API returns 503). This endpoint stays
 * available so admins can audit the environment before the rebuild.
 */

interface CheckResult {
  name: string;
  required: boolean;
  ok: boolean;
  detail?: string;
}

async function checkExecutable(cmd: string, args: string[] = ["-version"]): Promise<{ ok: boolean; detail?: string }> {
  try {
    const { spawn } = await import("child_process");
    return await new Promise((resolve) => {
      const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      proc.stdout.on("data", (d) => { out += d.toString(); });
      proc.on("error", () => resolve({ ok: false, detail: "binary not found" }));
      proc.on("exit", (code) => {
        if (code === 0) {
          const firstLine = out.split("\n")[0]?.trim().slice(0, 120) || "ok";
          resolve({ ok: true, detail: firstLine });
        } else {
          resolve({ ok: false, detail: `exit ${code}` });
        }
      });
    });
  } catch {
    return { ok: false, detail: "spawn failed" };
  }
}

async function checkPath(path: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const { stat } = await import("fs/promises");
    const s = await stat(path);
    return { ok: true, detail: s.isDirectory() ? "directory" : "file" };
  } catch {
    return { ok: false, detail: "missing" };
  }
}

async function checkHttp(url: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.adminId && !session?.userId) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const checks: CheckResult[] = [];
  const ffmpeg = await checkExecutable("ffmpeg", ["-version"]);
  checks.push({ name: "ffmpeg", required: true, ...ffmpeg });

  const python = await checkExecutable("python3", ["--version"]);
  checks.push({ name: "python3", required: true, ...python });

  const sadtalkerPath = process.env.SADTALKER_PATH || "/opt/SadTalker";
  const sadtalker = await checkPath(`${sadtalkerPath}/checkpoints`);
  checks.push({ name: `SadTalker checkpoints (${sadtalkerPath}/checkpoints)`, required: false, ...sadtalker });

  const torchserveUrl = process.env.TORCHSERVE_URL || "http://localhost:8080";
  const torchserve = await checkHttp(`${torchserveUrl}/ping`);
  checks.push({ name: `TorchServe (${torchserveUrl}/ping)`, required: false, ...torchserve });

  const adUrl = process.env.ANIMATED_DRAWINGS_API_URL;
  if (adUrl) {
    const ad = await checkHttp(`${adUrl}/health`);
    checks.push({ name: `AnimatedDrawings API (${adUrl})`, required: false, ...ad });
  } else {
    checks.push({ name: "AnimatedDrawings API", required: false, ok: false, detail: "ANIMATED_DRAWINGS_API_URL not set" });
  }

  const allRequiredOk = checks.filter((c) => c.required).every((c) => c.ok);
  const anyOptionalOk = checks.filter((c) => !c.required).some((c) => c.ok);

  return NextResponse.json({
    success: true,
    status: allRequiredOk && anyOptionalOk ? "available" : "maintenance",
    maintenanceReason: !allRequiredOk
      ? "Required tooling missing on this server (ffmpeg + python3)."
      : !anyOptionalOk
        ? "No animation backend available (SadTalker / TorchServe / AnimatedDrawings)."
        : null,
    checks,
    env: {
      DISABLE_TALKING_HEAD: process.env.DISABLE_TALKING_HEAD === "true",
      hasSadTalkerPath: Boolean(process.env.SADTALKER_PATH),
      hasTorchServeUrl: Boolean(process.env.TORCHSERVE_URL),
      hasAnimatedDrawingsApiUrl: Boolean(process.env.ANIMATED_DRAWINGS_API_URL),
    },
  });
}
