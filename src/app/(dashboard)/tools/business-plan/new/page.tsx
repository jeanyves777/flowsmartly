"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, DollarSign, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIGenerationLoader, FlowActionSpinner } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

const INDUSTRIES = [
  "saas",
  "ecommerce",
  "fintech",
  "healthtech",
  "edtech",
  "marketing",
  "food",
  "fashion",
  "fitness",
  "real_estate",
  "consulting",
  "media",
  "other",
];

const STAGES: Array<{ value: "idea" | "startup" | "growth" | "established"; label: string; hint: string }> = [
  { value: "idea", label: "Idea", hint: "Validate" },
  { value: "startup", label: "Startup", hint: "Launch" },
  { value: "growth", label: "Growth", hint: "Scale" },
  { value: "established", label: "Established", hint: "Expand" },
];

interface BrandCheck {
  hasBrand: boolean;
  isComplete: boolean;
  name?: string;
}

export default function NewBusinessPlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [brandCheck, setBrandCheck] = useState<BrandCheck | null>(null);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "saas",
    stage: "startup" as "idea" | "startup" | "growth" | "established",
    goals: "",
    targetAudience: "",
    fundingNeeded: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand");
        const json = await res.json();
        const brand = json?.data?.brandKit;
        if (cancelled) return;
        if (!brand) {
          setBrandCheck({ hasBrand: false, isComplete: false });
          return;
        }
        setBrandCheck({ hasBrand: true, isComplete: !!brand.isComplete, name: brand.name });
        setForm((f) => (f.name ? f : { ...f, name: `${brand.name} - Business Plan 2026` }));
        if (brand.industry) {
          const key = String(brand.industry).toLowerCase().replace(/\s+/g, "_");
          if (INDUSTRIES.includes(key)) setForm((f) => ({ ...f, industry: key }));
        }
      } catch {
        if (!cancelled) setBrandCheck({ hasBrand: false, isComplete: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStage = useMemo(() => STAGES.find((stage) => stage.value === form.stage) || STAGES[1], [form.stage]);

  const handleGenerate = async () => {
    if (!form.name.trim() || !form.industry || !form.stage) {
      toast({ title: "Fill the required fields", description: "Name, industry, and stage are required.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/business-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry,
          stage: form.stage,
          goals: form.goals.trim(),
          targetAudience: form.targetAudience.trim(),
          fundingNeeded: form.fundingNeeded ? Number(form.fundingNeeded) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.error?.code === "BRAND_NOT_CONFIGURED") {
          toast({ title: "Brand identity required", description: "Set up your Brand Kit first.", variant: "destructive" });
          router.push("/brand-identity");
          return;
        }
        if (json?.error?.code === "INSUFFICIENT_CREDITS") {
          toast({ title: "Not enough credits", description: json.error.message, variant: "destructive" });
          setGenerating(false);
          return;
        }
        throw new Error(json?.error?.message || "Generation failed");
      }
      toast({ title: "Business plan ready", description: "Review, edit, export, or share." });
      router.push(`/tools/business-plan/${json.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
      setGenerating(false);
    }
  };

  if (brandCheck === null) {
    return (
      <div className="p-8">
        <AIGenerationLoader compact currentStep="Checking brand identity" />
      </div>
    );
  }

  if (!brandCheck.hasBrand) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Brand Identity Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Business plans need your brand name, audience, voice, and offer.</p>
            <Button asChild>
              <Link href="/brand-identity">Set up Brand Identity</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="min-h-[70vh] p-8">
        <div className="mx-auto w-full max-w-2xl">
          <AIGenerationLoader
            currentStep="Building business plan"
            subtitle="Using your brand, market context, projections, and chart structure"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-5 gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-3 gap-1">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              AI plan builder
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">New Business Plan</h1>
            <p className="mt-1 text-sm text-muted-foreground">Structured plan, charts, projections, and editable sections.</p>
          </div>
          <Badge variant="outline">120 credits</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="name">Plan name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Company - Business Plan 2026"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <select
                  id="industry"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fundingNeeded">Funding ask</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fundingNeeded"
                    type="number"
                    min={0}
                    value={form.fundingNeeded}
                    onChange={(e) => setForm({ ...form, fundingNeeded: e.target.value })}
                    placeholder="500000"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Stage</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {STAGES.map((stage) => (
                  <button
                    key={stage.value}
                    type="button"
                    onClick={() => setForm({ ...form, stage: stage.value })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      form.stage === stage.value
                        ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200"
                        : "border-border hover:border-sky-300",
                    )}
                  >
                    <div className="font-semibold">{stage.label}</div>
                    <div className="text-xs text-muted-foreground">{stage.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goals">Primary goals</Label>
              <Textarea
                id="goals"
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                placeholder="Revenue target, launch plan, hiring, market expansion, investor outcome..."
                rows={4}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetAudience">Target audience</Label>
              <Textarea
                id="targetAudience"
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                placeholder="Ideal customers, buyer profile, geography, company size, or niche..."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={handleGenerate} size="lg" className="gap-2" disabled={generating}>
                {generating ? <FlowActionSpinner size={16} /> : <Sparkles className="h-4 w-4" />}
                Generate Plan
              </Button>
              <Button variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-foreground">{brandCheck.name}</div>
                  <p className="text-sm text-muted-foreground">
                    {brandCheck.isComplete ? "Brand identity ready" : "Brand identity is usable but incomplete"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-card p-3">
                  <div className="text-xs text-muted-foreground">Stage</div>
                  <div className="font-semibold">{selectedStage.label}</div>
                </div>
                <div className="rounded-lg bg-card p-3">
                  <div className="text-xs text-muted-foreground">Industry</div>
                  <div className="font-semibold capitalize">{form.industry.replace(/_/g, " ")}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <BarChart3 className="h-4 w-4 text-sky-500" />
                Output
              </h3>
              {["Executive strategy", "Market and audience", "Operations plan", "Financial projections", "Editable charts"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
