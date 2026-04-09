/**
 * PM2 Process Manager — manages independent SSR app processes.
 *
 * Uses PM2 CLI on production (Linux), falls back to child_process on dev (Windows).
 * Each store/website runs as a separate Next.js process on its own port.
 *
 * PM2 naming convention:
 *   - Stores:   "store-{slug}"
 *   - Websites: "site-{slug}"
 */

import { execSync, spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const IS_PRODUCTION = process.platform === "linux";

// ─── Dev mode process tracking (Windows) ─────────────────────────────────────

const devProcesses = new Map<string, ChildProcess>();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  name: string;        // e.g. "store-my-shop" or "site-my-site"
  cwd: string;         // Path to the generated app directory
  port: number;        // Assigned port
  slug: string;        // Store/website slug
  apiGatewayUrl?: string; // Override gateway URL (default: https://flowsmartly.com)
}

export interface AppStatus {
  name: string;
  status: "online" | "stopped" | "errored" | "unknown";
  pid?: number;
  memory?: number;     // Memory in bytes
  uptime?: number;     // Uptime in ms
}

// ─── Start an app ────────────────────────────────────────────────────────────

export async function startApp(config: AppConfig): Promise<void> {
  const { name, cwd, port, slug, apiGatewayUrl } = config;
  const gatewayUrl = apiGatewayUrl || "https://flowsmartly.com";

  // Verify the app has been built
  const nextDir = join(cwd, ".next");
  if (!existsSync(nextDir)) {
    throw new Error(`App ${name} has not been built yet (.next/ not found at ${cwd})`);
  }

  if (IS_PRODUCTION) {
    // Production: use PM2
    try {
      // Delete if exists (clean slate)
      try { execSync(`pm2 delete ${name} 2>/dev/null`, { stdio: "pipe" }); } catch {}

      execSync(
        `pm2 start node_modules/.bin/next --name "${name}" -- start -p ${port}`,
        {
          cwd,
          env: {
            ...process.env,
            PORT: String(port),
            API_GATEWAY_URL: gatewayUrl,
            STORE_SLUG: slug,
            NODE_ENV: "production",
          },
          stdio: "pipe",
          timeout: 30_000,
        }
      );

      // Save PM2 process list so it survives reboots
      try { execSync("pm2 save", { stdio: "pipe" }); } catch {}
    } catch (err: any) {
      throw new Error(`Failed to start PM2 process ${name}: ${err.message}`);
    }
  } else {
    // Dev: use child_process.spawn
    if (devProcesses.has(name)) {
      await stopApp(name);
    }

    const nextBin = join(cwd, "node_modules", ".bin", "next");
    const cmd = existsSync(nextBin) ? nextBin : "npx";
    const args = cmd.includes("next")
      ? ["start", "-p", String(port)]
      : ["next", "start", "-p", String(port)];

    const child = spawn(cmd, args, {
      cwd,
      env: {
        ...process.env,
        PORT: String(port),
        API_GATEWAY_URL: gatewayUrl,
        STORE_SLUG: slug,
        NODE_ENV: "production",
      },
      stdio: "pipe",
      detached: false,
      shell: true,
    });

    child.on("error", (err) => {
      console.error(`[ssr-manager] ${name} error:`, err.message);
    });

    child.on("exit", (code) => {
      console.log(`[ssr-manager] ${name} exited with code ${code}`);
      devProcesses.delete(name);
    });

    devProcesses.set(name, child);
  }
}

// ─── Stop an app ─────────────────────────────────────────────────────────────

export async function stopApp(name: string): Promise<void> {
  if (IS_PRODUCTION) {
    try {
      execSync(`pm2 stop ${name}`, { stdio: "pipe", timeout: 15_000 });
    } catch {
      // Process might not exist, that's fine
    }
  } else {
    const child = devProcesses.get(name);
    if (child && !child.killed) {
      child.kill("SIGTERM");
      // Give it 5s to shut down, then force kill
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
          resolve();
        }, 5_000);
        child.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    devProcesses.delete(name);
  }
}

// ─── Restart an app ──────────────────────────────────────────────────────────

export async function restartApp(name: string): Promise<void> {
  if (IS_PRODUCTION) {
    try {
      execSync(`pm2 restart ${name}`, { stdio: "pipe", timeout: 30_000 });
    } catch (err: any) {
      throw new Error(`Failed to restart ${name}: ${err.message}`);
    }
  } else {
    // Dev: stop and re-read config isn't possible without stored config
    // Caller should use stopApp + startApp with full config
    throw new Error("Dev mode restart requires full config — use stopApp + startApp");
  }
}

// ─── Delete an app (stop + remove from PM2) ──────────────────────────────────

export async function deleteApp(name: string): Promise<void> {
  if (IS_PRODUCTION) {
    try {
      execSync(`pm2 delete ${name}`, { stdio: "pipe", timeout: 15_000 });
      try { execSync("pm2 save", { stdio: "pipe" }); } catch {}
    } catch {
      // Process might not exist
    }
  } else {
    await stopApp(name);
  }
}

// ─── Get status of a specific app ────────────────────────────────────────────

export async function getAppStatus(name: string): Promise<AppStatus> {
  if (IS_PRODUCTION) {
    try {
      const output = execSync(`pm2 jlist`, { stdio: "pipe", timeout: 10_000 });
      const processes = JSON.parse(output.toString());
      const proc = processes.find((p: any) => p.name === name);
      if (!proc) return { name, status: "stopped" };

      return {
        name,
        status: proc.pm2_env?.status === "online" ? "online"
          : proc.pm2_env?.status === "stopped" ? "stopped"
          : proc.pm2_env?.status === "errored" ? "errored"
          : "unknown",
        pid: proc.pid,
        memory: proc.monit?.memory,
        uptime: proc.pm2_env?.pm_uptime
          ? Date.now() - proc.pm2_env.pm_uptime
          : undefined,
      };
    } catch {
      return { name, status: "unknown" };
    }
  } else {
    const child = devProcesses.get(name);
    if (!child || child.killed) return { name, status: "stopped" };
    return { name, status: "online", pid: child.pid };
  }
}

// ─── List all SSR app processes ──────────────────────────────────────────────

export async function listApps(): Promise<AppStatus[]> {
  if (IS_PRODUCTION) {
    try {
      const output = execSync(`pm2 jlist`, { stdio: "pipe", timeout: 10_000 });
      const processes = JSON.parse(output.toString());
      return processes
        .filter((p: any) => p.name.startsWith("store-") || p.name.startsWith("site-"))
        .map((p: any) => ({
          name: p.name,
          status: p.pm2_env?.status === "online" ? "online"
            : p.pm2_env?.status === "stopped" ? "stopped"
            : p.pm2_env?.status === "errored" ? "errored"
            : "unknown",
          pid: p.pid,
          memory: p.monit?.memory,
          uptime: p.pm2_env?.pm_uptime
            ? Date.now() - p.pm2_env.pm_uptime
            : undefined,
        } as AppStatus));
    } catch {
      return [];
    }
  } else {
    return Array.from(devProcesses.entries()).map(([name, child]) => ({
      name,
      status: child.killed ? "stopped" as const : "online" as const,
      pid: child.pid,
    }));
  }
}

// ─── Wait for an app to be healthy (port responding) ─────────────────────────

export async function waitForHealthy(
  port: number,
  timeoutMs: number = 30_000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        method: "HEAD",
        signal: AbortSignal.timeout(2_000),
      });
      if (res.ok || res.status === 404) return true; // 404 is fine — app is responding
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}
