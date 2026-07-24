"use client";

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A crossfading looper for the AI presenter's moving-avatar clip. A raw `<video loop>` hard-cuts
 * at the seam (last frame ≠ first frame) — a visible glitch every loop. This stacks TWO copies of
 * the same clip and hands off across the seam with a short opacity crossfade, so the restart is
 * never noticeable. Muted (the loop is silent); pauses both copies when `playing` is false.
 * [[training-presenter-talking-video]]
 */
export function SeamlessLoop({
  url,
  poster,
  playing = true,
  nonce,
  fit = "cover",
  className,
  style,
}: {
  url: string;
  poster?: string | null;
  playing?: boolean;
  /** bump to hard-restart the loop from the top */
  nonce?: number;
  fit?: "cover" | "contain";
  className?: string;
  style?: CSSProperties;
}) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const [front, setFront] = useState<"a" | "b">("a");
  const fading = useRef(false);
  const XFADE = 0.5; // seconds — matches the CSS opacity transition below

  // start / stop the visible copy with `playing`
  useEffect(() => {
    const a = aRef.current, b = bRef.current;
    if (!a || !b) return;
    if (playing) { (front === "a" ? a : b).play().catch(() => {}); }
    else { a.pause(); b.pause(); }
  }, [playing, front]);

  // reset to the top when the clip changes or a restart is requested
  useEffect(() => {
    fading.current = false;
    setFront("a");
    const a = aRef.current, b = bRef.current;
    if (a) { a.currentTime = 0; if (playing) a.play().catch(() => {}); }
    if (b) { b.pause(); b.currentTime = 0; }
  }, [url, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTime = (which: "a" | "b") => (e: SyntheticEvent<HTMLVideoElement>) => {
    if (which !== front || fading.current || !playing) return;
    const v = e.currentTarget;
    const d = v.duration;
    if (!d || !isFinite(d)) return;
    const fade = Math.min(XFADE, d * 0.3);
    if (v.currentTime >= d - fade) {
      const other = which === "a" ? bRef.current : aRef.current;
      if (!other) return;
      fading.current = true;
      other.currentTime = 0;
      other.play().catch(() => {});
      setFront(which === "a" ? "b" : "a"); // CSS crossfades the two copies
    }
  };

  // the copy that just finished its pass rewinds and waits to be the next hand-off target
  const onEnded = (which: "a" | "b") => (e: SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    v.currentTime = 0;
    if (which === front) {
      // very short clip whose crossfade never armed — just keep it going
      if (playing) v.play().catch(() => {});
    } else {
      v.pause();
      fading.current = false;
    }
  };

  const base = cn("absolute inset-0 h-full w-full [transition:opacity_500ms_linear]", fit === "contain" ? "object-contain" : "object-cover");
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} style={style}>
      <video ref={aRef} src={url} poster={poster ?? undefined} muted playsInline autoPlay preload="auto"
        onTimeUpdate={onTime("a")} onEnded={onEnded("a")}
        className={cn(base, front === "a" ? "opacity-100" : "opacity-0")} />
      <video ref={bRef} src={url} muted playsInline preload="auto"
        onTimeUpdate={onTime("b")} onEnded={onEnded("b")}
        className={cn(base, front === "b" ? "opacity-100" : "opacity-0")} />
    </div>
  );
}
