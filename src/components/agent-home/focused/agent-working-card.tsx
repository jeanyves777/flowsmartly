"use client";

import { FlowLoader } from "@/components/shared/flow-loader";

/**
 * AgentWorkingCard — the shared in-view "the agent is working" indicator for a
 * focused surface. Shown the instant a surface action fires the agent, so the
 * view reflects the running task instead of sitting silent while the agent works
 * in the chat pane. [[agent-writes-into-ui-element-not-chat]]
 *
 * `working` = the agent is actively busy (else it's still gathering details in
 * the chat, so we nudge the user to answer there). `compact` renders a slim
 * banner (above existing content); otherwise a centered card for empty states.
 *
 * Arm it on the button click and clear it only when the real result LANDS (an
 * item count grows / a "hasX" flips true) — never on a tool-bump.
 */
export function AgentWorkingCard({ working, title, sub, compact }: {
  working?: boolean;
  /** The active phrase, e.g. "Building your website". "…" is appended while working. */
  title: string;
  /** Optional sub-line override; defaults to a working/idle-aware hint. */
  sub?: string;
  compact?: boolean;
}) {
  const heading = working ? `${title}…` : title;
  const detail = sub ?? (working
    ? "The agent is on it — this will appear here in a moment."
    : "Answer the agent's questions in the chat and it'll land here.");
  if (compact) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] px-4 py-3">
        <FlowLoader size={26} withMark />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold">{heading}</p>
          <p className="text-[11.5px] text-muted-foreground">{detail}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent px-4 py-10 text-center">
      <div className="flex justify-center"><FlowLoader size={40} withMark /></div>
      <p className="mt-4 text-[14px] font-semibold">{heading}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
