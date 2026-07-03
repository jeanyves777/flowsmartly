"use client";

import { useCallback, useEffect, useState } from "react";
import { Wand2, Save, RotateCcw, Play, Plus, X, ArrowUp, ArrowDown, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Provider = "xai" | "openai" | "gemini";
interface Step { provider: Provider; model: string }
interface Recipe { fullBleed: boolean; premiumPolish: boolean; enforceExactCopy: boolean; singleLogo: boolean }
type Role = "design_generate" | "premium" | "design_edit" | "bulk_multi";
interface Policy { chains: Partial<Record<Role, Step[]>>; recipe: Recipe }
type Catalog = Record<Provider, { id: string; label: string }[]>;

const ROLE_META: { role: Role; title: string; blurb: string }[] = [
  { role: "design_generate", title: "Standard designs", blurb: "Campaign posts, Studio Create, automations. Primary = first in the list; the rest are fallbacks." },
  { role: "premium", title: "Premium designs", blurb: "Explicit Premium-tier requests. Sharpest typography." },
  { role: "design_edit", title: "Edits", blurb: "Editing an existing design/image (needs an image-capable model)." },
  { role: "bulk_multi", title: "Bulk / multi-image", blurb: "Story-ad slideshows, narration stills — keep it cheap." },
];
const PROVIDER_LABEL: Record<Provider, string> = { xai: "xAI", openai: "OpenAI", gemini: "Google" };
const RECIPE_META: { key: keyof Recipe; label: string; blurb: string }[] = [
  { key: "fullBleed", label: "Full-bleed / anti-card", blurb: "Design fills the canvas edge-to-edge — never a card floating on another background." },
  { key: "premiumPolish", label: "Premium polish", blurb: "Stripe/Linear-grade depth, glassmorphism, 2K sharpness — lifts every provider to the bar." },
  { key: "enforceExactCopy", label: "Exact copy", blurb: "Render the exact words — no misspelling, duplication, or invented text." },
  { key: "singleLogo", label: "Single real logo", blurb: "Model draws NO brand mark; the real logo composites exactly once (kills duplicate logos)." },
];

export default function ImagePipelinePage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [defaults, setDefaults] = useState<Policy | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [availability, setAvailability] = useState<Record<Provider, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/admin/image-pipeline").then((r) => r.json()).catch(() => null);
    if (j?.success) {
      setPolicy(j.data.policy);
      setDefaults(j.data.defaults);
      setCatalog(j.data.catalog);
      setAvailability(j.data.availability);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const chainFor = (role: Role): Step[] => policy?.chains?.[role] ?? [];
  const setChain = (role: Role, steps: Step[]) =>
    setPolicy((p) => (p ? { ...p, chains: { ...p.chains, [role]: steps } } : p));

  const move = (role: Role, i: number, dir: -1 | 1) => {
    const steps = [...chainFor(role)];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setChain(role, steps);
  };
  const removeStep = (role: Role, i: number) => setChain(role, chainFor(role).filter((_, k) => k !== i));
  const updateStep = (role: Role, i: number, patch: Partial<Step>) => {
    const steps = chainFor(role).map((s, k) => (k === i ? { ...s, ...patch } : s));
    setChain(role, steps);
  };
  const addStep = (role: Role) => {
    if (!catalog) return;
    const prov: Provider = "xai";
    setChain(role, [...chainFor(role), { provider: prov, model: catalog[prov][0].id }]);
  };

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    const j = await fetch("/api/admin/image-pipeline", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy }),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (j?.success) { setPolicy(j.data.policy); setSavedAt(Date.now()); }
  };
  const resetDefaults = () => defaults && setPolicy(JSON.parse(JSON.stringify(defaults)));

  if (loading || !policy || !catalog || !availability) {
    return <div className="grid h-64 place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Wand2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold">Image Pipeline — Control Hub</h1>
          <p className="text-[13px] text-muted-foreground">Provider chains per tier + the art-direction recipe. Changes hot-swap the live pipeline (no deploy).</p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <button onClick={resetDefaults} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="h-4 w-4" /> Reset</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </header>

      {savedAt && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saved — the live pipeline now uses this policy.</div>}

      {/* provider availability */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
          <span key={p} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${availability[p] ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-500"}`}>
            {availability[p] ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {PROVIDER_LABEL[p]} {availability[p] ? "key set" : "no key"}
          </span>
        ))}
      </div>

      {/* recipe toggles */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 text-[14px] font-bold">Art-direction recipe</h2>
        <p className="mb-3 text-[12.5px] text-muted-foreground">The quality layer applied to every generation. Proven in the July-2026 bake-off to lift all providers to the gpt-image bar.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {RECIPE_META.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40">
              <input type="checkbox" checked={policy.recipe[r.key]} onChange={(e) => setPolicy((p) => (p ? { ...p, recipe: { ...p.recipe, [r.key]: e.target.checked } } : p))} className="mt-0.5 h-4 w-4 accent-brand-500" />
              <span className="min-w-0"><span className="block text-[13px] font-semibold">{r.label}</span><span className="block text-[11.5px] text-muted-foreground">{r.blurb}</span></span>
            </label>
          ))}
        </div>
      </section>

      {/* per-role chains */}
      <section className="space-y-4">
        {ROLE_META.map(({ role, title, blurb }) => (
          <div key={role} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[14px] font-bold">{title}</h2>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">{role}</code>
            </div>
            <p className="mb-3 text-[12.5px] text-muted-foreground">{blurb}</p>
            <div className="space-y-2">
              {chainFor(role).map((step, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${i === 0 ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground"}`}>{i === 0 ? "Primary" : `Fallback ${i}`}</span>
                  <select value={step.provider} onChange={(e) => { const prov = e.target.value as Provider; updateStep(role, i, { provider: prov, model: catalog[prov][0].id }); }} className="rounded-md border border-input bg-background px-2 py-1 text-[12.5px]">
                    {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
                  </select>
                  <select value={step.model} onChange={(e) => updateStep(role, i, { model: e.target.value })} className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-[12.5px]">
                    {(catalog[step.provider] || []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    {!(catalog[step.provider] || []).some((m) => m.id === step.model) && <option value={step.model}>{step.model}</option>}
                  </select>
                  <div className="ms-auto flex items-center gap-1">
                    <button onClick={() => move(role, i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(role, i, 1)} disabled={i === chainFor(role).length - 1} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeStep(role, i)} disabled={chainFor(role).length <= 1} className="grid h-7 w-7 place-items-center rounded-md border border-border text-rose-500 hover:bg-rose-500/10 disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addStep(role)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add fallback</button>
          </div>
        ))}
      </section>

      <TestConsole catalog={catalog} recipe={policy.recipe} />
    </div>
  );
}

// ── Live test console ──
function TestConsole({ catalog, recipe }: { catalog: Catalog; recipe: Recipe }) {
  const SAMPLE = `Design a premium social media marketing flyer for "FlowSmartly", an all-in-one AI growth platform (SaaS).
HEADER: brand name lockup top-left + a small pill tag "AI-POWERED GROWTH WORKSPACE".
HERO: a realistic app-dashboard mockup on a laptop + phone (analytics charts, content calendar), floating with a soft glow.
HEADLINE: "Create, Sell, and Grow with AI".
SUBHEAD: "Run content, commerce, local listings, customer messages, and reporting from one focused workspace."
FEATURE ROW: 4 chips with line-icons: "AI Studio", "Social Calendar", "Email & SMS", "Analytics".
CTA: a bright rounded "Try for free" button + tiny "No credit card required".
FOOTER: a brand-colored bar with "flowsmartly.com".
Brand palette: deep indigo/blue, electric blue, warm orange accent.`;
  const [prompt, setPrompt] = useState(SAMPLE);
  const [size, setSize] = useState("1024x1024");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ label: string; dataUri?: string; error?: string; ms: number; ok: boolean }[] | null>(null);
  const [targets, setTargets] = useState<Record<Provider, boolean>>({ xai: true, gemini: true, openai: true });

  const run = async () => {
    setRunning(true); setResults(null);
    const tgs = (Object.keys(targets) as Provider[]).filter((p) => targets[p]).map((p) => ({ provider: p, model: catalog[p][0].id }));
    const j = await fetch("/api/admin/image-pipeline/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size, targets: tgs, recipe, hasLogo: false }),
    }).then((r) => r.json()).catch(() => null);
    setRunning(false);
    if (j?.success) setResults(j.data.results);
    else setResults([{ label: "error", error: j?.error?.message || "test failed", ms: 0, ok: false }]);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-1 text-[14px] font-bold">Live test — compare providers</h2>
      <p className="mb-3 text-[12.5px] text-muted-foreground">Runs the brief through each checked provider (primary model) with the current recipe applied. Admin-only, no user credits charged.</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="w-full resize-y rounded-lg border border-input bg-background p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-[12.5px]">
          <option value="1024x1024">Square 1:1</option>
          <option value="1024x1536">Portrait 4:5</option>
          <option value="1536x1024">Landscape 16:9</option>
        </select>
        {(Object.keys(targets) as Provider[]).map((p) => (
          <label key={p} className="inline-flex items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={targets[p]} onChange={(e) => setTargets((t) => ({ ...t, [p]: e.target.checked }))} className="h-4 w-4 accent-brand-500" /> {PROVIDER_LABEL[p]}
          </label>
        ))}
        <button onClick={run} disabled={running} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run test
        </button>
      </div>
      {running && <p className="mt-3 text-[12.5px] text-muted-foreground">Generating… gpt-image can take ~30–150s; xAI/Gemini ~5–12s.</p>}
      {results && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-background">
              {r.ok && r.dataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.dataUri} alt={r.label} className="aspect-square w-full object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center p-3 text-center text-[12px] text-rose-500"><span><AlertTriangle className="mx-auto mb-1 h-5 w-5" />{r.error}</span></div>
              )}
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11.5px]"><span className="truncate font-semibold">{r.label}</span><span className="shrink-0 text-muted-foreground">{(r.ms / 1000).toFixed(1)}s</span></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
