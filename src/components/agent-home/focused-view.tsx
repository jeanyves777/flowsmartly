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
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  chat: ReactNode;
  canvas: ReactNode;
  onClose: () => void;
}) {
  const [chatW, setChatW] = useState(404);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

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
      style={{ gridTemplateColumns: collapsed ? "0 0 1fr" : `${chatW}px 6px 1fr` }}
    >
      {/* CHAT column (left) */}
      <div
        className={cn(
          "min-h-0 flex-col border-e border-border bg-card/35",
          "max-md:absolute max-md:inset-0 max-md:z-20",
          mobileChat ? "max-md:flex" : "max-md:hidden",
          collapsed ? "md:hidden" : "md:flex",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.18)]" />
          Agent · <b className="text-foreground">working on this canvas</b>
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
          "min-h-0 flex-1 flex-col",
          mobileChat ? "max-md:hidden" : "max-md:flex",
          "md:flex",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border bg-card/40 px-4 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold leading-tight">{title}</div>
            {subtitle && <div className="truncate text-[11.5px] text-muted-foreground">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" /> Exit
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{canvas}</div>
      </div>

      {/* reopen chat when collapsed (desktop) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Show chat"
          className="absolute left-2.5 top-2.5 z-30 hidden h-9 w-9 place-items-center rounded-[10px] border border-border bg-popover text-muted-foreground shadow-lg hover:text-foreground md:grid"
        >
          <MessageSquare className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* mobile chat toggle */}
      <button
        onClick={() => setMobileChat((v) => !v)}
        className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-border bg-popover px-4 py-2 text-[12.5px] font-semibold shadow-lg md:hidden"
      >
        <MessageSquare className="h-4 w-4" /> {mobileChat ? "Show canvas" : "Open chat"}
      </button>
    </div>
  );
}

/** Placeholder canvas for workspaces whose hands-on view is still being built. */
export function FocusedComingSoon({
  label,
  description,
  items,
  onOpenRoute,
}: {
  label: string;
  description: string;
  items: { label: string; route: string }[];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto w-fit"><FlowLoader size={40} withMark /></div>
        <h3 className="mt-4 text-[17px] font-bold">{label} — focused view</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        <p className="mt-3 text-[12.5px] text-muted-foreground">This hands-on canvas is coming online. Meanwhile, ask the agent on the left, or open a classic tool:</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {items.map((it) => (
            <button key={it.route + it.label} onClick={() => onOpenRoute(it.route)} className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-brand-500/60 hover:text-foreground">{it.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
