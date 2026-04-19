"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Shown above the details — defaults to "Something went wrong". */
  title?: string;
  /** Optional human description shown beneath the title. */
  description?: string;
}

/**
 * Standard error UI for a route segment. Next.js passes `error` and `reset`
 * via its `error.tsx` convention; wire them through to this component.
 *
 *   export default function Error(props: { error: Error; reset: () => void }) {
 *     return <RouteError {...props} />;
 *   }
 */
export function RouteError({
  error,
  reset,
  title = "Something went wrong",
  description = "This section hit an unexpected error. The rest of the app is still fine.",
}: RouteErrorProps) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {error?.digest ? (
        <p className="text-xs text-muted-foreground/70">
          Error ID: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}

      {process.env.NODE_ENV !== "production" && error?.message ? (
        <details className="max-w-xl rounded-md border border-border/60 bg-muted/30 p-3 text-left text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Details (dev only)
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px]">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        </details>
      ) : null}

      <Button onClick={reset} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
