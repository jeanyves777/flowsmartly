import { Suspense } from "react";
import { AgentHome } from "@/components/agent-home/agent-home";

/**
 * Agent-first home (Phase 1) — optional catch-all so every focused surface has
 * its OWN traceable path: /home, /home/create, /home/brand, /home/settings,
 * /home/profile, etc. AgentHome reads the path segment and opens that surface
 * (and keeps the URL in sync as you navigate). Rendered fullscreen — the
 * dashboard layout skips its chrome for /home and /home/* (see isFullscreenPage).
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <AgentHome />
    </Suspense>
  );
}
