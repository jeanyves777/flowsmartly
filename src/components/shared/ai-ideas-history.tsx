"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, Clock, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AISpinner } from "./ai-generation-loader";

interface GeneratedContentItem {
  id: string;
  type: string;
  content: string;
  prompt: string | null;
  createdAt: string;
  isFavorite: boolean;
}

interface AIIdeasHistoryProps {
  /** GeneratedContent type to filter by */
  contentType: string;
  /** Callback when user selects a past idea */
  onSelect: (idea: string) => void;
  /** For array items (ideas, names, tags) vs single string items (topics) */
  mode?: "list" | "single";
  /** Optional className for the trigger button */
  className?: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AIIdeasHistory({ contentType, onSelect, mode = "list", className }: AIIdeasHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<GeneratedContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content-library?type=${contentType}&limit=10`);
      const json = await res.json();
      if (json.success && json.data?.items) {
        setItems(json.data.items);
        // Auto-expand first item if any
        if (json.data.items.length > 0) {
          setExpandedId(json.data.items[0].id);
        }
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [contentType]);

  // Fetch when opened
  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, fetchHistory]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function parseIdeas(content: string): string[] {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === "string") return item;
          if (item?.label) return item.label;
          if (item?.title) return `${item.title}: ${item.description || ""}`;
          return JSON.stringify(item);
        });
      }
      return [content];
    } catch {
      return [content];
    }
  }

  function handleSelect(idea: string) {
    onSelect(idea);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg",
          "border border-border/60 bg-background/80 hover:bg-muted/60",
          "text-muted-foreground hover:text-foreground transition-colors",
          isOpen && "bg-muted/60 text-foreground",
          className
        )}
        title="View past AI suggestions"
      >
        <History className="w-3.5 h-3.5" />
        History
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 max-h-96 overflow-hidden rounded-xl border border-border/60 bg-background shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-500" />
              Past Suggestions
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-80 p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                <AISpinner className="w-4 h-4" />
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <History className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No past suggestions yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Generate some first and they&apos;ll appear here for reuse.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => {
                  const ideas = mode === "list" ? parseIdeas(item.content) : [item.content];
                  const isExpanded = expandedId === item.id;
                  const dateLabel = formatRelativeDate(item.createdAt);

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border/30 overflow-hidden"
                    >
                      {/* Item header */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                      >
                        {mode === "list" ? (
                          isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )
                        ) : null}
                        <span className="flex-1 text-xs font-medium text-foreground truncate">
                          {item.prompt || dateLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {dateLabel}
                        </span>
                      </button>

                      {/* Expanded ideas */}
                      {(isExpanded || mode === "single") && (
                        <div className="px-2 pb-2 space-y-1">
                          {ideas.map((idea, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSelect(idea)}
                              className="w-full text-left px-2.5 py-1.5 text-xs rounded-md hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-400 text-muted-foreground transition-colors line-clamp-2"
                            >
                              {idea}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
