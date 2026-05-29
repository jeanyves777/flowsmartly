"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Core mic recorder for Flow-AI voice. Records ONE voice-activity-bounded
 * segment per start(): it opens the mic, watches the audio level, and once the
 * user has spoken and then gone quiet for `silenceMs`, it stops and hands the
 * captured audio blob to `onSegment`. The blob is sent to Whisper (auto-detects
 * language), so dictation works in any language with no manual toggler.
 *
 * Keeps the mic stream open between segments (for the live waveform + instant
 * re-arm in conversation mode); call release() to fully turn the mic off.
 */
interface UseVoiceRecorderOptions {
  onSegment: (blob: Blob) => void;
  silenceMs?: number;
  maxMs?: number;
  minSpeechMs?: number;
}

type AnyWin = Window & { webkitAudioContext?: typeof AudioContext };

export function useVoiceRecorder({
  onSegment,
  silenceMs = 1100,
  maxMs = 20000,
  minSpeechMs = 300,
}: UseVoiceRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const speechRef = useRef(false);
  const lastVoiceRef = useRef(0);
  const startedRef = useRef(0);
  const discardRef = useRef(false);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as AnyWin).webkitAudioContext!;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const node = ctx.createAnalyser();
      node.fftSize = 512;
      node.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(node);
      analyserRef.current = node;
      setAnalyser(node);
      return stream;
    } catch {
      return null;
    }
  }, []);

  const stopVadLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const finishSegment = useCallback((discard: boolean) => {
    stopVadLoop();
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    discardRef.current = discard;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const release = useCallback(() => {
    finishSegment(true);
    analyserRef.current = null;
    setAnalyser(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }, [finishSegment]);

  /** Cancel the current segment without emitting (keeps mic open). */
  const cancel = useCallback(() => finishSegment(true), [finishSegment]);

  const start = useCallback(async () => {
    if (!supported || recorderRef.current) return;
    const stream = await ensureStream();
    if (!stream) return;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = rec;
    chunksRef.current = [];
    speechRef.current = false;
    discardRef.current = false;
    lastVoiceRef.current = performance.now();
    startedRef.current = performance.now();

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const discard = discardRef.current;
      const spoke = speechRef.current;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (!discard && spoke && blob.size > 0) onSegmentRef.current(blob);
    };
    rec.start();
    setRecording(true);

    const node = analyserRef.current!;
    const buf = new Uint8Array(node.fftSize);
    const loop = () => {
      node.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const d = buf[i] - 128;
        sum += d * d;
      }
      const rms = Math.sqrt(sum / buf.length) / 128; // ~0..1
      const now = performance.now();
      if (rms > 0.045) {
        speechRef.current = true;
        lastVoiceRef.current = now;
      }
      const elapsed = now - startedRef.current;
      const sinceVoice = now - lastVoiceRef.current;
      if (elapsed > maxMs || (speechRef.current && elapsed > minSpeechMs && sinceVoice > silenceMs)) {
        finishSegment(false); // emit
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [supported, ensureStream, finishSegment, maxMs, minSpeechMs, silenceMs]);

  useEffect(() => () => release(), [release]);

  return { supported, recording, analyser, start, cancel, release };
}

/** Send a recorded clip to the self-hosted Whisper proxy. Returns the
 * transcript (and detected language), or null if unavailable / empty. */
export async function transcribeAudio(blob: Blob): Promise<{ text: string; language: string | null } | null> {
  try {
    const fd = new FormData();
    fd.append("audio", blob, "clip.webm");
    const res = await fetch("/api/flow-ai/stt", { method: "POST", body: fd });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string; language?: string | null };
    const text = (data.text || "").trim();
    return text ? { text, language: data.language ?? null } : null;
  } catch {
    return null;
  }
}
