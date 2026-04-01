"use client";

import { useState, useMemo } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface EmailPreviewProps {
  html: string;
  subject?: string;
  preheader?: string;
}

export function EmailPreview({ html, subject, preheader }: EmailPreviewProps) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

  const srcDoc = useMemo(() => {
    if (!html) return "";
    // Wrap in a container that handles mobile scaling
    return html;
  }, [html]);

  return (
    <div className="flex flex-col flex-1 border rounded-lg overflow-hidden bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        <div className="flex items-center gap-1">
          <Button
            variant={view === "desktop" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("desktop")}
          >
            <Monitor className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={view === "mobile" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("mobile")}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Subject preview */}
      {subject && (
        <div className="px-4 py-2 border-b bg-card">
          <p className="text-sm font-semibold truncate">{subject}</p>
          {preheader && <p className="text-xs text-muted-foreground truncate">{preheader}</p>}
        </div>
      )}

      {/* Email content */}
      <div className="flex-1 flex justify-center p-4 overflow-auto">
        {html ? (
          <div className={cn(
            "transition-all duration-200",
            view === "mobile" ? "w-[375px]" : "w-full max-w-[620px]"
          )}>
            {view === "mobile" && (
              <div className="relative mx-auto" style={{ width: 375 }}>
                {/* Phone frame */}
                <div className="rounded-[2rem] border-4 border-gray-800 dark:border-gray-600 bg-white overflow-hidden shadow-xl">
                  {/* Notch */}
                  <div className="h-6 bg-gray-800 dark:bg-gray-600 flex justify-center items-end pb-1">
                    <div className="w-20 h-1 bg-gray-900 dark:bg-gray-700 rounded-full" />
                  </div>
                  <iframe
                    srcDoc={srcDoc}
                    className="w-full border-0"
                    style={{ height: 500 }}
                    sandbox="allow-same-origin"
                    title="Mobile email preview"
                  />
                </div>
              </div>
            )}
            {view === "desktop" && (
              <iframe
                srcDoc={srcDoc}
                className="w-full border rounded-lg bg-white"
                style={{ minHeight: 500 }}
                sandbox="allow-same-origin"
                title="Desktop email preview"
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground text-sm h-64">
            Add content to see a live preview
          </div>
        )}
      </div>
    </div>
  );
}
