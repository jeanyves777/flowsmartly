"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft, ArrowRight, Loader2, Check, Palette, Globe, FileText, Target, MessageSquare, Settings } from "lucide-react";
import type { SiteQuestionnaire } from "@/types/website-builder";

const STEPS = [
  { title: "Business Info", icon: Globe },
  { title: "Goals & Pages", icon: Target },
  { title: "Style & Tone", icon: Palette },
  { title: "Features", icon: Settings },
];

const INDUSTRY_OPTIONS = [
  "Technology", "E-commerce", "Health & Fitness", "Education", "Real Estate",
  "Restaurant/Food", "Legal", "Finance", "Marketing", "Photography",
  "Construction", "Consulting", "Non-profit", "Entertainment", "Travel",
  "Beauty/Salon", "Automotive", "Fashion", "Art & Design", "Other",
];

const GOAL_OPTIONS = [
  { value: "generate-leads", label: "Generate Leads" },
  { value: "sell-products", label: "Sell Products/Services" },
  { value: "portfolio", label: "Showcase Portfolio" },
  { value: "blog", label: "Blog / Content" },
  { value: "membership", label: "Membership / Community" },
  { value: "booking", label: "Booking / Appointments" },
  { value: "informational", label: "Informational / Company" },
];

const PAGE_OPTIONS = [
  "Home", "About", "Services", "Pricing", "Contact", "Blog",
  "Portfolio", "FAQ", "Team", "Testimonials", "Gallery",
];

export default function CreateWebsitePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<SiteQuestionnaire>({
    businessName: "",
    industry: "",
    description: "",
    targetAudience: "",
    goals: [],
    pages: ["Home", "About", "Contact"],
    stylePreference: "modern",
    contentTone: "professional",
    features: ["animations", "contact-form"],
    existingContent: "",
  });

  const updateForm = (field: keyof SiteQuestionnaire, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleArrayItem = (field: "goals" | "pages" | "features", item: string) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(item) ? f[field].filter((i) => i !== item) : [...f[field], item],
    }));
  };

  const handleGenerate = async () => {
    if (!form.businessName.trim()) { setError("Business name is required"); return; }
    setGenerating(true);
    setError("");

    try {
      // Create website first
      const createRes = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.businessName }),
      });
      const { website } = await createRes.json();

      // Generate with AI
      const genRes = await fetch(`/api/websites/${website.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaire: form }),
      });

      if (!genRes.ok) {
        const data = await genRes.json();
        throw new Error(data.error || "Generation failed");
      }

      router.push(`/websites/${website.id}/editor`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setGenerating(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return form.businessName.trim() && form.industry && form.description.trim();
    if (step === 1) return form.goals.length > 0 && form.pages.length > 0;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.push("/websites")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Websites
      </button>

      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Create Your Website with AI</h1>
        <p className="text-muted-foreground text-sm mt-1">Answer a few questions and we'll build your site in seconds</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/10 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tell us about your business</h2>
            <div>
              <label className="text-sm font-medium mb-1 block">Business Name *</label>
              <input type="text" value={form.businessName} onChange={(e) => updateForm("businessName", e.target.value)} placeholder="e.g. Acme Digital Agency" className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Industry *</label>
              <select value={form.industry} onChange={(e) => updateForm("industry", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background">
                <option value="">Select industry...</option>
                {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Describe your business *</label>
              <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={3} placeholder="What does your business do? What makes it special?" className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Target Audience</label>
              <input type="text" value={form.targetAudience} onChange={(e) => updateForm("targetAudience", e.target.value)} placeholder="e.g. Small business owners, 25-45 years old" className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Goals & Pages</h2>
            <div>
              <label className="text-sm font-medium mb-2 block">Website Goals *</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <button key={g.value} onClick={() => toggleArrayItem("goals", g.value)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${form.goals.includes(g.value) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Pages to create *</label>
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map((p) => (
                  <button key={p} onClick={() => toggleArrayItem("pages", p)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${form.pages.includes(p) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Style & Tone</h2>
            <div>
              <label className="text-sm font-medium mb-2 block">Visual Style</label>
              <div className="grid grid-cols-3 gap-2">
                {(["modern", "classic", "bold", "minimal", "playful", "elegant"] as const).map((s) => (
                  <button key={s} onClick={() => updateForm("stylePreference", s)} className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors capitalize ${form.stylePreference === s ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Content Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {(["professional", "casual", "friendly", "luxury", "playful"] as const).map((t) => (
                  <button key={t} onClick={() => updateForm("contentTone", t)} className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors capitalize ${form.contentTone === t ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Additional Features</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "animations", label: "Animations" },
                { value: "contact-form", label: "Contact Form" },
                { value: "member-login", label: "Member Login" },
                { value: "blog", label: "Blog Section" },
                { value: "newsletter", label: "Newsletter Signup" },
                { value: "social-proof", label: "Social Proof" },
                { value: "seo-optimized", label: "SEO Optimized" },
              ].map((f) => (
                <button key={f.value} onClick={() => toggleArrayItem("features", f.value)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${form.features.includes(f.value) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Existing Content (optional)</label>
              <textarea value={form.existingContent} onChange={(e) => updateForm("existingContent", e.target.value)} rows={4} placeholder="Paste any existing copy, taglines, descriptions, or information you want to include..." className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Website</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
