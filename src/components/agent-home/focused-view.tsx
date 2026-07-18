"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, MessageSquare, ChevronLeft, type LucideIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Focused-view split shell — the locked WS2 layout. Stays inside the agent shell
 * (rail + topbar remain). Chat lives on the LEFT (draggable + collapsible); the
 * workspace + its own controls live on the RIGHT. Opens only on explicit user
 * action. On mobile it falls back to a Chat/Canvas overlay toggle.
 */
export function FocusedView({
  title,
  subtitle,
  icon: Icon,
  chat,
  canvas,
  onClose,
  headerActions,
  agentBusy,
  revealChat,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  chat: ReactNode;
  canvas: ReactNode;
  onClose: () => void;
  /** Optional controls rendered in the surface header, next to Exit. */
  headerActions?: ReactNode;
  /** True while the agent is actively working — drives the live status indicator. */
  agentBusy?: boolean;
  /** Bump to force the mobile chat overlay open (e.g. after seeding the composer). */
  revealChat?: number;
}) {
  const [chatW, setChatW] = useState(404);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // A seeded composer must become visible on mobile — open the chat overlay.
  useEffect(() => {
    if (revealChat) setMobileChat(true);
  }, [revealChat]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !wrap.current) return;
      const left = wrap.current.getBoundingClientRect().left;
      setChatW(Math.max(300, Math.min(640, e.clientX - left)));
    };
    const up = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  return (
    <div
      ref={wrap}
      className="relative flex min-h-0 flex-1 md:grid"
      style={{ gridTemplateColumns: collapsed ? "1fr" : `${chatW}px 6px 1fr` }}
    >
      {/* CHAT column (left) */}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-col border-e border-border bg-card/35",
          "max-md:absolute max-md:inset-0 max-md:z-20",
          mobileChat ? "max-md:flex" : "max-md:hidden",
          collapsed ? "md:hidden" : "md:flex",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          {agentBusy ? (
            <><FlowLoader size={13} /> Agent · <b className="text-foreground">working…</b></>
          ) : (
            <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.18)]" /> Agent · <b className="text-foreground">ready</b></>
          )}
          <div className="ms-auto flex items-center gap-3">
            <button onClick={() => setCollapsed(true)} className="hidden items-center gap-1 hover:text-foreground md:inline-flex" title="Collapse chat">
              <ChevronLeft className="h-4 w-4" /> collapse
            </button>
            <button onClick={() => setMobileChat(false)} className="hover:text-foreground md:hidden" aria-label="Back to canvas">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
      </div>

      {/* draggable splitter */}
      {!collapsed && (
        <div
          onMouseDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }}
          onDoubleClick={() => setCollapsed(true)}
          className="hidden cursor-col-resize bg-border transition-colors hover:bg-brand-500/60 md:block"
          title="Drag to resize · double-click to collapse"
        />
      )}

      {/* WORKSPACE (right) */}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          mobileChat ? "max-md:hidden" : "max-md:flex",
          "md:flex",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-4">
          {collapsed && (
            <button onClick={() => setCollapsed(false)} title="Show chat" className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-border text-muted-foreground hover:text-foreground" aria-label="Show chat">
              <MessageSquare className="h-[18px] w-[18px]" />
            </button>
          )}
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold leading-tight">{title}</div>
            {/* the tagline is noise on a phone — only show it once there's room */}
            {subtitle && <div className="hidden truncate text-[11.5px] text-muted-foreground sm:block">{subtitle}</div>}
          </div>
          {/* On a PHONE the controls flow inline next to the (truncating) title so
              the header doesn't waste a whole empty row on the title alone. In the
              sm–lg split view the chat panel narrows the column, so there the
              cluster still drops to its own full-width row; lg+ goes inline again. */}
          <div className="flex w-auto flex-wrap items-center justify-end gap-2 sm:w-full lg:ms-auto lg:w-auto">
            {/* Mode switches / view controls sit at the left of the cluster. */}
            {headerActions}
            {/* Surfaces (e.g. Pitch Studio) portal their own toolbar controls here,
                so there's ONE header row instead of a duplicate title bar below. */}
            <div id="fv-header-slot" className="flex flex-wrap items-center justify-end gap-2 empty:hidden" />
            {/* Chat access lives in the header on a phone, so the floating trigger
                never covers a surface's own bottom control bar. */}
            {mobileChat ? null : (
              <button onClick={() => setMobileChat(true)} title="Open chat" aria-label="Open chat" className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-border text-muted-foreground hover:text-foreground md:hidden">
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" /> Exit
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{canvas}</div>
      </div>

      {/* The mobile chat toggle now lives in the header (above), so it can never
          cover a surface's own bottom control bar. */}
    </div>
  );
}

/** Placeholder canvas for workspaces whose hands-on view is still being built. */
export function FocusedComingSoon({
  label,
  description,
  items,
  onAsk,
}: {
  label: string;
  description: string;
  items: { label: string; route: string }[];
  /** Drive the agent for an item — the new design never deep-links to legacy. */
  onAsk: (label: string) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto w-fit"><FlowLoader size={40} withMark /></div>
        <h3 className="mt-4 text-[17px] font-bold">{label} — focused view</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        <p className="mt-3 text-[12.5px] text-muted-foreground">This hands-on canvas is coming online. Meanwhile, ask the agent to get you started:</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {items.map((it) => (
            <button key={it.route + it.label} onClick={() => onAsk(it.label)} className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-brand-500/60 hover:text-foreground">{it.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
