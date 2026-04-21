"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

const INDUSTRIES = [
  "saas", "ecommerce", "fintech", "healthtech", "edtech", "marketing",
  "food", "fashion", "fitness", "real_estate", "consulting", "media", "other",
];

const STAGES: Array<{ value: "idea" | "startup" | "growth" | "established"; label: string; hint: string }> = [
  { value: "idea", label: "Idea", hint: "Still validating — pre-launch" },
  { value: "startup", label: "Startup", hint: "Launched, early customers, <$1M ARR" },
  { value: "growth", label: "Growth", hint: "Product-market fit, scaling revenue" },
  { value: "established", label: "Established", hint: "Mature operation, expanding" },
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

  // Check if the user has a BrandKit before rendering the form. The generate
  // endpoint also enforces this, but surfacing the gate here avoids wasting
  // the user's time filling out the form if they'll just get blocked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand");
        const json = await res.json();
        const brand = json?.data?.brandKit;
        if (!cancelled) {
          if (!brand) {
            setBrandCheck({ hasBrand: false, isComplete: false });
          } else {
            setBrandCheck({ hasBrand: true, isComplete: !!brand.isComplete, name: brand.name });
            // Prefill plan name with brand name if user hasn't typed anything yet
            setForm((f) => (f.name ? f : { ...f, name: `${brand.name} — Business Plan 2026` }));
            // Prefill industry if brand has one we recognize
            if (brand.industry) {
              const key = String(brand.industry).toLowerCase().replace(/\s+/g, "_");
              if (INDUSTRIES.includes(key)) {
                setForm((f) => ({ ...f, industry: key }));
              }
            }
          }
        }
      } catch {
        if (!cancelled) setBrandCheck({ hasBrand: false, isComplete: false });
      }
    })();
  }, []);

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
      toast({ title: "Business plan ready!", description: "Review, edit, export, or share." });
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
        <AIGenerationLoader compact currentStep="Checking your brand identity…" />
      </div>
    );
  }

  // Brand-identity gate — redirect user to build it first.
  if (!brandCheck.hasBrand) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Set up your Brand Identity first
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The business plan is built from your brand kit — name, industry, audience, voice,
              unique value. Complete your Brand Identity and come back.
            </p>
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
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <AIGenerationLoader
          currentStep="Your AI strategist is building the plan…"
          subtitle="Pulling brand identity, running market analysis, projecting financials. Takes about 60-90 seconds."
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-brand-500" />
          New Business Plan
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          13 sections, interactive charts, editable, PDF-exportable. 120 credits.
        </p>
      </div>

      {/* Brand status bar */}
      <Card className="bg-brand-500/5 border-brand-500/20">
        <CardContent className="py-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand-500 shrink-0" />
          <div className="text-sm">
            Building from your brand: <strong>{brandCheck.name || "your Brand Kit"}</strong>
            {!brandCheck.isComplete && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">(incomplete — consider finishing it)</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div>
            <Label htmlFor="name">Plan name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My SaaS Startup 2026"
              className="mt-1.5"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Stage</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm({ ...form, stage: s.value })}
                    className={`text-left p-2 rounded-md border text-xs transition-colors ${
                      form.stage === s.value
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border hover:border-brand-400"
                    }`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-muted-foreground">{s.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="goals">Primary goals (optional)</Label>
            <Textarea
              id="goals"
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              placeholder="e.g. Reach $1M ARR in 18 months, hire 5 engineers, expand to EU."
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="targetAudience">Target audience (optional — overrides brand kit)</Label>
            <Textarea
              id="targetAudience"
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              placeholder="e.g. Mid-market B2B SaaS companies with 50-500 employees, RevOps leaders."
              rows={2}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="fundingNeeded">Funding ask, USD (optional)</Label>
            <Input
              id="fundingNeeded"
              type="number"
              min={0}
              value={form.fundingNeeded}
              onChange={(e) => setForm({ ...form, fundingNeeded: e.target.value })}
              placeholder="500000"
              className="mt-1.5"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button onClick={handleGenerate} size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate plan (120 credits)
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
