import { Suspense } from "react";
import { FlowAIShell } from "@/components/flow-ai/flow-ai-shell";

/**
 * FlowAI page (Phase 2A redesign).
 *
 * Lean text-only conversational assistant. Images and videos moved to
 * Studio AI (/studio/create) — FlowAI is now strictly a writing /
 * thinking partner. Renders as a fullscreen overlay (mirrors Studio
 * Create Chat) so it covers the dashboard chrome and uses the full
 * viewport — no top nav crowding, no side nav stealing real estate.
 *
 * See docs/superpowers/specs/2026-04-26-studio-create-chat-design.md
 * for the chat-shell pattern this mirrors.
 */
export default function FlowAIPage() {
  return (
    <Suspense fallback={null}>
      <FlowAIShell />
    </Suspense>
  );
}
