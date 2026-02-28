"use client";

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVideoStore } from "./use-video-store";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import type { ExportSettings } from "@/lib/video-editor/types";

export function useVideoExport() {
  const { toast } = useToast();

  const startExport = useCallback(
    async (settings: ExportSettings) => {
      const { tracks, clips, project, setExporting } = useVideoStore.getState();

      if (Object.keys(clips).length === 0) {
        toast({ title: "Nothing to export", variant: "destructive" });
        return null;
      }

      setExporting(true, 0);

      try {
        const res = await fetch("/api/ai/video-editor/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tracks,
            clips,
            settings,
            projectName: project.name,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          if (err.code === "INSUFFICIENT_CREDITS") {
            handleCreditError(err);
            return null;
          }
          throw new Error(err.error || "Export failed");
        }

        // Read SSE stream
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result: { url?: string; duration?: number; fileSize?: number } | null = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.status === "error") {
                    throw new Error(data.error || "Export failed");
                  }

                  if (data.progress !== undefined) {
                    setExporting(true, data.progress);
                  }

                  if (data.url) {
                    result = {
                      url: data.url,
                      duration: data.duration,
                      fileSize: data.fileSize,
                    };
                  }
                } catch (e) {
                  if (e instanceof Error && e.message !== "Export failed") {
                    // JSON parse error — ignore
                  } else {
                    throw e;
                  }
                }
              }
            }
          }
        }

        if (result?.url) {
          toast({ title: "Video exported successfully!" });
          return result;
        }

        throw new Error("No output from export");
      } catch (err: unknown) {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        return null;
      } finally {
        setExporting(false, 0);
      }
    },
    [toast]
  );

  return { startExport };
}
