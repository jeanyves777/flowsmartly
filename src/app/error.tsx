"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorIllustration } from "@/components/illustrations/error-illustration";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";

/**
 * Detect Next.js chunk-load errors (user's browser has a stale bundle
 * referencing chunk hashes that no longer exist after a deploy).
 * Auto-reload once to fetch the fresh bundle — using sessionStorage
 * to avoid infinite reload loops if the error is something else.
 */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  const name = error.name || "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("ChunkLoadError") ||
    // Webpack / Next.js dynamic import failures after a deploy
    /failed to load script/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg)
  );
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    console.error("[ErrorBoundary]", error.name, error.message, error.stack);

    // Auto-recover from ChunkLoadError: force a hard reload once per session
    if (isChunkLoadError(error)) {
      const already = sessionStorage.getItem("chunk-reload");
      if (!already) {
        sessionStorage.setItem("chunk-reload", "1");
        setAutoReloading(true);
        // Clear caches and reload the current URL
        const reload = () => window.location.reload();
        if ("caches" in window) {
          caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(reload)
            .catch(reload);
        } else {
          reload();
        }
      }
    }
  }, [error]);

  if (autoReloading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-primary mx-auto animate-spin mb-4" />
          <h1 className="text-xl font-semibold mb-2">Updating to the latest version…</h1>
          <p className="text-muted-foreground text-sm">Reloading in a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <ErrorIllustration />
        <h1 className="text-2xl sm:text-3xl font-bold mt-6 mb-3">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-8">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <details className="mb-4 text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Error details
          </summary>
          <pre className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg mt-2 overflow-auto max-h-40">
            {error.message}
          </pre>
        </details>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
