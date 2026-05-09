"use client";

import { useEffect } from "react";

export function PublicPostViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      fetch(`/api/posts/${postId}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "view",
          durationMs: 1200,
          path: `/post/${postId}`,
          source: "public-post",
        }),
        signal: controller.signal,
      }).catch(() => undefined);
    }, 900);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [postId]);

  return null;
}
