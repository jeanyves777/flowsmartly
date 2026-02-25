"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Megaphone, Calendar, DollarSign, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PromoteProductModalProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PromoteDefaults {
  name: string;
  headline: string;
  description: string;
  destinationUrl: string;
  mediaUrl: string | null;
  ctaText: string;
}

export function PromoteProductModal({ productId, isOpen, onClose }: PromoteProductModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [defaults, setDefaults] = useState<PromoteDefaults | null>(null);

  // Form state
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("Shop Now");
  const [budget, setBudget] = useState(10);
  const [dailyBudget, setDailyBudget] = useState(0);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (isOpen && productId) {
      setLoading(true);
      fetch(`/api/ecommerce/promote?productId=${productId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            const d = data.data;
            setDefaults(d);
            setHeadline(d.headline);
            setDescription(d.description);
            setCtaText(d.ctaText || "Shop Now");
          }
        })
        .catch(() => toast({ title: "Failed to load product details", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [isOpen, productId]);

  async function handleSubmit() {
    if (!productId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/ecommerce/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          headline,
          description,
          ctaText,
          budget,
          dailyBudget: dailyBudget || undefined,
          startDate,
          endDate: endDate || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Product promoted! Your ad is pending review." });
        onClose();
      } else {
        toast({ title: data.error?.message || "Failed to create promotion", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to create promotion", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Promote Product</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Product Preview */}
            {defaults && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                {defaults.mediaUrl ? (
                  <img
                    src={defaults.mediaUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted" />
                )}
                <div>
                  <p className="font-medium text-sm">{defaults.name.replace("Promote: ", "")}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                    {defaults.destinationUrl}
                  </p>
                </div>
              </div>
            )}

            {/* Ad Content */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">{headline.length}/50</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">{description.length}/200</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Call to Action</label>
                <select
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background"
                >
                  <option>Shop Now</option>
                  <option>Buy Now</option>
                  <option>Learn More</option>
                  <option>Get Yours</option>
                  <option>Order Now</option>
                </select>
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <DollarSign className="inline h-3.5 w-3.5 mr-1" />
                    Total Budget (credits)
                  </label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Math.max(1, parseInt(e.target.value) || 0))}
                    min={1}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Daily Limit (optional)</label>
                  <input
                    type="number"
                    value={dailyBudget || ""}
                    onChange={(e) => setDailyBudget(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="No limit"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <Calendar className="inline h-3.5 w-3.5 mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
              Your ad will appear in the <strong>FlowSmartly Feed</strong> and, when approved,
              on <strong>Google Ads</strong>. It goes through a quick review first.
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !headline.trim() || budget < 1}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Megaphone className="h-4 w-4" />
              )}
              Promote for {budget} credits
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
