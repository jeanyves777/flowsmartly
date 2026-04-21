"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2, Sparkles, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AISpinner, AIGenerationLoader } from "@/components/shared/ai-generation-loader";
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

// Agent sometimes HTML-encodes strings inside JSON values — decode for display.
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

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      description: "This permanently removes the plan and all sections. You'll need to regenerate from scratch if you want it back.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/business-plans/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Plan deleted" });
      refresh();
    } else {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <AIGenerationLoader compact currentStep="Loading your business plans…" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-500" />
            Business Plans
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-generated, editable, PDF-exportable. Built from your brand identity.
          </p>
        </div>
        <Button onClick={() => router.push("/tools/business-plan/new")} size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-brand-500" />
            </div>
            <h3 className="font-semibold text-lg">Create your first business plan</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-md mx-auto">
              A comprehensive, investor-grade plan with market analysis, financial projections, and
              interactive charts — generated in about a minute from your brand identity.
            </p>
            <Button onClick={() => router.push("/tools/business-plan/new")} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              Generate business plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="group relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/tools/business-plan/${plan.id}`)}
            >
              {/* Color strip using plan's cover color */}
              <div className="h-2" style={{ background: plan.coverColor }} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2">{decodeEntities(plan.name)}</CardTitle>
                  <Badge variant={plan.status === "published" ? "default" : "outline"} className="shrink-0">
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground mb-4">
                  {plan.industry && <span className="capitalize">{plan.industry.replace(/_/g, " ")}</span>}
                  {plan.stage && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{plan.stage}</span>
                    </>
                  )}
                  {plan.generationCount > 1 && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        rev. {plan.generationCount}
                      </span>
                    </>
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
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(plan.id, decodeEntities(plan.name));
                    }}
                    aria-label={`Delete ${decodeEntities(plan.name)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
