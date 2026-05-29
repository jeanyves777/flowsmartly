"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeechPlayer } from "./use-tts";
import { useVoiceRecorder, transcribeAudio } from "./use-voice-recorder";

/**
 * Hands-free conversational voice mode (Claude-style): a continuous loop of
 * LISTEN → THINK → SPEAK → LISTEN. Records each utterance with the mic
 * recorder (VAD auto-stops on silence), transcribes via the self-hosted
 * Whisper service (which AUTO-DETECTS the language, so the user can switch
 * English ⇄ French mid-conversation with no toggler), sends it to the agent,
 * speaks the reply via the self-hosted Supertonic streaming player, then
 * re-arms the mic. The mic is NOT recording while the agent speaks, so it
 * never transcribes its own voice. Zero per-use API cost.
 */
export type ConversationState = "idle" | "listening" | "thinking" | "speaking";

export function useVoiceConversation({
  onUtterance,
}: {
  onUtterance: (text: string, onReply: (replyText: string) => void) => void;
}) {
  const [state, setState] = useState<ConversationState>("idle");
  const activeRef = useRef(false);
  const playerRef = useRef(createSpeechPlayer());
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const recorderRef = useRef<ReturnType<typeof useVoiceRecorder> | null>(null);
  const speakThenListenRef = useRef<(reply: string) => void>(() => {});

  const recorder = useVoiceRecorder({
    onSegment: async (blob) => {
      if (!activeRef.current) return;
      setState("thinking");
      const result = await transcribeAudio(blob);
      if (!activeRef.current) return;
      if (!result?.text) {
        // Nothing intelligible — go back to listening.
        setState("listening");
        void recorderRef.current?.start();
        return;
      }
      onUtteranceRef.current(result.text, (replyText: string) => {
        speakThenListenRef.current(replyText);
      });
    },
  });
  recorderRef.current = recorder;

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
      void recorder.start();
    },
    [recorder],
  );
  speakThenListenRef.current = speakThenListen;

  const stop = useCallback(() => {
    activeRef.current = false;
    setState("idle");
    playerRef.current.stop();
    recorder.release();
  }, [recorder]);

  const start = useCallback(() => {
    if (!recorder.supported || activeRef.current) return;
    activeRef.current = true;
    setState("listening");
    void recorder.start();
  }, [recorder]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    supported: recorder.supported,
    state,
    interim: "",
    analyser: recorder.analyser,
    active: state !== "idle",
    start,
    stop,
    toggle,
  };
}
