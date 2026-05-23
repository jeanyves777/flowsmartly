"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

interface AISuggestButtonProps {
  endpoint: string;
  payload: Record<string, unknown>;
  onResult: (value: string) => void;
  label?: string;
  className?: string;
  size?: "xs" | "sm";
  disabled?: boolean;
}

/**
 * Shared "AI suggest" inline trigger. Calls a JSON endpoint that returns
 * `{ success, data: { value } }` and pushes the value into the field via `onResult`.
 * Uses the unified AISpinner while loading and surfaces backend errors honestly.
 */
export function AISuggestButton({
  endpoint,
  payload,
  onResult,
  label = "AI suggest",
  className,
  size = "xs",
  disabled,
}: AISuggestButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleClick() {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { value?: string };
        error?: { message?: string };
      };
      if (!res.ok || body.success === false || !body.data?.value) {
        toast({
          variant: "destructive",
          title: "AI suggestion failed",
          description: body.error?.message || "Try again or fill it manually.",
        });
        return;
      }
      onResult(body.data.value);
    } catch {
      toast({
        variant: "destructive",
        title: "AI suggestion failed",
        description: "Network error. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const sizeClasses = size === "sm"
    ? "h-7 gap-1.5 px-2 text-xs"
    : "h-6 gap-1 px-1.5 text-[11px]";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className={cn(
        "inline-flex items-center rounded-md font-medium text-brand-600 transition-colors hover:bg-brand-500/10 disabled:opacity-50 dark:text-brand-300",
        sizeClasses,
        className,
      )}
    >
      {loading ? <AISpinner size={size === "sm" ? 14 : 12} /> : <Sparkles className={size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3"} />}
      {label}
    </button>
  );
}
