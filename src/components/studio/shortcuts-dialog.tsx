"use client";

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  name: string;
  rows: ShortcutRow[];
}

// Detect Mac so the modifier key renders as ⌘ instead of Ctrl. Matched at
// render time inside the component (avoids SSR window access).
function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl";
}

const buildGroups = (mod: string): ShortcutGroup[] => [
  {
    name: "File",
    rows: [
      { keys: [mod, "S"], description: "Save design" },
      { keys: [mod, "⇧", "C"], description: "Copy canvas as image to clipboard" },
    ],
  },
  {
    name: "Edit",
    rows: [
      { keys: [mod, "Z"], description: "Undo" },
      { keys: [mod, "⇧", "Z"], description: "Redo" },
      { keys: [mod, "Y"], description: "Redo (alt)" },
      { keys: [mod, "C"], description: "Copy selected object" },
      { keys: [mod, "V"], description: "Paste object" },
      { keys: [mod, "D"], description: "Duplicate object" },
      { keys: [mod, "A"], description: "Select all objects on the page" },
      { keys: ["Delete"], description: "Delete selected object" },
    ],
  },
  {
    name: "Tools",
    rows: [
      { keys: ["V"], description: "Select tool" },
      { keys: ["H"], description: "Hand / pan tool" },
      { keys: ["T"], description: "Text tool" },
    ],
  },
  {
    name: "Arrange",
    rows: [
      { keys: [mod, "G"], description: "Group selection" },
      { keys: [mod, "⇧", "G"], description: "Ungroup" },
      { keys: ["["], description: "Send backward" },
      { keys: ["]"], description: "Bring forward" },
      { keys: ["Arrows"], description: "Nudge 1 pixel" },
      { keys: ["⇧", "Arrows"], description: "Nudge 10 pixels" },
    ],
  },
  {
    name: "View",
    rows: [
      { keys: [mod, "Scroll"], description: "Zoom in/out" },
      { keys: ["Two-finger pinch"], description: "Pinch-zoom (touch)" },
      { keys: ["?"], description: "Open this cheatsheet" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-border bg-muted/60 text-[11px] font-mono font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const mod = modKey();
  const groups = buildGroups(mod);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <Kbd>?</Kbd> anytime to bring this back up.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-2">
          {groups.map((group) => (
            <div key={group.name}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.name}
              </h3>
              <div className="space-y-1.5">
                {group.rows.map((row) => (
                  <div
                    key={row.description}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-foreground/80">{row.description}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {i < row.keys.length - 1 && (
                            <span className="text-muted-foreground/60 text-[10px]">+</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground border-t pt-3">
          Shortcuts are inactive while editing text or filling a form input.
        </p>
      </DialogContent>
    </Dialog>
  );
}
