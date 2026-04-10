import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { buildStore, deployStore, buildStoreV3, deployStoreV3, getStoreDir } from "@/lib/store-builder/store-site-builder";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// POST /api/ecommerce/store/[id]/rebuild — Rebuild store without re-running agent (FREE)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, name: true, generatorVersion: true, generatedPath: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isV2 = store.generatorVersion === "v2";

    const storeDir = store.generatedPath || getStoreDir(id);
    if (!existsSync(storeDir)) {
      return NextResponse.json({ error: "Store files not found — regenerate the store first" }, { status: 404 });
    }

    // Optionally sync brand kit data into data.ts before rebuild
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.syncBrandKit) {
      await syncBrandKitToDataFile(store.id, session.userId, storeDir);
    }

    console.log(`[StoreRebuild] Starting ${isV2 ? "V2" : "V3"} rebuild for store ${id}`);

    // Fire-and-forget
    const rebuildPromise = (async () => {
      if (isV2) {
        // Legacy V2 (static export) rebuild
        const buildResult = await buildStore(id);
        if (!buildResult.success) {
          console.error(`[StoreRebuild] V2 build failed: ${buildResult.error}`);
          return;
        }
        const deployResult = await deployStore(id, store.slug);
        if (!deployResult.success) {
          console.error(`[StoreRebuild] V2 deploy failed: ${deployResult.error}`);
          return;
        }
      } else {
        // V3 SSR rebuild
        const buildResult = await buildStoreV3(id);
        if (!buildResult.success) {
          console.error(`[StoreRebuild] V3 build failed: ${buildResult.error}`);
          return;
        }
        const deployResult = await deployStoreV3(id, store.slug);
        if (!deployResult.success) {
          console.error(`[StoreRebuild] V3 deploy failed: ${deployResult.error}`);
          return;
        }
      }
      // Clear cached site data so it gets re-parsed
      await prisma.store.update({
        where: { id },
        data: { siteData: "{}" },
      });
      console.log(`[StoreRebuild] Store ${id} rebuilt and deployed`);
    })();

    rebuildPromise.catch((err) => {
      console.error(`[StoreRebuild] Fatal error:`, err);
    });

    return NextResponse.json({ success: true, message: "Rebuild started" });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/rebuild error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Sync brand kit fields into data.ts (name, phone, email, address, tagline).
 * Uses proper regex for quoted string replacement (handles apostrophes).
 */
async function syncBrandKitToDataFile(storeId: string, userId: string, storeDir: string): Promise<void> {
  const brandKit = await prisma.brandKit.findFirst({
    where: { userId },
    orderBy: { isDefault: "desc" },
  });
  if (!brandKit) return;

  const dataPath = join(storeDir, "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return;

  let data = readFileSync(dataPath, "utf-8");

  // Replace fields using double-quoted strings (safe for apostrophes)
  const replacements: Array<[string, string | null]> = [
    ["name", brandKit.name],
    ["tagline", brandKit.tagline],
    ["address", brandKit.address],
  ];

  for (const [field, value] of replacements) {
    if (!value) continue;
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // Match: field: 'value' or field: "value" (proper quoted string regex)
    const regex = new RegExp(
      `(${field}:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`,
    );
    data = data.replace(regex, `$1"${escaped}"`);
  }

  // Replace phone/email arrays
  if (brandKit.phone) {
    data = data.replace(
      /phones:\s*\[.*?\]/s,
      `phones: ["${brandKit.phone.replace(/"/g, '\\"')}"]`
    );
  }
  if (brandKit.email) {
    data = data.replace(
      /emails:\s*\[.*?\]/s,
      `emails: ["${brandKit.email.replace(/"/g, '\\"')}"]`
    );
  }

  writeFileSync(dataPath, data, "utf-8");
  console.log(`[StoreRebuild] Synced brand kit to data.ts`);
}
