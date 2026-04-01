"use client";

import { X, Sparkles, Clock, Check, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface OptimizationData {
  subjectVariants: string[];
  suggestedSendTime?: string;
  contentSuggestions: string[];
}

interface OptimizationPanelProps {
  data: OptimizationData;
  currentSubject: string;
  onApplySubject: (subject: string) => void;
  onClose: () => void;
}

export function OptimizationPanel({ data, currentSubject, onApplySubject, onClose }: OptimizationPanelProps) {
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-500/10 to-brand-500/10 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold">AI Optimization Suggestions</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Subject Line Variants */}
        {data.subjectVariants && data.subjectVariants.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              Subject Line Variants
            </h4>
            <div className="space-y-1.5">
              {data.subjectVariants.map((variant, i) => {
                const isCurrentSubject = variant === currentSubject;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg border hover:border-brand-300 transition-colors group"
                  >
                    <p className="text-sm flex-1">{variant}</p>
                    {isCurrentSubject ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        <Check className="w-3 h-3 mr-0.5" /> Current
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onApplySubject(variant)}
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Suggestions */}
        {data.contentSuggestions && data.contentSuggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Content Tips
            </h4>
            <ul className="space-y-1.5">
              {data.contentSuggestions.map((suggestion, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2 p-2 bg-muted/50 rounded-lg">
                  <span className="text-brand-500 shrink-0">-</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Send Time */}
        {data.suggestedSendTime && (
          <div className="flex items-center gap-2 p-2.5 bg-blue-500/10 rounded-lg">
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs font-medium">Best Send Time</p>
              <p className="text-xs text-muted-foreground">{data.suggestedSendTime}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
