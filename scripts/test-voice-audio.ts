/**
 * Phone-bridge audio check.
 *
 * The realtime model speaks PCM16@16k only, but ADVERTISES mu-law support —
 * `session.update` accepts input/output_audio_format and echoes them back while
 * ignoring them. Trusting that echo sends callers noise. This proves our
 * transcode actually survives the round trip the phone takes:
 *
 *     model PCM16@16k -> mu-law 8k (what we'd send Twilio)
 *                     -> back to PCM16@16k (what a caller's audio becomes)
 *                     -> the model transcribes it
 *
 * If the transcode were wrong, the model would hear nothing — which is exactly
 * what raw mu-law does (asserted below, so the trap can't quietly come back).
 *
 * Run: npm run test:voice-audio
 */
import assert from "node:assert/strict";

import dotenv from "dotenv";
import WebSocket from "ws";

import {
  TWILIO_FRAME_BYTES, downsample2x, modelToTwilioFrames, pcm16ToUlaw,
  twilioToModel, ulawToPcm16, upsample2x,
} from "../src/lib/voice-agent/audio";

dotenv.config({ path: ".env" });

const URL_ = "wss://api.x.ai/v1/realtime?model=grok-voice";
const KEY = process.env.XAI_API_KEY;
assert(KEY, "XAI_API_KEY is required for the voice audio check.");
const auth = { headers: { Authorization: `Bearer ${KEY}` } };

const SENTENCE = "I would like to book a haircut on Saturday afternoon.";

// ── pure checks first: no network, no excuses ──

// mu-law is lossy but must round-trip a sample to within its own quantisation.
{
  const probe = new Int16Array([0, 100, -100, 1000, -1000, 8000, -8000, 32000, -32000]);
  const back = ulawToPcm16(pcm16ToUlaw(probe));
  for (let i = 0; i < probe.length; i++) {
    const err = Math.abs(back[i] - probe[i]);
    const tol = Math.max(64, Math.abs(probe[i]) * 0.08); // ~8% is mu-law's design
    assert(err <= tol, `mu-law round-trip off by ${err} at ${probe[i]} (tol ${tol.toFixed(0)})`);
  }
  console.log("✅ mu-law encode/decode round-trips within quantisation");
}

// A 2x down then up must preserve length and rough shape.
{
  const n = 1600;
  const sine = new Int16Array(n);
  for (let i = 0; i < n; i++) sine[i] = Math.round(8000 * Math.sin((2 * Math.PI * 300 * i) / 16000));
  const back = upsample2x(downsample2x(sine));
  assert.equal(back.length, n, "resample must preserve length");
  let worst = 0;
  for (let i = 2; i < n - 2; i++) worst = Math.max(worst, Math.abs(back[i] - sine[i]));
  assert(worst < 2600, `300Hz tone distorted by ${worst} through 16k->8k->16k`);
  console.log("✅ 16k->8k->16k keeps a 300Hz tone intact");
}

// Framing must emit whole 20ms frames and carry the remainder, never a short frame.
{
  const odd = new Int16Array(16000 + 37 * 2); // deliberately not a frame multiple
  const b64 = Buffer.from(odd.buffer).toString("base64");
  const { frames, carry } = modelToTwilioFrames(b64, Buffer.alloc(0));
  assert(frames.length > 0, "expected frames");
  for (const f of frames) {
    assert.equal(Buffer.from(f, "base64").length, TWILIO_FRAME_BYTES, "every frame must be exactly 20ms");
  }
  assert(carry.length < TWILIO_FRAME_BYTES, "carry must be less than one frame");
  console.log(`✅ framing: ${frames.length} x 160B frames + ${carry.length}B carried over`);
}

// ── the real thing: does the model understand audio that went through a phone? ──

function speak(instructions) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL_, auth);
    const chunks = [];
    ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === "session.created") {
        ws.send(JSON.stringify({ type: "session.update", session: {
          instructions, voice: "ara", modalities: ["audio", "text"],
          turn_detection: { type: "server_vad" },
        } }));
        setTimeout(() => ws.send(JSON.stringify({ type: "response.create" })), 700);
      }
      // xAI's event name — NOT OpenAI's response.audio.delta.
      if (m.type === "response.output_audio.delta" && m.delta) chunks.push(Buffer.from(m.delta, "base64"));
      if (m.type === "response.done") ws.close();
    });
    ws.on("close", () => resolve(Buffer.concat(chunks)));
    ws.on("error", reject);
    setTimeout(() => ws.close(), 25000);
  });
}

function hears(base64Frames: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL_, auth);
    let heard = "";
    let settled = false;
    let quiet: NodeJS.Timeout | undefined;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(quiet);
      try { ws.close(); } catch { /* already closing */ }
      resolve(heard.trim());
    };
    ws.on("message", (raw) => {
      let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === "session.created") {
        ws.send(JSON.stringify({ type: "session.update", session: {
          instructions: "Repeat back what you heard.", voice: "ara",
          modalities: ["audio", "text"],
          input_audio_transcription: { model: "whisper-1" },
          // VAD OFF on purpose: we push a whole utterance at once, and letting
          // server-side VAD segment it mid-blast truncates the transcript to the
          // first few words. One manual commit = one utterance.
          turn_detection: { type: null },
        } }));
        // Pace the frames like a real call (20ms each). Blasting the whole
        // utterance in a tight loop makes the server transcribe only the first
        // couple of seconds — the bridge streams in real time, so test that way.
        setTimeout(async () => {
          for (const f of base64Frames) {
            ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: f }));
            await new Promise((r) => setTimeout(r, 20));
          }
          ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        }, 600);
      }
      if (m.type?.includes("input_audio_transcription.delta")) heard += m.delta || "";
      if (m.type?.includes("input_audio_transcription.completed")) {
        // Whisper segments a long utterance, so there are SEVERAL completed
        // events — resolving on the first one truncates the transcript and
        // makes a working transcode look broken. Accumulate, then settle once
        // the events stop arriving.
        heard += (heard ? " " : "") + (m.transcript || "");
        clearTimeout(quiet);
        quiet = setTimeout(done, 3500);
      }
    });
    ws.on("error", reject);
    setTimeout(done, 30000);
  });
}

async function main() {
  const spoken = await speak(`Say exactly this and nothing else: ${SENTENCE}`);
  assert(spoken.length > 8000, `model returned too little audio (${spoken.length}B)`);
  console.log(`\ncaptured ${(spoken.length / 2 / 16000).toFixed(1)}s of speech from the model`);

  // Push it through the exact path a call takes, using the bridge's own helpers.
  const { frames: ulawFrames } = modelToTwilioFrames(spoken.toString("base64"), Buffer.alloc(0));
  const backToModel = ulawFrames.map((f) => twilioToModel(f));
  console.log(`round-tripped through ${ulawFrames.length} mu-law frames (${(ulawFrames.length * 0.02).toFixed(1)}s of phone audio)`);

  const heard = await hears(backToModel);
  console.log(`heard back: ${heard ? JSON.stringify(heard) : "(nothing)"}`);

  // Don't demand a perfect transcript — mu-law at 8k is genuinely lossy, and the
  // model may not finish. Demand that real words survived.
  // What this proves: intelligible English came back out of audio that went
  // model -> mu-law 8k -> back. Don't demand the FULL sentence — transcript
  // completeness is the transcription API's business, not the transcode's, and
  // mu-law at 8k is genuinely lossy. The decisive signal is the contrast with
  // raw mu-law below, which yields nothing at all.
  const key = ["would", "like", "book", "haircut", "saturday"];
  const got = key.filter((w) => heard.toLowerCase().includes(w));
  assert(
    got.length >= 3,
    `transcode is broken — recovered only ${got.length} real words from "${heard}"`,
  );
  console.log(`✅ survived the phone round trip (recovered: ${got.join(", ")})`);

  // And prove the trap is still a trap: raw mu-law, which the API claims to
  // accept, must remain unintelligible. If this ever starts working, the
  // transcode can be dropped — but only then.
  const rawUlaw = pcm16ToUlaw(downsample2x(new Int16Array(
    spoken.buffer, spoken.byteOffset, Math.floor(spoken.length / 2),
  )));
  const rawFrames = [];
  for (let i = 0; i + TWILIO_FRAME_BYTES <= rawUlaw.length; i += TWILIO_FRAME_BYTES) {
    rawFrames.push(rawUlaw.subarray(i, i + TWILIO_FRAME_BYTES).toString("base64"));
  }
  const heardRaw = await hears(rawFrames);
  console.log(`raw mu-law (what the API claims to accept) → ${heardRaw ? JSON.stringify(heardRaw) : "(nothing, as expected)"}`);
  assert(
    key.filter((w) => heardRaw.toLowerCase().includes(w)).length < 3,
    "raw mu-law is now understood — the API changed; re-check whether the transcode is still needed",
  );
  console.log("✅ raw mu-law still unintelligible — the transcode is still required");

  console.log("\nAll phone-bridge audio checks passed.");
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e); process.exit(1); },
);
