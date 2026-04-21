"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";
import {
  Copy,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  RotateCw,
  RotateCcw,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Ungroup,
  Lock,
  Unlock,
} from "lucide-react";
import { useCanvasStore } from "./hooks/use-canvas-store";
import { useCanvasHistory } from "./hooks/use-canvas-history";

export interface ContextMenuState {
  /** Page-relative coordinates where the menu opens. */
  x: number;
  y: number;
}

interface CanvasContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
}

/**
 * Right-click context menu for canvas objects. Bespoke (not Radix) because
 * the trigger isn't a DOM element — it's whatever Fabric considers the
 * active object after a right-click on the canvas. Positioned absolutely
 * at the click coordinates and clamped to the viewport.
 */
export function CanvasContextMenu({ state, onClose }: CanvasContextMenuProps) {
  const canvas = useCanvasStore((s) => s.canvas);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const { pushState } = useCanvasHistory();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!state) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer slightly so the same click that opened the menu doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [state, onClose]);

  if (!state || !canvas) return null;

  const obj = canvas.getActiveObject?.();

  // Helpers — wrap each action with onClose + pushState so the menu
  // disappears and the action is undoable.
  const run = (fn: () => void | Promise<void>) => async () => {
    try {
      await fn();
      pushState();
      refreshLayers();
      setDirty(true);
      canvas.requestRenderAll();
    } finally {
      onClose();
    }
  };

  const duplicate = run(async () => {
    if (!obj) return;
    const cloned = await obj.clone();
    cloned.set({ left: (obj.left || 0) + 20, top: (obj.top || 0) + 20 });
    cloned.id = `obj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
  });

  const remove = run(() => {
    if (!obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
  });

  const bringToFront = run(() => obj && canvas.bringObjectToFront(obj));
  const bringForward = run(() => obj && canvas.bringObjectForward(obj));
  const sendBackward = run(() => obj && canvas.sendObjectBackwards(obj));
  const sendToBack = run(() => obj && canvas.sendObjectToBack(obj));

  const rotateBy = (deg: number) =>
    run(() => {
      if (!obj) return;
      const cur = obj.angle || 0;
      const next = ((cur + deg) % 360 + 360) % 360;
      obj.rotate(next);
    });
  const flipH = run(() => obj && obj.set("flipX", !obj.flipX));
  const flipV = run(() => obj && obj.set("flipY", !obj.flipY));

  const groupSel = run(async () => {
    if (!obj || obj.type !== "activeSelection") return;
    if (typeof (obj as any).toGroup === "function") {
      (obj as any).toGroup();
    }
  });
  const ungroupSel = run(async () => {
    if (!obj || obj.type !== "group") return;
    if (typeof (obj as any).toActiveSelection === "function") {
      (obj as any).toActiveSelection();
    }
  });

  const toggleLock = run(() => {
    if (!obj) return;
    const next = !obj.selectable; // currently locked → unlock; currently unlocked → lock
    obj.set({ selectable: next, evented: next });
    if (!next) canvas.discardActiveObject();
  });

  // What's allowed depends on the selection
  const isActiveSelection = obj?.type === "activeSelection";
  const isGroup = obj?.type === "group";
  const isLocked = obj && !obj.selectable;
  const hasObject = !!obj;

  // Position — clamp to viewport so the menu never overflows off-screen.
  // Width estimate of 200px / height estimate of 360px is a good heuristic.
  const MENU_W = 220;
  const MENU_H = 380;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const left = Math.min(state.x, vw - MENU_W - 8);
  const top = Math.min(state.y, vh - MENU_H - 8);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left, top, width: MENU_W, zIndex: 1000 }}
      className="rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1"
    >
      {!hasObject ? (
        <div className="px-2.5 py-1.5 text-xs text-muted-foreground">
          Click an object first
        </div>
      ) : (
        <>
          <Item icon={Copy} label="Duplicate" shortcut="⌘D" onClick={duplicate} />
          <Item icon={Trash2} label="Delete" shortcut="Del" onClick={remove} variant="destructive" />
          <Separator />
          <Item icon={ArrowUpToLine} label="Bring to front" onClick={bringToFront} />
          <Item icon={ArrowUp} label="Bring forward" onClick={bringForward} shortcut="]" />
          <Item icon={ArrowDown} label="Send backward" onClick={sendBackward} shortcut="[" />
          <Item icon={ArrowDownToLine} label="Send to back" onClick={sendToBack} />
          <Separator />
          <Item icon={RotateCw} label="Rotate 90° right" onClick={rotateBy(90)} />
          <Item icon={RotateCcw} label="Rotate 90° left" onClick={rotateBy(-90)} />
          <Item icon={FlipHorizontal2} label="Flip horizontal" onClick={flipH} />
          <Item icon={FlipVertical2} label="Flip vertical" onClick={flipV} />
          {(isActiveSelection || isGroup) && (
            <>
              <Separator />
              {isActiveSelection && (
                <Item icon={Group} label="Group" shortcut="⌘G" onClick={groupSel} />
              )}
              {isGroup && (
                <Item icon={Ungroup} label="Ungroup" shortcut="⌘⇧G" onClick={ungroupSel} />
              )}
            </>
          )}
          <Separator />
          <Item
            icon={isLocked ? Unlock : Lock}
            label={isLocked ? "Unlock" : "Lock"}
            onClick={toggleLock}
          />
        </>
      )}
    </div>
  );
}

interface ItemProps {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onClick: () => void;
  variant?: "default" | "destructive";
}

function Item({ icon: Icon, label, shortcut, onClick, variant = "default" }: ItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={
        "w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left rounded-sm transition-colors " +
        (variant === "destructive"
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-accent")
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="text-[10px] font-mono text-muted-foreground/70 ml-auto">{shortcut}</span>
      )}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-border" />;
}
