"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Check, X, Loader2, RefreshCw, Users, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

const PLANS = ["STARTER", "NON_PROFIT", "PRO", "BUSINESS", "ENTERPRISE"];

const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-gray-100 text-gray-700",
  NON_PROFIT: "bg-emerald-100 text-emerald-700",
  PRO: "bg-violet-100 text-violet-700",
  BUSINESS: "bg-amber-100 text-amber-700",
  ENTERPRISE: "bg-red-100 text-red-700",
};

interface Feature {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  route: string | null;
  isActive: boolean;
  sortOrder: number;
  activeUsers: number;
  planMappings: { planId: string; limitValue: string | null }[];
}

export default function AdminFeaturesPage() {
  const { toast } = useToast();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchFeatures = async () => {
    try {
      const res = await fetch("/api/admin/features");
      const data = await res.json();
      if (data.success) {
        setFeatures(data.data.features);
      }
    } catch {
      toast({ title: "Failed to load features", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Feature[]>();
    for (const f of features) {
      const list = map.get(f.category) || [];
      list.push(f);
      map.set(f.category, list);
    }
    return map;
  }, [features]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Features synced from catalog" });
        fetchFeatures();
      }
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggle = async (featureId: string, isActive: boolean) => {
    try {
      await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", featureId, isActive }),
      });
      setFeatures((prev) =>
        prev.map((f) => (f.id === featureId ? { ...f, isActive } : f))
      );
    } catch {
      toast({ title: "Toggle failed", variant: "destructive" });
    }
  };

  const handlePlanMapping = async (
    featureId: string,
    planId: string,
    enabled: boolean,
    limitValue?: string
  ) => {
    try {
      await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-plan-mapping", featureId, planId, enabled, limitValue }),
      });
      setFeatures((prev) =>
        prev.map((f) => {
          if (f.id !== featureId) return f;
          const mappings = enabled
            ? [...f.planMappings.filter((m) => m.planId !== planId), { planId, limitValue: limitValue || null }]
            : f.planMappings.filter((m) => m.planId !== planId);
          return { ...f, planMappings: mappings };
        })
      );
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feature Management</h1>
          <p className="text-muted-foreground">
            Control which features are available per plan. {features.length} features total.
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
          Sync from Catalog
        </Button>
      </div>

      {/* Plan legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PLANS.map((plan) => (
          <Badge key={plan} className={PLAN_COLORS[plan]}>
            {plan.replace("_", " ")}
          </Badge>
        ))}
      </div>

      {/* Feature table by category */}
      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([category, feats]) => (
          <div key={category} className="bg-card rounded-xl border overflow-hidden">
            <div className="px-6 py-4 bg-muted/50 border-b">
              <h2 className="font-bold capitalize">{category.replace("-", " ")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium">Feature</th>
                    <th className="text-center px-3 py-3 font-medium w-16">Active</th>
                    <th className="text-center px-3 py-3 font-medium w-16">
                      <Users className="w-4 h-4 inline" />
                    </th>
                    {PLANS.map((plan) => (
                      <th key={plan} className="text-center px-3 py-3 font-medium w-24">
                        <span className="text-xs">{plan.replace("_", " ")}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feats.map((feature) => (
                    <tr key={feature.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{feature.name}</div>
                        <div className="text-xs text-muted-foreground">{feature.slug}</div>
                      </td>
                      <td className="text-center px-3 py-3">
                        <button
                          onClick={() => handleToggle(feature.id, !feature.isActive)}
                          className={cn(
                            "transition-colors",
                            feature.isActive ? "text-emerald-500" : "text-muted-foreground"
                          )}
                        >
                          {feature.isActive ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                      </td>
                      <td className="text-center px-3 py-3 text-muted-foreground">
                        {feature.activeUsers}
                      </td>
                      {PLANS.map((plan) => {
                        const mapping = feature.planMappings.find((m) => m.planId === plan);
                        const isEnabled = !!mapping;
                        return (
                          <td key={plan} className="text-center px-3 py-3">
                            <button
                              onClick={() => handlePlanMapping(feature.id, plan, !isEnabled)}
                              className={cn(
                                "w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors",
                                isEnabled
                                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              {isEnabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                            {mapping?.limitValue && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                max {mapping.limitValue}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
