import { useEffect } from "react";
import { useVideoStore } from "./use-video-store";
import { undo, redo } from "./use-video-history";

/**
 * Keyboard shortcuts for the video editor.
 * Call this once in the video studio layout.
 */
export function useVideoShortcuts() {
  const {
    playbackState,
    setPlaybackState,
    currentTime,
    selectedClipIds,
    removeClip,
    splitClip,
    duplicateClip,
    timelineZoom,
    setTimelineZoom,
  } = useVideoStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Ctrl shortcuts even in inputs
        if (!e.ctrlKey && !e.metaKey) return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // ─── Ctrl shortcuts ──────────────────────────────
      if (isCtrl) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            return;
          case "y":
            e.preventDefault();
            redo();
            return;
          case "s":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("video-studio:save"));
            return;
          case "d":
            e.preventDefault();
            if (selectedClipIds.length === 1) {
              duplicateClip(selectedClipIds[0]);
            }
            return;
        }
      }

      // ─── Single key shortcuts (not in inputs) ────────
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (playbackState === "playing") {
            setPlaybackState("paused");
          } else {
            setPlaybackState("playing");
          }
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          for (const clipId of selectedClipIds) {
            removeClip(clipId);
          }
          break;
        case "s":
        case "S":
          if (!isCtrl && selectedClipIds.length === 1) {
            e.preventDefault();
            splitClip(selectedClipIds[0], currentTime);
          }
          break;
        case "=":
        case "+":
          e.preventDefault();
          setTimelineZoom(timelineZoom + 10);
          break;
        case "-":
          e.preventDefault();
          setTimelineZoom(timelineZoom - 10);
          break;
        case "Home":
          e.preventDefault();
          useVideoStore.getState().setCurrentTime(0);
          break;
        case "End":
          e.preventDefault();
          useVideoStore
            .getState()
            .setCurrentTime(useVideoStore.getState().timelineDuration);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    playbackState,
    setPlaybackState,
    currentTime,
    selectedClipIds,
    removeClip,
    splitClip,
    duplicateClip,
    timelineZoom,
    setTimelineZoom,
  ]);
}
