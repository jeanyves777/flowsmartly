"use client";

import { RouteError } from "@/components/shared/route-error";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Design Studio crashed"
      description="The canvas hit an unexpected error. Your last auto-save is safe — click Try again to reload the editor."
    />
  );
}
