"use client";

import { Plus, Copy, Trash2 } from "lucide-react";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { cn } from "@/lib/utils/cn";

export function PagesPanel() {
  const pages = useCanvasStore((s) => s.pages);
  const activePageIndex = useCanvasStore((s) => s.activePageIndex);
  const setActivePageIndex = useCanvasStore((s) => s.setActivePageIndex);
  const addPage = useCanvasStore((s) => s.addPage);
  const deletePage = useCanvasStore((s) => s.deletePage);
  const duplicatePage = useCanvasStore((s) => s.duplicatePage);
  const updateCurrentPageSnapshot = useCanvasStore((s) => s.updateCurrentPageSnapshot);
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);

  const handlePageClick = (index: number) => {
    if (index === activePageIndex) return;
    updateCurrentPageSnapshot();
    setActivePageIndex(index);
  };

  if (pages.length <= 0) return null;

  return (
    <div className="h-[72px] border-t border-border bg-muted/50 flex items-center px-3 gap-2 overflow-x-auto shrink-0">
      {pages.map((page, index) => (
        <div key={page.id} className="relative group shrink-0">
          <button
            onClick={() => handlePageClick(index)}
            className={cn(
              "w-[80px] h-[56px] rounded-md border-2 overflow-hidden bg-white dark:bg-gray-800 transition-colors flex items-center justify-center",
              index === activePageIndex
                ? "border-brand-500 ring-1 ring-brand-500/30"
                : "border-border hover:border-gray-400 dark:hover:border-gray-500"
            )}
            title={`Page ${index + 1}`}
          >
            {page.thumbnailDataUrl ? (
              <img
                src={page.thumbnailDataUrl}
                alt={`Page ${index + 1}`}
                className="w-full h-full object-contain"
                draggable={false}
              />
            ) : (
              <span className="text-xs text-muted-foreground font-medium">
                {index + 1}
              </span>
            )}
          </button>

          {/* Page number badge */}
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] leading-none text-muted-foreground font-medium bg-muted/80 px-1 rounded">
            {index + 1}
          </span>

          {/* Hover action buttons — hidden for viewers */}
          {!isReadOnly && (
            <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateCurrentPageSnapshot();
                  duplicatePage(index);
                }}
                className="w-5 h-5 rounded bg-background border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
                title="Duplicate page"
              >
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
              {pages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(index);
                  }}
                  className="w-5 h-5 rounded bg-background border border-border shadow-sm flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 transition-colors"
                  title="Delete page"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add page button — hidden for viewers */}
      {!isReadOnly && (
        <button
          onClick={() => {
            updateCurrentPageSnapshot();
            addPage(activePageIndex);
          }}
          className="w-[80px] h-[56px] rounded-md border-2 border-dashed border-border hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-colors flex items-center justify-center shrink-0"
          title="Add new page"
        >
          <Plus className="w-5 h-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
