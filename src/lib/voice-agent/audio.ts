/**
 * Audio for the phone bridge.
 *
 * Twilio Media Streams are **G.711 mu-law, 8 kHz, mono**, 20 ms frames (160 bytes).
 * The realtime voice model speaks **PCM16 LE, 16 kHz, mono** — and only that.
 *
 * It advertises otherwise: `session.update` accepts `input_audio_format` /
 * `output_audio_format` and echoes them back, but they change nothing. Probed
 * 2026-07-17 — requesting `g711_ulaw` and `pcm16` return the same PCM16 bytes
 * (lag-1 autocorrelation 0.98 as PCM16 vs -0.03 as mu-law), and mu-law fed in
 * is not transcribed at all. So we transcode both ways ourselves; trusting the
 * echo sends callers noise. See [[grok-voice-realtime-protocol]].
 */

export const TWILIO_RATE = 8000;
export const MODEL_RATE = 16000;
/** One 20 ms Twilio frame, in mu-law bytes. */
export const TWILIO_FRAME_BYTES = 160;

const BIAS = 0x84;
const CLIP = 32635;

// ── G.711 mu-law ──

/**
 * Decode one mu-law byte to a 16-bit sample (ITU-T G.711).
 * Table-driven at call sites via ULAW_TO_PCM; kept here for clarity.
 */
function ulawDecodeSample(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign ? -magnitude : magnitude;
}

/** 256-entry decode table — mu-law has only 256 possible inputs, so precompute. */
const ULAW_TO_PCM = (() => {
  const t = new Int16Array(256);
  for (let i = 0; i < 256; i++) t[i] = ulawDecodeSample(i);
  return t;
})();

/** Encode one 16-bit sample to mu-law (ITU-T G.711). */
export function ulawEncodeSample(sample: number): number {
  let s = sample;
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;

  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

export function ulawToPcm16(ulaw: Buffer): Int16Array {
  const out = new Int16Array(ulaw.length);
  for (let i = 0; i < ulaw.length; i++) out[i] = ULAW_TO_PCM[ulaw[i]];
  return out;
}

export function pcm16ToUlaw(pcm: Int16Array): Buffer {
  const out = Buffer.allocUnsafe(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = ulawEncodeSample(pcm[i]);
  return out;
}

// ── Resampling (8k <-> 16k, a clean 2x) ──

/**
 * 8k -> 16k. Linear interpolation rather than sample-doubling: doubling holds
 * each sample flat for 125us, which is a zero-order hold — it mirrors energy
 * above 4kHz back into the band as a buzz the model then has to listen through.
 */
export function upsample2x(pcm: Int16Array): Int16Array {
  const n = pcm.length;
  const out = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = pcm[i];
    const b = i + 1 < n ? pcm[i + 1] : a;
    out[i * 2] = a;
    out[i * 2 + 1] = (a + b) >> 1;
  }
  return out;
}

/**
 * 16k -> 8k. Averages each pair instead of dropping every other sample: plain
 * decimation aliases anything above 4kHz down into the voice band, which on a
 * phone line sounds like a lisp/whistle on sibilants. A 2-tap average is a crude
 * but real low-pass, and it's cheap enough to run per frame.
 */
export function downsample2x(pcm: Int16Array): Int16Array {
  const n = pcm.length >> 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = (pcm[i * 2] + pcm[i * 2 + 1]) >> 1;
  return out;
}

// ── Buffer helpers ──

export function bufferToPcm16(buf: Buffer): Int16Array {
  // A Buffer from base64 may sit at a non-even byteOffset, which Int16Array
  // refuses to view; copy when that happens rather than throwing mid-call.
  const usable = buf.length - (buf.length % 2);
  if (buf.byteOffset % 2 === 0) {
    return new Int16Array(buf.buffer, buf.byteOffset, usable / 2);
  }
  const copy = Buffer.from(buf.subarray(0, usable));
  return new Int16Array(copy.buffer, copy.byteOffset, usable / 2);
}

export function pcm16ToBuffer(pcm: Int16Array): Buffer {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.length * 2);
}

// ── The two conversions the bridge actually calls ──

/** Caller audio: Twilio mu-law 8k (base64) -> model PCM16 16k (base64). */
export function twilioToModel(base64Ulaw: string): string {
  const ulaw = Buffer.from(base64Ulaw, "base64");
  const pcm8k = ulawToPcm16(ulaw);
  const pcm16k = upsample2x(pcm8k);
  return pcm16ToBuffer(pcm16k).toString("base64");
}

/** Agent audio: model PCM16 16k (base64) -> Twilio mu-law 8k frames (base64). */
export function modelToTwilioFrames(base64Pcm16: string, carry: Buffer): {
  frames: string[];
  carry: Buffer;
} {
  const pcm16k = bufferToPcm16(Buffer.from(base64Pcm16, "base64"));
  const pcm8k = downsample2x(pcm16k);
  const ulaw = pcm16ToUlaw(pcm8k);

  // The model emits multi-second chunks; Twilio wants 20 ms frames. Keep the
  // remainder for the next delta so we never send a short frame (which clicks).
  const all = carry.length ? Buffer.concat([carry, ulaw]) : ulaw;
  const whole = Math.floor(all.length / TWILIO_FRAME_BYTES);
  const frames: string[] = [];
  for (let i = 0; i < whole; i++) {
    frames.push(all.subarray(i * TWILIO_FRAME_BYTES, (i + 1) * TWILIO_FRAME_BYTES).toString("base64"));
  }
  return { frames, carry: Buffer.from(all.subarray(whole * TWILIO_FRAME_BYTES)) };
}

/** Silence, for padding — mu-law 0xFF is zero amplitude, not 0x00. */
export const ULAW_SILENCE_FRAME = Buffer.alloc(TWILIO_FRAME_BYTES, 0xff).toString("base64");
