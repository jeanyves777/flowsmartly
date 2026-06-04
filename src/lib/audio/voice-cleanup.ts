/**
 * Shared ffmpeg audio filter chains for making generated speech sound like a
 * clean close-mic recording instead of "recorded in a room."
 *
 * Why this exists: raw TTS (ElevenLabs / OpenAI / xAI) is already dry, but once
 * it's concatenated, mixed under ambient beds, and re-encoded a few times, the
 * voice can lose presence and pick up low-end boom / uneven levels that read as
 * "roomy." These chains restore broadcast-style clarity and consistent loudness.
 *
 * Stock ffmpeg has no true de-reverb, so the strongest lever for model-NATIVE
 * audio (Veo 3 / xAI talking-presenter speech, which bakes in room acoustics) is
 * the generation prompt — see the "dry, close-mic" audio rules in video-studio.
 * VOICE_DEREVERB_FILTER below is a best-effort cleanup for already-roomy audio.
 */

/**
 * Conservative cleanup for OUR own TTS / narration tracks (already clean — we
 * just want presence + consistent level, no artifacts):
 *  - highpass 80Hz   → remove sub-bass rumble / room boom
 *  - acompressor     → even out level so quiet syllables stay present
 *  - loudnorm        → broadcast loudness target (-16 LUFS) for consistent volume
 */
export const VOICE_CLEANUP_FILTER =
  "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=150,loudnorm=I=-16:TP=-1.5:LRA=11";

/**
 * Stronger best-effort cleanup for audio that is ALREADY roomy (e.g. model-native
 * speech). Adds spectral de-noise + a high-shelf-ish band-limit to tame reverb
 * tails on top of the standard chain. Use sparingly — it can dull genuinely clean
 * audio, so prefer the dry/close-mic prompt for native generation.
 *  - highpass 100Hz + lowpass 12kHz → trim the extremes reverb lives in
 *  - afftdn                          → gentle spectral de-noise (lifts floor/hiss)
 *  - acompressor + loudnorm          → presence + consistent level
 */
export const VOICE_DEREVERB_FILTER =
  "highpass=f=100,lowpass=f=12000,afftdn=nf=-25,acompressor=threshold=-18dB:ratio=3.5:attack=5:release=140,loudnorm=I=-16:TP=-1.5:LRA=11";

/**
 * Filter applied to an AMBIENT room-tone bed so it sits FAR back under the voice
 * instead of muddying it: band-limit it (drop the low boom + high air that
 * compete with speech) so any remaining bed reads as subtle atmosphere.
 */
export const AMBIENT_BED_FILTER = "highpass=f=180,lowpass=f=4500";

/**
 * Sanity ceiling for an ambient bed's gain (dB) when voice is present, so the AI
 * (or a stray value) can't push the room tone loud enough to make speech sound
 * roomy. The AI still decides WHEN to use ambient and its relative level; this is
 * only an upper bound on loudness, not a "when" rule.
 */
export const AMBIENT_BED_MAX_GAIN_DB = -24;
