"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/* ----------------------------------------------------------------------------
 * Marketing motion primitives. All are theme-agnostic (colours come from the
 * design tokens / brand palette, never hardcoded per theme) and degrade to a
 * static render under prefers-reduced-motion.
 * ------------------------------------------------------------------------- */

type Dir = "up" | "down" | "left" | "right";
const offset: Record<Dir, { x?: number; y?: number }> = {
  up: { y: 28 }, down: { y: -28 }, left: { x: 28 }, right: { x: -28 },
};

/** Fade + slide in once when scrolled into view. */
export function Reveal({
  children, className, delay = 0, dir = "up", as = "div", once = true,
}: {
  children: ReactNode; className?: string; delay?: number; dir?: Dir;
  as?: "div" | "section" | "li" | "span"; once?: boolean;
}) {
  const reduced = useReducedMotion();
  const M = motion[as];
  if (reduced) {
    const Tag = as as "div";
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <M
      className={className}
      initial={{ opacity: 0, ...offset[dir] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </M>
  );
}

/** Stagger children — pair with <Reveal> children for a cascade. */
export function RevealGroup({ children, className, stagger = 0.08 }: { children: ReactNode; className?: string; stagger?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

/** A child of RevealGroup. */
export function RevealItem({ children, className, dir = "up" }: { children: ReactNode; className?: string; dir?: Dir }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, ...offset[dir] }, show: { opacity: 1, x: 0, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}
    >
      {children}
    </motion.div>
  );
}

/** Translate an element on scroll for depth. `speed` >0 moves slower (back), <0 faster (front). */
export function Parallax({ children, className, speed = 0.2 }: { children: ReactNode; className?: string; speed?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 80}px`, `${-speed * 80}px`]);
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/** Pointer-following "magnetic" wrapper for buttons / CTAs. */
export function Magnetic({ children, className, strength = 0.35 }: { children: ReactNode; className?: string; strength?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 18 });
  const y = useSpring(0, { stiffness: 220, damping: 18 });
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

/** Animated aurora blobs behind a section. Subtle in light, vivid in dark/grey. */
export function AuroraBackdrop({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const reduced = useReducedMotion();
  const blob = (style: CSSProperties, anim: boolean, delay = 0): ReactNode => (
    <motion.span
      aria-hidden
      className="absolute rounded-full"
      style={{ mixBlendMode: "screen", ...style }}
      animate={anim ? { x: [0, 30, 0], y: [0, -28, 0], scale: [1, 1.12, 1] } : undefined}
      transition={anim ? { duration: 16, repeat: Infinity, ease: "easeInOut", delay } : undefined}
    />
  );
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden opacity-40 blur-3xl dark:opacity-70", className)}
      style={{ ["--i" as string]: intensity }}
    >
      {blob({ left: "6%", top: "-8%", width: 520, height: 520, background: "radial-gradient(circle, rgba(14,165,233,0.9), transparent 60%)" }, !reduced)}
      {blob({ right: "4%", top: "0%", width: 560, height: 560, background: "radial-gradient(circle, rgba(139,92,246,0.85), transparent 60%)" }, !reduced, -5)}
      {blob({ left: "38%", top: "12%", width: 460, height: 460, background: "radial-gradient(circle, rgba(16,185,129,0.8), transparent 60%)" }, !reduced, -9)}
    </div>
  );
}

/** Infinite horizontal marquee. */
export function Marquee({ items, className, speed = 22 }: { items: ReactNode[]; className?: string; speed?: number }) {
  const reduced = useReducedMotion();
  const row = (
    <div className="flex shrink-0 items-center gap-12 pr-12">
      {items.map((it, i) => <span key={i} className="shrink-0">{it}</span>)}
    </div>
  );
  return (
    <div className={cn("flex overflow-hidden", className)}>
      {reduced ? (
        <div className="flex flex-wrap items-center gap-12">{items.map((it, i) => <span key={i}>{it}</span>)}</div>
      ) : (
        <motion.div className="flex" animate={{ x: ["0%", "-50%"] }} transition={{ duration: speed, repeat: Infinity, ease: "linear" }}>
          {row}{row}
        </motion.div>
      )}
    </div>
  );
}

/** Count-up number when scrolled into view. */
export function Counter({ to, prefix = "", suffix = "", className, duration = 1.4 }: { to: number; prefix?: string; suffix?: string; className?: string; duration?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduced) { setVal(to); return; }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);
  return <span ref={ref} className={className}>{prefix}{val}{suffix}</span>;
}

/** Brand→accent gradient text. */
export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("bg-gradient-to-r from-brand-400 via-emerald-300 to-accent-purple bg-clip-text text-transparent", className)}>
      {children}
    </span>
  );
}

/** Pointer-tilt 3D card. */
export function TiltCard({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(0, { stiffness: 200, damping: 18 });
  const ry = useSpring(0, { stiffness: 200, damping: 18 });
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}
    >
      {children}
    </motion.div>
  );
}
