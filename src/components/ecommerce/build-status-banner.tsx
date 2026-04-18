"use client";

/**
 * Global build status banner for the ecommerce dashboard.
 *
 * Polls the user's store every 5 seconds. When the store is building,
 * shows a fixed banner at the top of the page with the FlowSmartly
 * branded AI loader. Dismisses automatically when the build completes.
 *
 * Why: Many actions across the ecommerce dashboard (product create,
 * product edit, category update, shipping method change, store settings)
 * trigger a silent store rebuild. Without this banner, users edit
 * something → visit their store → see a blank/old page → get confused.
 */

import { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Status = "idle" | "building" | "done" | "error";

interface StoreStatus {
  id: string;
  buildStatus?: string;
  lastBuildAt?: string | null;
  lastBuildError?: string | null;
}

const POLL_INTERVAL_MS = 5000;
const DONE_AUTO_DISMISS_MS = 4000;

export function BuildStatusBanner() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [dismissed, setDismissed] = useState(false);
  const previousBuildAt = useRef<string | null>(null);
  const sawBuilding = useRef(false);
  const storeId = useRef<string | null>(null);

  // Poll the store build status
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        // Resolve store id once
        if (!storeId.current) {
          const r = await fetch("/api/ecommerce/store");
          if (r.ok) {
            const res = await r.json();
            const s = res.data?.store ?? res.store;
            storeId.current = s?.id || null;
            // Capture the baseline lastBuildAt so we only react to NEW builds
            previousBuildAt.current = s?.lastBuildAt || null;
          }
        }

        if (storeId.current) {
          const r = await fetch(`/api/ecommerce/store/${storeId.current}/generate`);
          if (r.ok) {
            const s: StoreStatus = await r.json();

            if (s.buildStatus === "building") {
              sawBuilding.current = true;
              if (!cancelled) {
                setStatus("building");
                setMessage("Your store is rebuilding — changes will go live in 30-90 seconds. You can keep working.");
                setDismissed(false);
              }
            } else if (s.buildStatus === "built" && sawBuilding.current) {
              // A build we were tracking completed
              sawBuilding.current = false;
              previousBuildAt.current = s.lastBuildAt || null;
              if (!cancelled) {
                setStatus("done");
                setMessage("Your store has been updated and is live!");
                // Auto-dismiss the success state after a few seconds
                setTimeout(() => {
                  if (!cancelled) {
                    setStatus("idle");
                    setMessage("");
                  }
                }, DONE_AUTO_DISMISS_MS);
              }
            } else if (s.buildStatus === "error" && sawBuilding.current) {
              sawBuilding.current = false;
              if (!cancelled) {
                setStatus("error");
                setMessage(
                  s.lastBuildError?.substring(0, 200) ||
                  "Your last rebuild failed. Open Design → Rebuild for details."
                );
              }
            }
          }
        }
      } catch {
        // Silent — network blip, will retry on next poll
      }

      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (status === "idle" || dismissed) return null;

  const bgColor =
    status === "building" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" :
    status === "done" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" :
    "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";

  const textColor =
    status === "building" ? "text-blue-900 dark:text-blue-100" :
    status === "done" ? "text-green-900 dark:text-green-100" :
    "text-red-900 dark:text-red-100";

  return (
    <div className={`sticky top-0 z-50 border-b ${bgColor}`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        {status === "building" && (
          <div className="relative shrink-0">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}
        {status === "done" && (
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600 dark:text-green-400" />
        )}
        {status === "error" && (
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
        )}
        <div className={`flex-1 text-sm ${textColor}`}>
          <span className="font-semibold mr-2">
            {status === "building" && "Updating your store…"}
            {status === "done" && "Store updated!"}
            {status === "error" && "Rebuild failed"}
          </span>
          <span className="opacity-80">{message}</span>
        </div>
        {(status === "done" || status === "error") && (
          <button
            onClick={() => setDismissed(true)}
            className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 shrink-0 ${textColor}`}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
