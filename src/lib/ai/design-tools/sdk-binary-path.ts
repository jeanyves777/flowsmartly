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
 *   Fix: detect glibc vs musl at runtime, pass the correct path
 *   via `pathToClaudeCodeExecutable` to query() options.
 *
 *   Detection: Linux without /lib/ld-musl-* present is glibc. We use
 *   the existence of /etc/alpine-release as a strong musl signal.
 *   When undecidable, prefer glibc since 95%+ of Linux servers are.
 */

import { existsSync } from "fs";
import path from "path";
import { createRequire } from "module";

const requireFromHere = createRequire(import.meta.url || `file://${__filename}`);

let _cached: string | undefined | null = null;

export function getClaudeCodeBinaryPath(): string | undefined {
  if (_cached !== null) return _cached ?? undefined;

  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === "win32" ? ".exe" : "";

  let candidates: string[];
  if (platform === "linux") {
    const isMusl = existsSync("/etc/alpine-release") || existsSync("/lib/ld-musl-x86_64.so.1");
    candidates = isMusl
      ? [`@anthropic-ai/claude-agent-sdk-linux-${arch}-musl`, `@anthropic-ai/claude-agent-sdk-linux-${arch}`]
      : [`@anthropic-ai/claude-agent-sdk-linux-${arch}`, `@anthropic-ai/claude-agent-sdk-linux-${arch}-musl`];
  } else {
    candidates = [`@anthropic-ai/claude-agent-sdk-${platform}-${arch}`];
  }

  for (const pkg of candidates) {
    try {
      // package.json is always present and resolvable; the binary lives next to it.
      const pkgJsonPath = requireFromHere.resolve(`${pkg}/package.json`);
      const binaryPath = path.join(path.dirname(pkgJsonPath), `claude${ext}`);
      if (existsSync(binaryPath)) {
        _cached = binaryPath;
        return binaryPath;
      }
    } catch {
      // package not installed — try the next candidate
    }
  }

  // Nothing found — let the SDK fall back to its own resolver (and surface
  // the original error to the caller if that fails too).
  _cached = undefined;
  return undefined;
}
