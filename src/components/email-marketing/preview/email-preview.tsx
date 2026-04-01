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

  // For mobile: inject a viewport meta and scale the content
  const mobileSrcDoc = useMemo(() => {
    if (!html) return "";
    // Force the email to render at 375px width inside the iframe
    return html.replace(
      "<head>",
      `<head><meta name="viewport" content="width=375, initial-scale=1"><style>body{max-width:375px!important;margin:0 auto!important;}table[style*="width: 600px"]{width:100%!important;max-width:375px!important;}</style>`
    );
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
          view === "mobile" ? (
            /* Mobile phone frame */
            <div className="mx-auto" style={{ width: 320 }}>
              <div className="rounded-[2.5rem] border-[6px] border-gray-800 dark:border-gray-600 bg-gray-800 dark:bg-gray-600 overflow-hidden shadow-2xl">
                {/* Dynamic island / notch */}
                <div className="h-7 bg-gray-800 dark:bg-gray-600 flex justify-center items-center">
                  <div className="w-24 h-5 bg-black rounded-full" />
                </div>
                {/* Screen */}
                <div className="bg-white overflow-hidden" style={{ width: 308 }}>
                  <iframe
                    srcDoc={mobileSrcDoc}
                    style={{ width: 308, height: 540, border: "none", display: "block" }}
                    sandbox="allow-same-origin"
                    title="Mobile email preview"
                  />
                </div>
                {/* Home bar */}
                <div className="h-5 bg-gray-800 dark:bg-gray-600 flex justify-center items-center">
                  <div className="w-28 h-1 bg-gray-600 dark:bg-gray-400 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            /* Desktop preview */
            <div className="w-full max-w-[620px]">
              <iframe
                srcDoc={html}
                className="w-full border rounded-lg bg-white"
                style={{ minHeight: 500 }}
                sandbox="allow-same-origin"
                title="Desktop email preview"
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center text-muted-foreground text-sm h-64">
            Add content to see a live preview
          </div>
        )}
      </div>
    </div>
  );
}
