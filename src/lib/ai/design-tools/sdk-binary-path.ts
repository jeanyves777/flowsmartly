/**
 * Resolve the correct Claude Agent SDK native binary path.
 *
 * Why this exists:
 *   The SDK's default binary resolver tries musl FIRST, then glibc on
 *   Linux. Both packages can be installed simultaneously (npm pulls
 *   both as optional deps depending on flags). On a glibc Ubuntu box
 *   the musl binary fails to spawn — wrong libc — and the agent
 *   throws "Claude Code native binary not found ...musl/claude" even
 *   though the file is there.
 *
 *   Fix: detect glibc vs musl at runtime, return the correct binary
 *   path. Caller passes via `pathToClaudeCodeExecutable` to query().
 *
 * Why we don't use require.resolve / createRequire:
 *   1. Next.js bundles server code with webpack — `import.meta.url`
 *      is undefined and `__filename` may be the bundle path, not the
 *      source path.
 *   2. The platform binary packages don't expose `package.json` via
 *      their `exports` field, so `require.resolve(<pkg>/package.json)`
 *      throws even when the package is installed.
 *
 *   Instead: walk known absolute locations relative to process.cwd().
 *   PM2's exec cwd is the app root (/opt/flowsmartly in prod), and
 *   `.next/standalone/...` is the fallback for standalone Next builds.
 */

import { existsSync } from "fs";
import path from "path";

let _cached: string | null | undefined;

export function getClaudeCodeBinaryPath(): string | undefined {
  if (_cached !== undefined) return _cached ?? undefined;

  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === "win32" ? ".exe" : "";

  // Build platform-specific package-name candidates. On Linux we PREFER
  // glibc unless we detect a musl system (Alpine etc.) — opposite of
  // the SDK's default resolver which prefers musl.
  let pkgNames: string[];
  if (platform === "linux") {
    const isMusl = existsSync("/etc/alpine-release") || existsSync("/lib/ld-musl-x86_64.so.1");
    pkgNames = isMusl
      ? [`claude-agent-sdk-linux-${arch}-musl`, `claude-agent-sdk-linux-${arch}`]
      : [`claude-agent-sdk-linux-${arch}`, `claude-agent-sdk-linux-${arch}-musl`];
  } else if (platform === "darwin") {
    pkgNames = [`claude-agent-sdk-darwin-${arch}`];
  } else if (platform === "win32") {
    pkgNames = [`claude-agent-sdk-win32-${arch}`];
  } else {
    pkgNames = [`claude-agent-sdk-${platform}-${arch}`];
  }

  // Search likely node_modules locations:
  //  - process.cwd()/node_modules (PM2 normal launch)
  //  - process.cwd()/../node_modules (monorepo)
  //  - .next/standalone/node_modules (Next standalone build)
  const baseDirs = [
    path.join(process.cwd(), "node_modules", "@anthropic-ai"),
    path.join(process.cwd(), "..", "node_modules", "@anthropic-ai"),
    path.join(process.cwd(), ".next", "standalone", "node_modules", "@anthropic-ai"),
  ];

  for (const base of baseDirs) {
    for (const pkg of pkgNames) {
      const binaryPath = path.join(base, pkg, `claude${ext}`);
      if (existsSync(binaryPath)) {
        console.log(`[design-engine] Resolved Claude Code binary: ${binaryPath}`);
        _cached = binaryPath;
        return binaryPath;
      }
    }
  }

  // Nothing found — let the SDK fall back to its own resolver (and
  // surface its error to the caller if that fails too).
  console.warn(`[design-engine] Could not resolve Claude Code binary in any of: ${baseDirs.join(", ")} (tried packages: ${pkgNames.join(", ")})`);
  _cached = null;
  return undefined;
}
