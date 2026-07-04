"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Public-site motion runtime. Boots Lenis smooth-scroll, drives it from the GSAP
 * ticker, and keeps ScrollTrigger in sync. Fully bypassed when the user prefers
 * reduced motion (native scroll, no pinning/scrubbing) and theme-agnostic — it
 * only touches scroll, never colours.
 *
 * Wrap any marketing page tree in <PublicMotionProvider>. The provider exposes
 * whether rich motion is active so children can downgrade gracefully.
 */
const MotionCtx = createContext<{ rich: boolean; lenis: Lenis | null }>({ rich: false, lenis: null });
export const useMarketingMotion = () => useContext(MotionCtx);

let registered = false;

export function PublicMotionProvider({ children }: { children: ReactNode }) {
  const [rich, setRich] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(hover: none)").matches; // skip smooth-scroll on touch (native momentum is better)
    if (prefersReduced) {
      setRich(false);
      return;
    }
    setRich(true);

    const lenis = coarse
      ? null
      : new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.5 });
    lenisRef.current = lenis;

    const onScroll = () => ScrollTrigger.update();
    lenis?.on("scroll", onScroll);

    const raf = (time: number) => lenis?.raf(time * 1000);
    if (lenis) {
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    // Let layout settle, then measure all triggers.
    const settle = window.setTimeout(() => ScrollTrigger.refresh(), 200);

    return () => {
      window.clearTimeout(settle);
      lenis?.off("scroll", onScroll);
      if (lenis) gsap.ticker.remove(raf);
      lenis?.destroy();
      lenisRef.current = null;
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // Recompute trigger positions when the route (and thus the DOM) changes.
  useEffect(() => {
    if (!rich) return;
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(id);
  }, [pathname, rich]);

  return <MotionCtx.Provider value={{ rich, lenis: lenisRef.current }}>{children}</MotionCtx.Provider>;
}
