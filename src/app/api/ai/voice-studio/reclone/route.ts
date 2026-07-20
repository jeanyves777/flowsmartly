import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isElevenLabsEnabled, cloneVoice, listVoices } from "@/lib/voice/elevenlabs-client";
import { downloadS3ObjectToBuffer } from "@/lib/utils/s3-client";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 120;

/**
 * POST /api/ai/voice-studio/reclone — re-create the user's ElevenLabs cloned voices on
 * the CURRENTLY connected account, from the original samples we stored at clone time.
 *
 * Needed after the platform's ElevenLabs account changes: cloned voices live on the
 * account that made them, so every stored `elevenLabsVoiceId` 404s on a new account and
 * narration falls back to a preset. This rebuilds them (idempotent — skips voices that
 * still resolve on the current account) and repoints each VoiceProfile. Free: the account
 * switch is ours, not the user's. [[elevenlabs-free-plan-blocks-clones]] [[voice-studio]]
 */
export async function POST() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (!isElevenLabsEnabled()) return err("Voice cloning isn't configured in this environment", 503);

  const clones = await prisma.voiceProfile.findMany({
    where: { userId: session.userId, type: "cloned", elevenLabsVoiceId: { not: null }, sampleUrl: { not: null } },
    select: { id: true, name: true, elevenLabsVoiceId: true, sampleUrl: true },
  });
  if (!clones.length) return NextResponse.json({ success: true, data: { checked: 0, recloned: 0, results: [] } });

  // which stored voiceIds still resolve on the connected account → leave those alone
  const present = new Set<string>();
  try { (await listVoices()).forEach((v) => present.add(v.voiceId)); } catch { /* if the catalog can't be read, re-clone everything */ }

  const results: { name: string; status: "ok" | "already" | "failed"; error?: string }[] = [];
  let recloned = 0;
  for (const c of clones) {
    if (c.elevenLabsVoiceId && present.has(c.elevenLabsVoiceId)) { results.push({ name: c.name, status: "already" }); continue; }
    try {
      const buffer = await downloadS3ObjectToBuffer(c.sampleUrl!);
      const ext = (c.sampleUrl!.match(/\.(mp3|wav|webm|m4a|ogg)(\?|$)/i)?.[1] || "mp3").toLowerCase();
      const { voiceId } = await cloneVoice({ name: c.name, description: `Re-cloned for ${session.userId}`, audioBuffers: [{ buffer, filename: `${c.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "voice"}.${ext}` }] });
      await prisma.voiceProfile.update({ where: { id: c.id }, data: { elevenLabsVoiceId: voiceId } });
      recloned++;
      results.push({ name: c.name, status: "ok" });
    } catch (e) {
      results.push({ name: c.name, status: "failed", error: e instanceof Error ? e.message.slice(0, 160) : "clone failed" });
    }
  }

  return NextResponse.json({ success: true, data: { checked: clones.length, recloned, results } });
}
