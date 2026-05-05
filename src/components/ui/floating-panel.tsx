"use client";

import * as React from "react";
import { GripHorizontal, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type FloatingPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  defaultPosition?: Partial<{ x: number; y: number }>;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
};

let floatingPanelZIndex = 80;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getViewportSafePosition = (
  position: { x: number; y: number },
  size: { width: number; height: number }
) => {
  if (typeof window === "undefined") return position;
  return {
    x: clamp(position.x, 8, Math.max(8, window.innerWidth - Math.min(96, size.width / 2))),
    y: clamp(position.y, 8, Math.max(8, window.innerHeight - 72)),
  };
};

const getInitialSize = (defaultSize?: { width: number; height: number }) => {
  if (typeof window === "undefined") {
    return defaultSize || { width: 460, height: 520 };
  }

  const preferred = defaultSize || { width: 460, height: 520 };
  return {
    width: Math.min(preferred.width, window.innerWidth - 24),
    height: Math.min(preferred.height, window.innerHeight - 32),
  };
};

const getInitialPosition = (
  size: { width: number; height: number },
  defaultPosition?: Partial<{ x: number; y: number }>
) => {
  if (typeof window === "undefined") {
    return { x: defaultPosition?.x ?? 24, y: defaultPosition?.y ?? 96 };
  }

  const preferred = {
    x: window.innerWidth - size.width - 24,
    y: 96,
    ...defaultPosition,
  };

  return getViewportSafePosition(preferred, size);
};

export function FloatingPanel({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  className,
  contentClassName,
  defaultPosition,
  defaultSize,
  minSize = { width: 320, height: 260 },
}: FloatingPanelProps) {
  const defaultWidth = defaultSize?.width;
  const defaultHeight = defaultSize?.height;
  const initialSize = React.useMemo(
    () => getInitialSize(defaultSize),
    [defaultWidth, defaultHeight]
  );
  const [size, setSize] = React.useState(initialSize);
  const [position, setPosition] = React.useState(() =>
    getInitialPosition(initialSize, defaultPosition)
  );
  const [zIndex, setZIndex] = React.useState(() => ++floatingPanelZIndex);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const resizeRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);

  const bringToFront = React.useCallback(() => {
    setZIndex(++floatingPanelZIndex);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const safeSize = getInitialSize(defaultSize);
    setSize((current) => ({
      width: Math.min(current.width || safeSize.width, safeSize.width),
      height: Math.min(current.height || safeSize.height, safeSize.height),
    }));
    setPosition((current) => getViewportSafePosition(current, safeSize));
    bringToFront();
  }, [bringToFront, defaultHeight, defaultWidth, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={title}
      aria-modal="false"
      className={cn(
        "fixed left-0 top-0 flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 text-foreground shadow-2xl backdrop-blur-xl",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "dark:border-white/10 dark:bg-neutral-950/95",
        className
      )}
      data-state="open"
      style={{
        width: size.width,
        height: size.height,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        zIndex,
      }}
      onPointerDown={bringToFront}
    >
      <div
        className="flex cursor-move touch-none select-none items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 dark:bg-white/[0.03]"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          bringToFront();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: position.x,
            y: position.y,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const next = {
            x: drag.x + event.clientX - drag.startX,
            y: drag.y + event.clientY - drag.startY,
          };
          setPosition(getViewportSafePosition(next, size));
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-brand-500 to-cyan-400 px-3 text-sm font-bold text-white shadow-sm">
              {icon}
              {title}
            </span>
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>
          {description && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-auto p-4", contentClassName)}>
        {children}
      </div>

      <div
        className="absolute bottom-2 right-2 flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-lg border bg-background/90 text-muted-foreground shadow-sm transition hover:text-foreground"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          bringToFront();
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            width: size.width,
            height: size.height,
          };
        }}
        onPointerMove={(event) => {
          const resize = resizeRef.current;
          if (!resize || resize.pointerId !== event.pointerId) return;
          const maxWidth = typeof window === "undefined" ? 1000 : window.innerWidth - 16;
          const maxHeight = typeof window === "undefined" ? 900 : window.innerHeight - 16;
          setSize({
            width: clamp(resize.width + event.clientX - resize.startX, minSize.width, maxWidth),
            height: clamp(resize.height + event.clientY - resize.startY, minSize.height, maxHeight),
          });
        }}
        onPointerUp={(event) => {
          if (resizeRef.current?.pointerId === event.pointerId) {
            resizeRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
