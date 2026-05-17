"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Calendar, FileText, Layers, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIGenerationLoader, FlowActionSpinner } from "@/components/shared/ai-generation-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

interface PlanListItem {
  id: string;
  name: string;
  industry: string | null;
  stage: string | null;
  coverColor: string;
  status: string;
  generationCount: number;
  createdAt: string;
  updatedAt: string;
}

function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export default function BusinessPlanListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business-plans");
      const json = await res.json();
      if (json.success) setPlans(json.plans || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      description: "This permanently removes the plan and all sections.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/business-plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Plan deleted" });
        refresh();
      } else {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <AIGenerationLoader compact currentStep="Loading business plans" />
      </div>
    );
  }

  const readyCount = plans.filter((plan) => plan.status !== "draft").length;
  const revisionCount = plans.reduce((sum, plan) => sum + Math.max(0, plan.generationCount - 1), 0);

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-6 space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-3 gap-1">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              AI business strategist
            </Badge>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <FileText className="h-6 w-6 text-brand-500" />
              Business Plans
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate, edit, export, and share investor-ready plans.
            </p>
          </div>
          <Button onClick={() => router.push("/tools/business-plan/new")} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            New Plan
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10">
              <Sparkles className="h-7 w-7 text-brand-500" />
            </div>
            <h3 className="text-lg font-semibold">Create your first business plan</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              The agent uses your brand identity to build sections, market logic, projections, and charts.
            </p>
            <Button onClick={() => router.push("/tools/business-plan/new")} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              Generate business plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Plans", value: plans.length, icon: Layers },
              { label: "Ready", value: readyCount, icon: FileText },
              { label: "Revisions", value: revisionCount, icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                  <Icon className="mb-2 h-4 w-4 text-sky-500" />
                  <div className="text-2xl font-bold text-foreground">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
                onClick={() => router.push(`/tools/business-plan/${plan.id}`)}
              >
                <div className="h-2" style={{ background: plan.coverColor }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-base">{decodeEntities(plan.name)}</CardTitle>
                    <Badge variant={plan.status === "published" ? "default" : "outline"} className="shrink-0">
                      {plan.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {plan.industry && <span className="capitalize">{plan.industry.replace(/_/g, " ")}</span>}
                    {plan.stage && <span className="capitalize">{plan.stage}</span>}
                    {plan.generationCount > 1 && (
                      <span className="inline-flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        rev. {plan.generationCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(plan.updatedAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(plan.id, decodeEntities(plan.name));
                      }}
                      aria-label={`Delete ${decodeEntities(plan.name)}`}
                    >
                      {deletingId === plan.id ? <FlowActionSpinner size={14} /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
