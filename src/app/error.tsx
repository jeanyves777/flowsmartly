"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorIllustration } from "@/components/illustrations/error-illustration";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error.message, error.stack);
  }, [error]);

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
