"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Imperative confirmation dialog. Replaces `window.confirm()` with a themed
 * AlertDialog that returns a Promise<boolean>.
 *
 * Usage:
 *   const ok = await confirmDialog({
 *     title: "Delete campaign?",
 *     description: "This cannot be undone.",
 *     confirmText: "Delete",
 *     variant: "destructive",
 *   });
 *   if (!ok) return;
 *
 * Requires <ConfirmDialogHost /> mounted once in the layout tree.
 */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Visual variant of the confirm button — destructive = red. */
  variant?: "default" | "destructive";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type Listener = (state: PendingConfirm | null) => void;

let listener: Listener | null = null;
let queue: PendingConfirm[] = [];

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const entry: PendingConfirm = { ...options, resolve };
    if (listener) {
      listener(entry);
    } else {
      // Host not mounted yet — queue until it is.
      queue.push(entry);
    }
  });
}

export function ConfirmDialogHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    listener = (entry) => setCurrent(entry);
    // Flush any queued confirms that arrived before the host mounted.
    if (queue.length > 0) {
      const [first, ...rest] = queue;
      queue = rest;
      setCurrent(first);
    }
    return () => {
      listener = null;
    };
  }, []);

  const close = (value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setCurrent(null);
    // Serve any queued confirms next.
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      queue = rest;
      setTimeout(() => setCurrent(next), 0);
    }
  };

  if (!current) return null;

  const confirmText = current.confirmText ?? "Confirm";
  const cancelText = current.cancelText ?? "Cancel";
  const variant = current.variant ?? "default";

  return (
    <AlertDialog open onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current.title}</AlertDialogTitle>
          {current.description ? (
            <AlertDialogDescription>{current.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
