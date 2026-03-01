import { useEffect, useRef, useCallback } from "react";
import { useVideoStore } from "./use-video-store";

/**
 * Playback engine for the video editor.
 * Uses requestAnimationFrame to advance currentTime in real-time.
 * Syncs HTML5 <video> and <audio> elements to the timeline.
 *
 * IMPORTANT: This hook intentionally does NOT subscribe to currentTime
 * to avoid re-rendering the entire component tree 60fps during playback.
 * Components that need currentTime should use useVideoStore directly.
 */
export function useVideoPlayback() {
  const playbackState = useVideoStore((s) => s.playbackState);
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

      const newTime = store.currentTime + (deltaMs / 1000) * store.playbackSpeed;

      if (store.timelineDuration > 0 && newTime >= store.timelineDuration) {
        // Reached end of timeline
        setCurrentTime(store.timelineDuration);
        setPlaybackState("paused");
        return;
      }

      setCurrentTime(newTime);

      // Sync media elements inline (avoid separate effect for perf)
      syncMedia(store, newTime);

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
      // Sync media one last time when paused/stopped
      const store = useVideoStore.getState();
      syncMedia(store, store.currentTime);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playbackState, tick]);

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

  return {
    play,
    pause,
    stop,
    isPlaying: playbackState === "playing",
  };
}

// ─── Media sync (outside component to avoid re-creation) ───

function syncMedia(
  store: ReturnType<typeof useVideoStore.getState>,
  ct: number
) {
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

      // Set volume and playback rate
      el.volume = clip.muted ? 0 : clip.volume;
      el.playbackRate = store.playbackSpeed * (clip.speed || 1);

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
}
