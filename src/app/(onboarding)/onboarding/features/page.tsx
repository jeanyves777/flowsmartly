"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Sparkles, Lock, Rss, PenSquare, CalendarDays, Zap, Target, Link2, Palette, Scissors, Crown, Clapperboard, Mic, FolderOpen, Users, Mail, Megaphone, MessageSquare, MessageCircle, Globe, FormInput, FileQuestion, ClipboardList, Briefcase, ShoppingBag, BarChart3, Brain, Truck, FolderKanban, UsersRound, Gift, DollarSign, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

const ICON_MAP: Record<string, React.ElementType> = {
  Rss, PenSquare, CalendarDays, Zap, Target, Link2,
  Palette, Scissors, Crown, Clapperboard, Mic, FolderOpen,
  Users, Mail, Megaphone, MessageSquare, MessageCircle, Globe,
  FormInput, FileQuestion, ClipboardList, Briefcase,
  ShoppingBag, BarChart3, Brain, Truck,
  FolderKanban, UsersRound, Gift, DollarSign, Store, Sparkles, Lock,
};

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  "content": { label: "Content & Social", description: "Create, schedule, and automate your content" },
  "ai-creatives": { label: "AI Creatives", description: "Generate images, videos, and more with AI" },
  "marketing": { label: "Marketing", description: "Reach your audience across channels" },
  "tools": { label: "Tools & Productivity", description: "Forms, surveys, events, and more" },
  "ecommerce": { label: "E-Commerce", description: "Build and manage your online store" },
  "team": { label: "Team & Collaboration", description: "Work together with your team" },
  "monetization": { label: "Monetization", description: "Earn revenue and grow" },
  "analytics": { label: "Analytics", description: "Track your performance" },
};

interface AvailableFeature {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  route: string | null;
  limit: string | null;
}

export default function FeaturesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [plan, setPlan] = useState("STARTER");
  const [availableFeatures, setAvailableFeatures] = useState<AvailableFeature[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlan(data.data.plan);
          setAvailableFeatures(data.data.availableFeatures);
          // Pre-select all available features or previously activated ones
          if (data.data.activatedSlugs.length > 0) {
            setSelectedSlugs(new Set(data.data.activatedSlugs));
          } else {
            // Auto-select all features by default
            setSelectedSlugs(new Set(data.data.availableFeatures.map((f: AvailableFeature) => f.slug)));
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, AvailableFeature[]>();
    for (const f of availableFeatures) {
      const list = map.get(f.category) || [];
      list.push(f);
      map.set(f.category, list);
    }
    return map;
  }, [availableFeatures]);

  const toggle = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSlugs(new Set(availableFeatures.map((f) => f.slug)));
  };

  const deselectAll = () => {
    setSelectedSlugs(new Set());
  };

  const handleSave = async () => {
    if (selectedSlugs.size === 0) {
      toast({ title: "Select at least one feature", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: Array.from(selectedSlugs) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Features activated!", description: `${data.data.activatedCount} features enabled.` });
        router.push("/dashboard");
      } else {
        toast({ title: "Error", description: data.error?.message || "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <AISpinner className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-muted-foreground">Loading your features...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm">
            <Check className="w-4 h-4" />
          </div>
          <span className="text-sm text-muted-foreground">Plan Selected</span>
        </div>
        <div className="w-12 h-px bg-brand-500" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold">
            2
          </div>
          <span className="text-sm font-medium">Select Features</span>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Activate your features
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-2">
          Choose which features you want in your sidebar. Only activated features will show up — keep your workspace clean.
        </p>
        <Badge variant="outline" className="text-sm">
          {plan} Plan — {availableFeatures.length} features available
        </Badge>
      </motion.div>

      {/* Select All / Deselect controls */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {selectedSlugs.size} of {availableFeatures.length} features selected
        </p>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-sm text-brand-500 hover:text-brand-600 font-medium"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={deselectAll}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Feature categories */}
      <div className="space-y-8 mb-10">
        {Array.from(grouped.entries()).map(([category, features]) => {
          const info = CATEGORY_LABELS[category] || { label: category, description: "" };
          const allSelected = features.every((f) => selectedSlugs.has(f.slug));

          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg">{info.label}</h2>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
                <button
                  onClick={() => {
                    if (allSelected) {
                      setSelectedSlugs((prev) => {
                        const next = new Set(prev);
                        features.forEach((f) => next.delete(f.slug));
                        return next;
                      });
                    } else {
                      setSelectedSlugs((prev) => {
                        const next = new Set(prev);
                        features.forEach((f) => next.add(f.slug));
                        return next;
                      });
                    }
                  }}
                  className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <AnimatePresence>
                  {features.map((feature) => {
                    const isSelected = selectedSlugs.has(feature.slug);
                    const Icon = ICON_MAP[feature.icon] || Sparkles;

                    return (
                      <motion.button
                        key={feature.slug}
                        layout
                        onClick={() => toggle(feature.slug)}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                          isSelected
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "border-border hover:border-brand-200 dark:hover:border-brand-800"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-brand-500 text-white"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{feature.name}</span>
                            {feature.limit && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                max {feature.limit}
                              </Badge>
                            )}
                          </div>
                          {feature.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {feature.description}
                            </p>
                          )}
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isSelected
                            ? "bg-brand-500 border-brand-500"
                            : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Save button (sticky bottom) */}
      <div className="sticky bottom-0 py-4 bg-gradient-to-t from-white via-white dark:from-slate-950 dark:via-slate-950">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={() => router.push("/select-plan")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to plans
          </button>
          <Button
            size="lg"
            className="px-10 text-base"
            onClick={handleSave}
            disabled={isSaving || selectedSlugs.size === 0}
          >
            {isSaving ? (
              <>
                <AISpinner className="w-4 h-4 animate-spin mr-2" />
                Activating...
              </>
            ) : (
              <>
                Activate {selectedSlugs.size} Features
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
