"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type ProductMediaProps = {
  src?: string;
  poster: string;
  alt: string;
  className?: string;
  /** Play when the element enters the viewport (default true for videos). */
  autoPlay?: boolean;
  /** Only play while hovered / focused (surface cards). */
  playOnHover?: boolean;
  /** Caption strip overlaid at the bottom (agent cost / surface label). */
  caption?: string;
  priority?: boolean;
  sizes?: string;
};

/**
 * Unified marketing media tile — image poster always, optional muted looping
 * video that respects reduced-motion and only loads when useful.
 */
export function ProductMedia({
  src,
  poster,
  alt,
  className,
  autoPlay = true,
  playOnHover = false,
  caption,
  priority,
  sizes = "(min-width:1024px) 30vw, 90vw",
}: ProductMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);
  const hasVideo = Boolean(src);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !hasVideo) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "80px", threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasVideo || reduced) return;
    const shouldPlay = playOnHover ? hovering : autoPlay && inView;
    if (shouldPlay) {
      void v.play().catch(() => {});
    } else {
      v.pause();
      if (playOnHover) v.currentTime = 0;
    }
  }, [autoPlay, hasVideo, hovering, inView, playOnHover, reduced]);

  return (
    <div
      ref={rootRef}
      className={cn("relative overflow-hidden bg-muted", className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      {hasVideo && !reduced ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload={inView || hovering ? "metadata" : "none"}
          poster={poster}
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={alt}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <Image
          src={poster}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      )}

      {/* subtle vignette so captions stay readable */}
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-10">
          <p className="text-[11px] font-semibold tracking-wide text-white/95">{caption}</p>
        </div>
      )}
    </div>
  );
}
