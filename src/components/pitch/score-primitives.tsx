"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock, Send, Star } from "lucide-react";
import { FlowActionSpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";
import type { Pitch } from "@/lib/pitch/pitch-detail-types";

export function CircularScore({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide">/100</span>
      </div>
    </div>
  );
}

export function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = rating >= i + 1;
        const half = !filled && rating > i;
        return (
          <Star
            key={i}
            className={cn("w-4 h-4", filled || half ? "text-amber-400 fill-amber-400" : "text-muted fill-muted")}
          />
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: Pitch["status"] }) {
  const map: Record<string, { label: string; cls: string; icon: ReactNode }> = {
    PENDING:     { label: "Queued",       cls: "bg-muted text-muted-foreground",   icon: <Clock className="w-3.5 h-3.5" /> },
    RESEARCHING: { label: "Researching",  cls: "bg-brand-500/10 text-brand-700 dark:text-brand-300", icon: <FlowActionSpinner size={14} /> },
    READY:       { label: "Ready",        cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    FAILED:      { label: "Failed",       cls: "bg-red-500/10 text-red-700 dark:text-red-300", icon: <AlertCircle className="w-3.5 h-3.5" /> },
    SENT:        { label: "Sent",         cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: <Send className="w-3.5 h-3.5" /> },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium", s.cls)}>
      {s.icon} {s.label}
    </span>
  );
}
