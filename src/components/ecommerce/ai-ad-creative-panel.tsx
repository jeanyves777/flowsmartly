"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdCreativeVariant {
  id?: string;
  platform: string;
  headline: string;
  description: string;
  ctaText: string;
}

interface AIAdCreativePanelProps {
  productId: string;
  onSelect: (variant: { headline: string; description: string; ctaText: string }) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  google: "Google Ads",
  facebook: "Facebook / Instagram",
  tiktok: "TikTok",
  flowsmartly: "FlowSmartly Feed",
};

const PLATFORM_COLORS: Record<string, string> = {
  google: "bg-blue-50 border-blue-200 text-blue-800",
  facebook: "bg-indigo-50 border-indigo-200 text-indigo-800",
  tiktok: "bg-pink-50 border-pink-200 text-pink-800",
  flowsmartly: "bg-purple-50 border-purple-200 text-purple-800",
};

export function AIAdCreativePanel({ productId, onSelect }: AIAdCreativePanelProps) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<AdCreativeVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Load existing variants on mount
  useEffect(() => {
    fetch(`/api/ecommerce/ai/ad-creative?productId=${productId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.variants?.length) setVariants(data.variants);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [productId]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ecommerce/ai/ad-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();
      if (res.ok && data.variants) {
        setVariants(data.variants);
        toast({ title: "Ad creatives generated!" });
      } else {
        toast({ title: data.error || "Failed to generate creatives", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to generate creatives", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(idx: number) {
    setSelectedIdx(idx);
    const v = variants[idx];
    onSelect({ headline: v.headline, description: v.description, ctaText: v.ctaText });
  }

  if (fetching) return null;

  return (
    <div className="space-y-3">
      {variants.length === 0 ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Generating..." : "Generate AI Creatives (8 credits)"}
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              AI-Generated Variants
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs text-purple-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Regenerate
            </button>
          </div>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedIdx === i
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 ring-1 ring-purple-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      PLATFORM_COLORS[v.platform] || "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {PLATFORM_LABELS[v.platform] || v.platform}
                  </span>
                  {selectedIdx === i && (
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  )}
                </div>
                <p className="text-sm font-semibold mt-1">{v.headline}</p>
                <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">CTA: {v.ctaText}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
