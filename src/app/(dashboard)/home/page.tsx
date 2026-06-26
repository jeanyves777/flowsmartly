import { Suspense } from "react";
import { AgentHome } from "@/components/agent-home/agent-home";

/**
 * Agent-first home (Phase 1). The post-login front door: the FlowSmartly agent
 * with a workspace rail, rendered fullscreen (the dashboard layout skips its
 * own chrome for this route — see isFullscreenPage). Ported from the approved
 * design/agent-home-mockup-v2.html.
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <AgentHome />
    </Suspense>
  );
}
