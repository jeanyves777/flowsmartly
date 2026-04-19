"use client";

/**
 * Global build status banner for the ecommerce dashboard.
 *
 * Three states:
 * 1. PENDING — user made changes that haven't been published yet.
 *    Amber banner with "Publish Changes" button + confirmation modal.
 * 2. BUILDING — publish was clicked; poll every 5s until done.
 *    Blue banner with spinner.
 * 3. DONE / ERROR — transient success or failure banner.
 *
 * Individual CRUD actions (product edit, category change, shipping tweak,
 * domain link) now just mark the store as pending. The user batches their
 * changes and publishes once via this banner.
 */

import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { AISpinner } from "@/components/shared/ai-generation-loader";

type Status = "idle" | "pending" | "building" | "done" | "error";

interface StoreStatus {
  id: string;
  buildStatus?: string;
  lastBuildAt?: string | null;
  lastBuildError?: string | null;
  hasPendingChanges?: boolean;
  pendingChangeCount?: number;
}

const POLL_INTERVAL_MS = 5000;
const DONE_AUTO_DISMISS_MS = 4000;

export function BuildStatusBanner() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const sawBuilding = useRef(false);
  const storeId = useRef<string | null>(null);

  // Poll the store status
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        if (!storeId.current) {
          const r = await fetch("/api/ecommerce/store");
          if (r.ok) {
            const res = await r.json();
            const s = res.data?.store ?? res.store;
            storeId.current = s?.id || null;
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
              sawBuilding.current = false;
              if (!cancelled) {
                setStatus("done");
                setMessage("Your store has been updated and is live!");
                setTimeout(() => {
                  if (!cancelled) {
                    setStatus(s.hasPendingChanges ? "pending" : "idle");
                    setPendingCount(s.pendingChangeCount || 0);
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
            } else if (s.hasPendingChanges && !sawBuilding.current) {
              // No build in progress; user has pending changes to publish
              if (!cancelled) {
                setStatus("pending");
                setPendingCount(s.pendingChangeCount || 1);
                setMessage("");
                setDismissed(false);
              }
            } else if (!s.hasPendingChanges && status === "pending") {
              // Pending cleared externally
              if (!cancelled) {
                setStatus("idle");
                setMessage("");
              }
            }
          }
        }
      } catch {
        // Silent — retry next poll
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePublish = async () => {
    if (!storeId.current) return;
    setPublishing(true);
    try {
      const r = await fetch(`/api/ecommerce/store/${storeId.current}/publish-changes`, { method: "POST" });
      if (r.ok) {
        setConfirmingPublish(false);
        // The next poll cycle will show the "building" state; set it now for instant feedback.
        setStatus("building");
        setMessage("Starting rebuild… your store will update in 30-90 seconds.");
        sawBuilding.current = true;
      } else {
        const err = await r.json().catch(() => ({}));
        setStatus("error");
        setMessage(err.error || "Failed to publish changes");
        setConfirmingPublish(false);
      }
    } catch {
      setStatus("error");
      setMessage("Network error");
      setConfirmingPublish(false);
    } finally {
      setPublishing(false);
    }
  };

  if (status === "idle" || dismissed) return null;

  const bgColor =
    status === "pending" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" :
    status === "building" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" :
    status === "done" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" :
    "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";

  const textColor =
    status === "pending" ? "text-amber-900 dark:text-amber-100" :
    status === "building" ? "text-blue-900 dark:text-blue-100" :
    status === "done" ? "text-green-900 dark:text-green-100" :
    "text-red-900 dark:text-red-100";

  return (
    <>
      <div className={`sticky top-0 z-50 border-b ${bgColor}`}>
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {status === "pending" && (
            <Upload className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          {status === "building" && (
            <AISpinner className="w-5 h-5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
          )}
          {status === "done" && (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600 dark:text-green-400" />
          )}
          {status === "error" && (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
          )}

          <div className={`flex-1 text-sm ${textColor}`}>
            {status === "pending" && (
              <>
                <span className="font-semibold mr-2">
                  You have {pendingCount} {pendingCount === 1 ? "change" : "changes"} not yet published
                </span>
                <span className="opacity-80">— your live store will stay on the previous version until you publish.</span>
              </>
            )}
            {status === "building" && (
              <>
                <span className="font-semibold mr-2">Publishing your changes…</span>
                <span className="opacity-80">{message}</span>
              </>
            )}
            {status === "done" && (
              <>
                <span className="font-semibold mr-2">Store updated!</span>
                <span className="opacity-80">{message}</span>
              </>
            )}
            {status === "error" && (
              <>
                <span className="font-semibold mr-2">Rebuild failed</span>
                <span className="opacity-80">{message}</span>
              </>
            )}
          </div>

          {status === "pending" && (
            <button
              onClick={() => setConfirmingPublish(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-full transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Publish Now
            </button>
          )}
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

      {/* Publish confirmation modal */}
      {confirmingPublish && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Publish your changes?</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingCount} {pendingCount === 1 ? "change" : "changes"} will go live
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground mb-6">
              <p>
                Your store will rebuild with all your recent edits. This takes 30-90 seconds;
                your current live store stays up the entire time — no downtime.
              </p>
              <p className="text-xs">
                You can keep working in the dashboard while the rebuild runs. The banner above
                will show progress and turn green when done.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setConfirmingPublish(false)}
                disabled={publishing}
                className="px-4 py-2 text-sm font-medium bg-muted hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
              >
                Not yet
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {publishing ? (
                  <>
                    <AISpinner className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Publish Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
