import { useEffect, useRef, useCallback } from "react";
import { useVideoStore } from "./use-video-store";

/**
 * Playback engine for the video editor.
 * Uses requestAnimationFrame to advance currentTime in real-time.
 * Syncs HTML5 <video> and <audio> elements to the timeline.
 */
export function useVideoPlayback() {
  const playbackState = useVideoStore((s) => s.playbackState);
  const currentTime = useVideoStore((s) => s.currentTime);
  const timelineDuration = useVideoStore((s) => s.timelineDuration);
  const setCurrentTime = useVideoStore((s) => s.setCurrentTime);
  const setPlaybackState = useVideoStore((s) => s.setPlaybackState);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // ─── Animation frame loop ──────────────────────────────────

  const tick = useCallback(
    (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaMs = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const store = useVideoStore.getState();
      if (store.playbackState !== "playing") return;

      const newTime = store.currentTime + deltaMs / 1000;

      if (store.timelineDuration > 0 && newTime >= store.timelineDuration) {
        // Reached end of timeline
        setCurrentTime(store.timelineDuration);
        setPlaybackState("paused");
        return;
      }

      setCurrentTime(newTime);
      rafRef.current = requestAnimationFrame(tick);
    },
    [setCurrentTime, setPlaybackState]
  );

  // ─── Start/stop the animation loop ─────────────────────────

  useEffect(() => {
    if (playbackState === "playing") {
      lastFrameTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playbackState, tick]);

  // ─── Sync media elements ───────────────────────────────────

  const syncMediaElements = useCallback(() => {
    const store = useVideoStore.getState();
    const ct = store.currentTime;

    // Find all video/audio elements managed by the editor
    const mediaElements = document.querySelectorAll<
      HTMLVideoElement | HTMLAudioElement
    >("[data-video-editor-clip]");

    for (const el of mediaElements) {
      const clipId = el.dataset.videoEditorClip;
      if (!clipId) continue;

      const clip = store.clips[clipId];
      if (!clip) continue;

      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;
      const isActive = ct >= clipStart && ct < clipEnd;

      if (isActive) {
        // Calculate the media position within the clip
        const mediaTime = clip.trimStart + (ct - clipStart);

        // Sync time if off by more than 100ms
        if (Math.abs(el.currentTime - mediaTime) > 0.1) {
          el.currentTime = mediaTime;
        }

        // Set volume
        el.volume = clip.muted ? 0 : clip.volume;

        // Play if needed
        if (store.playbackState === "playing" && el.paused) {
          el.play().catch(() => {});
        } else if (store.playbackState !== "playing" && !el.paused) {
          el.pause();
        }
      } else {
        // Clip not active, pause it
        if (!el.paused) {
          el.pause();
        }
      }
    }
  }, []);

  // Sync media elements whenever currentTime changes
  useEffect(() => {
    syncMediaElements();
  }, [currentTime, syncMediaElements]);

  // ─── Transport controls ────────────────────────────────────

  const play = useCallback(() => {
    const store = useVideoStore.getState();
    if (store.timelineDuration > 0 && store.currentTime >= store.timelineDuration) {
      setCurrentTime(0);
    }
    setPlaybackState("playing");
  }, [setCurrentTime, setPlaybackState]);

  const pause = useCallback(() => {
    setPlaybackState("paused");
  }, [setPlaybackState]);

  const stop = useCallback(() => {
    setPlaybackState("stopped");
    setCurrentTime(0);
  }, [setPlaybackState, setCurrentTime]);

  const seek = useCallback(
    (time: number) => {
      setCurrentTime(Math.max(0, Math.min(time, timelineDuration)));
    },
    [setCurrentTime, timelineDuration]
  );

  return {
    play,
    pause,
    stop,
    seek,
    isPlaying: playbackState === "playing",
    isPaused: playbackState === "paused",
    isStopped: playbackState === "stopped",
    currentTime,
    duration: timelineDuration,
  };
}
