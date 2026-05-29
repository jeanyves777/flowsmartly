"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeechPlayer } from "./use-tts";

/**
 * Hands-free conversational voice mode (like Claude's voice chat): a
 * continuous loop of LISTEN → THINK → SPEAK → LISTEN. Uses the browser's
 * free Web Speech API for STT and a separate getUserMedia stream for a live
 * mic waveform (the "active listening" visual). Speaking is done with the
 * self-hosted Supertonic streaming player; we pause listening while the
 * agent talks so it never transcribes its own voice, then resume.
 *
 * Zero added API cost — STT is the browser, TTS is self-hosted.
 */
export type ConversationState = "idle" | "listening" | "thinking" | "speaking";

type AnyWindow = Window & {
  SpeechRecognition?: new () => unknown;
  webkitSpeechRecognition?: new () => unknown;
  webkitAudioContext?: typeof AudioContext;
};

interface UseVoiceConversationOptions {
  lang?: string;
  /** Send the user's spoken utterance to the agent; call back with the final
   * reply text so we can speak it and resume listening. */
  onUtterance: (text: string, onReply: (replyText: string) => void) => void;
}

export function useVoiceConversation({ lang, onUtterance }: UseVoiceConversationOptions) {
  const [state, setState] = useState<ConversationState>("idle");
  const [interim, setInterim] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const activeRef = useRef(false);
  const listenDesiredRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef(createSpeechPlayer());
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const supported =
    typeof window !== "undefined" &&
    (!!(window as AnyWindow).SpeechRecognition || !!(window as AnyWindow).webkitSpeechRecognition);

  const startRecognition = useCallback(() => {
    if (!activeRef.current || recRef.current) return;
    const w = window as AnyWindow;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new Ctor() as any;
    rec.lang = lang || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0]?.transcript || "";
        if (r.isFinal) finalText += t;
        else interimText += t;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        // We got a complete utterance — stop listening, hand to the agent.
        listenDesiredRef.current = false;
        setInterim("");
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        setState("thinking");
        onUtteranceRef.current(finalText.trim(), (replyText: string) => {
          void speakThenListen(replyText);
        });
      }
    };
    rec.onend = () => {
      recRef.current = null;
      // Browsers end recognition after a pause — if we still want to listen
      // (no utterance captured yet), restart so it stays hands-free.
      if (activeRef.current && listenDesiredRef.current) startRecognition();
    };
    rec.onerror = () => {
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
    }
  }, [lang]);

  const speakThenListen = useCallback(
    async (replyText: string) => {
      if (!activeRef.current) return;
      setState("speaking");
      try {
        await playerRef.current.play(replyText);
      } catch {
        /* ignore TTS failure — still resume listening */
      }
      if (!activeRef.current) return;
      setState("listening");
      listenDesiredRef.current = true;
      startRecognition();
    },
    [startRecognition],
  );

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const w = window as AnyWindow;
      const Ctx = window.AudioContext || w.webkitAudioContext!;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.7;
      src.connect(node);
      setAnalyser(node);
    } catch {
      // Mic blocked for metering — conversation still works without the bars.
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    listenDesiredRef.current = false;
    setState("idle");
    setInterim("");
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    playerRef.current.stop();
    setAnalyser(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!supported || activeRef.current) return;
    activeRef.current = true;
    listenDesiredRef.current = true;
    setState("listening");
    void startMeter();
    startRecognition();
  }, [supported, startMeter, startRecognition]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, state, interim, analyser, active: state !== "idle", start, stop, toggle };
}
