"use client";

import { useCallback, useRef, useState } from "react";
import { useVoiceRecorder, transcribeAudio } from "./use-voice-recorder";

/**
 * Push-to-talk dictation. Records one voice-activity-bounded clip and sends it
 * to the self-hosted Whisper service, which AUTO-DETECTS the spoken language —
 * so dictation works in any language (English, French, …) with no manual
 * toggler. Keeps the same shape the composer already consumes
 * ({ supported, listening, interim, toggle }).
 */
interface UseSpeechRecognitionOptions {
  onFinal?: (transcript: string) => void;
}

export function useSpeechRecognition({ onFinal }: UseSpeechRecognitionOptions = {}) {
  const [status, setStatus] = useState<"idle" | "listening" | "transcribing">("idle");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const recorderRef = useRef<ReturnType<typeof useVoiceRecorder> | null>(null);

  const recorder = useVoiceRecorder({
    onSegment: async (blob) => {
      setStatus("transcribing");
      const result = await transcribeAudio(blob);
      recorderRef.current?.release(); // single utterance — turn the mic off after
      setStatus("idle");
      if (result?.text) onFinalRef.current?.(result.text);
    },
  });
  recorderRef.current = recorder;

  const start = useCallback(() => {
    setStatus("listening");
    void recorder.start();
  }, [recorder]);

  const stop = useCallback(() => {
    recorder.cancel();
    recorder.release();
    setStatus("idle");
  }, [recorder]);

  const toggle = useCallback(() => {
    if (status === "idle") start();
    else stop();
  }, [status, start, stop]);

  return {
    supported: recorder.supported,
    listening: status !== "idle",
    interim: status === "transcribing" ? "Transcribing…" : status === "listening" ? "Listening…" : "",
    start,
    stop,
    toggle,
  };
}
