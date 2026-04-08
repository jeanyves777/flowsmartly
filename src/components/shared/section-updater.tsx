"use client";

import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, Loader2, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Section {
  id: string;
  label: string;
}

interface SectionUpdaterProps {
  /** API base for fetching sections and submitting updates */
  apiBase: string;
  /** Called after successful update (user should rebuild) */
  onUpdated?: () => void;
}

/**
 * AI-powered section updater — dropdown to select section + prompt input.
 * Works for both website and store editors.
 *
 * Usage:
 *   <SectionUpdater apiBase={`/api/websites/${id}/update-section`} onUpdated={rebuild} />
 *   <SectionUpdater apiBase={`/api/ecommerce/store/${id}/update-section`} onUpdated={rebuild} />
 */
export function SectionUpdater({ apiBase, onUpdated }: SectionUpdaterProps) {
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [creditCost, setCreditCost] = useState(5);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState("");
  const [prompt, setPrompt] = useState("");
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Fetch available sections
  useEffect(() => {
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => {
        setSections(d.sections || []);
        setCreditCost(d.creditCost || 5);
        if (d.sections?.length) setSelectedSection(d.sections[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase]);

  const handleUpdate = async () => {
    if (!selectedSection || !prompt.trim()) {
      toast({ title: "Select a section and describe what you want to change", variant: "destructive" });
      return;
    }

    setUpdating(true);
    setResult(null);

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: selectedSection, prompt: prompt.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ type: "success", message: data.message });
        setPrompt("");
        toast({ title: data.message });
        onUpdated?.();
      } else {
        setResult({ type: "error", message: data.error || "Update failed" });
        toast({ title: data.error || "Update failed", variant: "destructive" });
      }
    } catch {
      setResult({ type: "error", message: "Failed to update section" });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading sections...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Section Update
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select a section and describe what you want to change. AI will update the code for you.
        </p>
      </div>

      {/* Section selector */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Section to update</label>
        <div className="relative">
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={updating}
            className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Prompt input */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">What do you want to change?</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={updating}
          placeholder="e.g. Add my hero images as a slideshow, Change the layout to a 3-column grid, Update colors to dark green theme, Add a testimonial carousel..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
        />
      </div>

      {/* Credit cost + Submit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-muted-foreground">Cost:</span>
          <span className="font-semibold">{creditCost} credits</span>
        </div>
        <Button
          onClick={handleUpdate}
          disabled={updating || !prompt.trim() || !selectedSection}
          className="min-w-[140px]"
        >
          {updating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Update Section
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
          result.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
        }`}>
          {result.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <p>{result.message}</p>
        </div>
      )}

      {/* Full-screen overlay during update */}
      {updating && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-lg">AI is updating your {sections.find((s) => s.id === selectedSection)?.label || "section"}...</p>
              <p className="text-sm text-muted-foreground mt-1">This usually takes 10-20 seconds</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
