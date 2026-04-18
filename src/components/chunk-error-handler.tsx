"use client";

import { useEffect } from "react";

/**
 * Window-level handler for ChunkLoadError and failed dynamic imports.
 *
 * React error boundaries catch render-time errors, but many chunk
 * failures surface as unhandled promise rejections when a dynamic
 * import() or preload fails. Those bypass error.tsx entirely.
 *
 * This component attaches global listeners and, on detection, does
 * a one-shot hard reload (gated by sessionStorage to prevent loops).
 *
 * Mount once at the root layout.
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    function isChunkError(err: unknown): boolean {
      if (!err) return false;
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : "";
      return (
        name === "ChunkLoadError" ||
        /Loading chunk/i.test(message) ||
        /Loading CSS chunk/i.test(message) ||
        /ChunkLoadError/i.test(message) ||
        /failed to load script/i.test(message) ||
        /Failed to fetch dynamically imported module/i.test(message)
      );
    }

    function handleRecovery(source: string) {
      if (sessionStorage.getItem("chunk-reload")) return;
      sessionStorage.setItem("chunk-reload", "1");
      console.warn(`[ChunkErrorHandler] Detected chunk error (${source}) — reloading to fetch fresh bundle`);
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

    function onError(event: ErrorEvent) {
      if (isChunkError(event.error) || isChunkError(event.message as unknown)) {
        event.preventDefault();
        handleRecovery("window.error");
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (isChunkError(event.reason)) {
        event.preventDefault();
        handleRecovery("unhandledrejection");
      }
    }

    // Clear the reload guard once the page has mounted successfully
    // (so the NEXT chunk error in a future session can still recover)
    const clearGuard = setTimeout(() => {
      sessionStorage.removeItem("chunk-reload");
    }, 10_000);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      clearTimeout(clearGuard);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
