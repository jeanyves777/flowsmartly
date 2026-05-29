"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper over the browser's built-in Web Speech API (SpeechRecognition).
 * Free, no server, no API key — the zero-cost STT half of Flow-AI voice mode.
 * Works in Chrome/Edge; `supported` is false elsewhere (caller hides the mic).
 */
interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinal?: (transcript: string) => void;
}

// The Web Speech API isn't in the TS DOM lib in all setups; treat as loose.
type AnyWindow = Window & {
  SpeechRecognition?: new () => unknown;
  webkitSpeechRecognition?: new () => unknown;
};

export function useSpeechRecognition({ lang, onFinal }: UseSpeechRecognitionOptions = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const supported =
    typeof window !== "undefined" &&
    (!!(window as AnyWindow).SpeechRecognition || !!(window as AnyWindow).webkitSpeechRecognition);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported || recRef.current) return;
    const w = window as AnyWindow;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new Ctor() as any;
    rec.lang = lang || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current?.(finalText.trim());
      }
    };
    const cleanup = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    rec.onend = cleanup;
    rec.onerror = cleanup;

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      cleanup();
    }
  }, [supported, lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, listening, interim, start, stop, toggle };
}
