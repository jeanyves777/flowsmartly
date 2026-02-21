/**
 * Background Remover
 *
 * Uses rembg Python library to remove image backgrounds.
 * Called via child_process.spawn, same pattern as AnimatedDrawings and SadTalker.
 */

import { spawn, execSync } from "child_process";
import { mkdir, unlink } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { resolveToLocalPath } from "@/lib/utils/s3-client";

const PYTHON_PATH = process.env.REMBG_PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "remove_background.py");
const TIMEOUT_MS = 120_000; // 2 minutes

export type BgRemovalModel =
  | "u2net"
  | "u2net_human_seg"
  | "isnet-general-use"
  | "u2netp";

export interface RemoveBackgroundOptions {
  model?: BgRemovalModel;
}

export interface RemoveBackgroundResult {
  outputPath: string;
  outputUrl: string;
}

// Cache availability check
let _rembgAvailable: boolean | null = null;

/**
 * Check if rembg is installed and available
 */
export function isRembgAvailable(): boolean {
  if (_rembgAvailable !== null) return _rembgAvailable;
  try {
    execSync(`"${PYTHON_PATH}" -c "from rembg import remove"`, {
      windowsHide: true,
      stdio: "ignore",
      timeout: 15000,
    });
    _rembgAvailable = true;
    return true;
  } catch {
    _rembgAvailable = false;
    console.warn("rembg: NOT available (Python import failed)");
    return false;
  }
}

/**
 * Remove background from an image.
 * @param inputPath - Local path, /uploads/ path, or S3 URL
 * @param options - Model selection
 */
export async function removeBackground(
  inputPath: string,
  options: RemoveBackgroundOptions = {}
): Promise<RemoveBackgroundResult> {
  const { model = "u2net" } = options;

  // Resolve to local filesystem path
  const resolvedInput = resolveToLocalPath(inputPath);
  if (!existsSync(resolvedInput)) {
    throw new Error(`Input file not found: ${resolvedInput}`);
  }

  // Output directory
  const outputDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "bg-removed"
  );
  await mkdir(outputDir, { recursive: true });

  const outputFilename = `${randomUUID()}.png`;
  const outputPath = path.join(outputDir, outputFilename);
  const outputUrl = `/uploads/bg-removed/${outputFilename}`;

  return new Promise((resolve, reject) => {
    const args = [
      SCRIPT_PATH,
      "--input",
      resolvedInput,
      "--output",
      outputPath,
      "--model",
      model,
    ];

    const proc = spawn(PYTHON_PATH, args, {
      windowsHide: true,
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start background remover: ${err.message}`));
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Background removal timed out"));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && existsSync(outputPath)) {
        resolve({ outputPath, outputUrl });
      } else {
        reject(
          new Error(
            `Background removal failed: ${stderr || stdout || `exit code ${code}`}`
          )
        );
      }
    });
  });
}
