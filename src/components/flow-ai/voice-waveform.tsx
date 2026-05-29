"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Live mic waveform for conversational voice mode. Reads frequency data off
 * the AnalyserNode (from useVoiceConversation) and animates a row of bars —
 * the "active listening" effect. Falls back to a gentle idle pulse when there
 * is no analyser (e.g. while the agent is speaking and the mic is paused).
 */
export function VoiceWaveform({
  analyser,
  bars = 5,
  className,
}: {
  analyser: AnalyserNode | null;
  bars?: number;
  className?: string;
}) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser) {
      // Idle pulse when there's no live input.
      let t = 0;
      const idle = () => {
        t += 0.12;
        barRefs.current.forEach((el, i) => {
          if (el) el.style.transform = `scaleY(${0.25 + 0.15 * Math.abs(Math.sin(t + i))})`;
        });
        rafRef.current = requestAnimationFrame(idle);
      };
      rafRef.current = requestAnimationFrame(idle);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const n = barRefs.current.length;
      const step = Math.max(1, Math.floor(data.length / n));
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        const avg = sum / step / 255; // 0..1
        const h = Math.max(0.18, Math.min(1, avg * 1.8));
        const el = barRefs.current[i];
        if (el) el.style.transform = `scaleY(${h})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser]);

  return (
    <div className={cn("flex items-center gap-[3px] h-4", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="w-[3px] h-full rounded-full bg-current origin-center"
          style={{ transform: "scaleY(0.2)" }}
        />
      ))}
    </div>
  );
}
