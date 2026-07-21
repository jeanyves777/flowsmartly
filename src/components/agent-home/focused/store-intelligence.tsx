"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Tag, Search as SeoIcon, Sparkles, Plus, Trash2, Check, AlertCircle, LineChart as LineIcon, Store as StoreIcon, ArrowUp, ArrowDown } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { FIELD, LABEL, SectionCard, StatTile, EmptyState, MoneyInput, money, toCents, dollars } from "./store-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Store Intelligence — the new-design port of the legacy /ecommerce/intelligence
 * page. Four tabs (Pricing, Trends, SEO, Market research) wired to the existing
 * /api/ecommerce/intelligence/* endpoints. Reuses the store-ui building blocks.
 */

type TabId = "pricing" | "trends" | "seo" | "research";
const TABS: { id: TabId; label: string; icon: typeof Tag }[] = [
  { id: "pricing", label: "Pricing", icon: Tag },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "seo", label: "SEO", icon: SeoIcon },
  { id: "research", label: "Market research", icon: Sparkles },
];

interface ProductLite { id: string; name: string; priceCents?: number; slug?: string }

export function StoreIntelligence({ currency }: { currency: string }) {
  const [tab, setTab] = useState<TabId>("pricing");
  const [products, setProducts] = useState<ProductLite[]>([]);

  useEffect(() => {
    fetch("/api/ecommerce/products?limit=100&status=ACTIVE").then((r) => r.json()).then((j) => {
      const rows = j?.data?.products;
      if (Array.isArray(rows)) setProducts(rows.map((p: { id: string; name: string; priceCents?: number; slug?: string }) => ({ id: p.id, name: p.name, priceCents: p.priceCents, slug: p.slug })));
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold transition", tab === t.id ? "border-transparent bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-sm" : "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground")}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "pricing" && <PricingTab currency={currency} products={products} />}
      {tab === "trends" && <TrendsTab />}
      {tab === "seo" && <SeoTab />}
      {tab === "research" && <ResearchTab currency={currency} />}
    </div>
  );
}

// ─────────────────────────── Pricing ───────────────────────────

interface Competitor { id: string; competitorName: string; competitorUrl?: string | null; priceCents: number; inStock: boolean; lastChecked?: string }
interface Analysis { myPrice: number; averageCompetitorPrice: number; lowestCompetitorPrice: number; highestCompetitorPrice: number; position: string; priceAdvantagePercent: number; competitorCount: number }
interface Suggestion { suggestedPriceCents: number; reasoning: string; confidence: number; factors: string[] }
type Strategy = "beat_lowest" | "match_average" | "premium" | "demand" | "margin_target";

function PricingTab({ currency, products }: { currency: string; products: ProductLite[] }) {
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rule, setRule] = useState<{ strategy: Strategy; config: Record<string, number> } | null>(null);
  const [history, setHistory] = useState<{ date: string; price: number }[]>([]);
  const [error, setError] = useState("");

  // Add-competitor form
  const [adding, setAdding] = useState(false);
  const [cName, setCName] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [savingC, setSavingC] = useState(false);

  // AI suggestion
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const [suggBusy, setSuggBusy] = useState(false);

  // Rule form
  const [strategy, setStrategy] = useState<Strategy>("beat_lowest");
  const [offset, setOffset] = useState("");
  const [marginPct, setMarginPct] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [savingRule, setSavingRule] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);

  useEffect(() => { if (!productId && products[0]) setProductId(products[0].id); }, [products, productId]);

  const load = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true); setError(""); setSugg(null);
    try {
      const [c, a, r, h] = await Promise.all([
        fetch(`/api/ecommerce/intelligence/competitors?productId=${pid}`).then((x) => x.json()).catch(() => null),
        fetch(`/api/ecommerce/intelligence/pricing?productId=${pid}&action=analysis`).then((x) => x.json()).catch(() => null),
        fetch(`/api/ecommerce/intelligence/pricing?productId=${pid}&action=rule`).then((x) => x.json()).catch(() => null),
        fetch(`/api/ecommerce/intelligence/pricing?productId=${pid}&action=history`).then((x) => x.json()).catch(() => null),
      ]);
      setCompetitors(Array.isArray(c?.data?.competitors) ? c.data.competitors : []);
      setAnalysis(a?.data?.analysis || null);
      const rl = r?.data?.rule;
      if (rl) { setRule(rl); setStrategy(rl.strategy); const cfg = rl.config || {}; setOffset(cfg.offsetCents != null ? dollars(cfg.offsetCents, currency) : ""); setMarginPct(cfg.marginPercent != null ? String(cfg.marginPercent) : ""); setMinPrice(cfg.minPriceCents != null ? dollars(cfg.minPriceCents, currency) : ""); setMaxPrice(cfg.maxPriceCents != null ? dollars(cfg.maxPriceCents, currency) : ""); }
      else { setRule(null); }
      setHistory(Array.isArray(h?.data?.history) ? h.data.history : []);
    } finally { setLoading(false); }
  }, [currency]);

  useEffect(() => { if (productId) load(productId); }, [productId, load]);

  const addCompetitor = async () => {
    if (cName.trim().length < 1) { setError("Enter the competitor's name."); return; }
    const priceCents = toCents(cPrice, currency);
    if (!priceCents || priceCents <= 0) { setError("Enter the competitor's price."); return; }
    setSavingC(true); setError("");
    try {
      const r = await fetch("/api/ecommerce/intelligence/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, competitorName: cName.trim(), competitorUrl: cUrl.trim() || undefined, priceCents, inStock: true }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { setCName(""); setCUrl(""); setCPrice(""); setAdding(false); await load(productId); }
      else setError(j?.error?.message || "Couldn't add the competitor.");
    } catch { setError("Couldn't add the competitor."); }
    finally { setSavingC(false); }
  };

  const delCompetitor = async (id: string) => {
    setCompetitors((cs) => cs.filter((c) => c.id !== id));
    await fetch(`/api/ecommerce/intelligence/competitors?id=${id}`, { method: "DELETE" }).catch(() => {});
    load(productId);
  };

  const getSuggestion = async () => {
    setSuggBusy(true); setError("");
    try {
      const r = await fetch(`/api/ecommerce/intelligence/pricing?action=suggest&productId=${productId}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data?.suggestion) setSugg(j.data.suggestion);
      else setError(j?.error?.message || "Couldn't get a suggestion right now.");
    } catch { setError("Couldn't get a suggestion right now."); }
    finally { setSuggBusy(false); }
  };

  const applyPrice = async (priceCents: number) => {
    const r = await fetch("/api/ecommerce/intelligence/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, action: "apply_price", priceCents, source: "ai_suggestion" }) });
    if (r.ok) { setSugg(null); await load(productId); }
  };

  const saveRule = async () => {
    setSavingRule(true); setRuleSaved(false); setError("");
    const config: Record<string, number> = {};
    if (offset.trim()) config.offsetCents = toCents(offset, currency) ?? 0;
    if (marginPct.trim()) config.marginPercent = Number(marginPct) || 0;
    if (minPrice.trim()) config.minPriceCents = toCents(minPrice, currency) ?? 0;
    if (maxPrice.trim()) config.maxPriceCents = toCents(maxPrice, currency) ?? 0;
    try {
      const r = await fetch("/api/ecommerce/intelligence/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, action: "save_rule", strategy, config }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { setRuleSaved(true); setTimeout(() => setRuleSaved(false), 2500); }
      else setError(j?.error?.message || "Couldn't save the rule.");
    } catch { setError("Couldn't save the rule."); }
    finally { setSavingRule(false); }
  };

  if (products.length === 0) {
    return <SectionCard icon={Tag} title="Pricing intelligence"><EmptyState title="No products yet" sub="Add products to track competitors and optimize pricing." /></SectionCard>;
  }

  return (
    <div className="space-y-4">
      <SectionCard icon={Tag} title="Pricing intelligence" hint="Track competitor prices, get an AI price suggestion, and set an auto-pricing rule per product.">
        <label className="block max-w-sm"><span className={LABEL}>Product</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={FIELD}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {error && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-rose-500"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
      </SectionCard>

      {loading ? (
        <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading pricing…" /></div></SectionCard>
      ) : (
        <>
          {analysis && analysis.competitorCount > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Your price" value={money(analysis.myPrice, currency)} />
              <StatTile label="Market average" value={money(analysis.averageCompetitorPrice, currency)} />
              <StatTile label="Lowest competitor" value={money(analysis.lowestCompetitorPrice, currency)} />
              <StatTile label="Position" value={analysis.position?.replace(/_/g, " ") || "—"} />
            </div>
          )}

          <SectionCard icon={StoreIcon} title="Competitor prices" hint="What rivals charge for the same thing." right={<button onClick={() => { setAdding((v) => !v); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> Add competitor</button>}>
            {adding && (
              <div className="mb-3 grid gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5 sm:grid-cols-4">
                <label className="block sm:col-span-2"><span className={LABEL}>Competitor name</span><input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Acme Corp" className={FIELD} /></label>
                <label className="block"><span className={LABEL}>Their price</span><MoneyInput currency={currency} value={cPrice} onChange={setCPrice} /></label>
                <label className="block"><span className={LABEL}>URL (optional)</span><input value={cUrl} onChange={(e) => setCUrl(e.target.value)} placeholder="https://…" className={FIELD} /></label>
                <div className="sm:col-span-4"><button onClick={addCompetitor} disabled={savingC} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{savingC ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} Add</button></div>
              </div>
            )}
            {competitors.length === 0 ? (
              <EmptyState title="No competitors tracked" sub="Add a competitor's price to see where you stand." />
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
                <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="pb-2 text-left font-bold">Competitor</th><th className="pb-2 text-left font-bold">Price</th><th className="pb-2 text-left font-bold">Stock</th><th></th></tr></thead>
                <tbody>{competitors.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2.5 pr-2 font-semibold">{c.competitorName}</td>
                    <td className="py-2.5 pr-2 tabular-nums">{money(c.priceCents, currency)}</td>
                    <td className="py-2.5 pr-2"><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", c.inStock ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{c.inStock ? "In stock" : "Out"}</span></td>
                    <td className="py-2.5 text-right"><button onClick={() => delCompetitor(c.id)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard icon={Sparkles} title="AI price suggestion" hint="Uses your competitors + demand signals. Costs 3 credits.">
              {sugg ? (
                <div className="space-y-2.5">
                  <div className="flex items-baseline gap-2"><span className="text-[22px] font-extrabold text-foreground">{money(sugg.suggestedPriceCents, currency)}</span><span className="text-[11.5px] text-muted-foreground">{Math.round((sugg.confidence || 0) * 100)}% confidence</span></div>
                  <p className="text-[12.5px] text-muted-foreground">{sugg.reasoning}</p>
                  {sugg.factors?.length > 0 && <ul className="space-y-1 text-[12px] text-muted-foreground">{sugg.factors.map((f, i) => <li key={i} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {f}</li>)}</ul>}
                  <div className="flex gap-2"><button onClick={() => applyPrice(sugg.suggestedPriceCents)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm"><Check className="h-3.5 w-3.5" /> Apply this price</button><button onClick={() => setSugg(null)} className="rounded-[10px] border border-border px-3 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Dismiss</button></div>
                </div>
              ) : (
                <button onClick={getSuggestion} disabled={suggBusy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{suggBusy ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-4 w-4" />} Get AI suggestion (3 credits)</button>
              )}
            </SectionCard>

            <SectionCard icon={LineIcon} title="Auto-pricing rule" hint="Reprice this product automatically as competitors move." right={ruleSaved ? <span className="text-[11.5px] font-semibold text-emerald-500">Saved</span> : null}>
              <div className="space-y-2.5">
                <label className="block"><span className={LABEL}>Strategy</span>
                  <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} className={FIELD}>
                    <option value="beat_lowest">Beat the lowest competitor</option>
                    <option value="match_average">Match the market average</option>
                    <option value="premium">Premium (above market)</option>
                    <option value="demand">Demand-based</option>
                    <option value="margin_target">Target margin %</option>
                  </select>
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {strategy === "margin_target" ? (
                    <label className="block"><span className={LABEL}>Target margin %</span><input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} inputMode="numeric" placeholder="40" className={FIELD} /></label>
                  ) : (
                    <label className="block"><span className={LABEL}>Price offset</span><MoneyInput currency={currency} value={offset} onChange={setOffset} /></label>
                  )}
                  <label className="block"><span className={LABEL}>Floor price</span><MoneyInput currency={currency} value={minPrice} onChange={setMinPrice} /></label>
                  <label className="block"><span className={LABEL}>Ceiling price</span><MoneyInput currency={currency} value={maxPrice} onChange={setMaxPrice} /></label>
                </div>
                <button onClick={saveRule} disabled={savingRule} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{savingRule ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} {rule ? "Update rule" : "Save rule"}</button>
              </div>
            </SectionCard>
          </div>

          {history.length > 1 && (
            <SectionCard icon={LineIcon} title="Price history">
              <Sparkline points={history.map((h) => h.price)} currency={currency} />
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────── Trends ───────────────────────────

function TrendsTab() {
  const [keyword, setKeyword] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [daily, setDaily] = useState<{ title: string; geo?: string }[]>([]);
  const [industry, setIndustry] = useState<{ top: { query: string }[]; rising: { query: string }[] } | null>(null);
  const [result, setResult] = useState<{ timeline: number[]; top: { query: string }[]; rising: { query: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/ecommerce/intelligence/trends?type=overview").then((r) => r.json()).then((j) => {
      const d = j?.data;
      if (d) { setPresets(Array.isArray(d.presetKeywords) ? d.presetKeywords : []); setDaily(Array.isArray(d.dailyTrends) ? d.dailyTrends : []); setIndustry(d.industryTrends || null); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const search = async (kw: string) => {
    if (!kw.trim()) return;
    setKeyword(kw); setSearching(true);
    try {
      const [s, rel] = await Promise.all([
        fetch(`/api/ecommerce/intelligence/trends?type=search&keyword=${encodeURIComponent(kw)}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/ecommerce/intelligence/trends?type=related&keyword=${encodeURIComponent(kw)}`).then((r) => r.json()).catch(() => null),
      ]);
      const timeline = (s?.data?.timelineData || s?.data?.timeline || []).map((p: { value?: number[] | number }) => Array.isArray(p.value) ? p.value[0] : (p.value ?? 0));
      setResult({ timeline, top: rel?.data?.top || [], rising: rel?.data?.rising || [] });
    } finally { setSearching(false); }
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading trends…" /></div></SectionCard>;

  return (
    <div className="space-y-4">
      <SectionCard icon={TrendingUp} title="Market trends" hint="Live Google search interest — free to explore.">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(keyword)} placeholder="Search a keyword or product…" className={FIELD} />
          </div>
          <button onClick={() => search(keyword)} disabled={searching} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{searching ? <FlowLoader size={14} tone="white" /> : <SeoIcon className="h-4 w-4" />} Search</button>
        </div>
        {presets.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{presets.slice(0, 8).map((k) => <button key={k} onClick={() => search(k)} className="rounded-full border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">{k}</button>)}</div>}
      </SectionCard>

      {result && (
        <>
          {result.timeline.length > 1 && <SectionCard icon={LineIcon} title={`Interest over time — "${keyword}"`}><Sparkline points={result.timeline} /></SectionCard>}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top related searches">{result.top.length ? <QueryList items={result.top} /> : <EmptyState title="No related queries" />}</SectionCard>
            <SectionCard title="Fastest growing">{result.rising.length ? <QueryList items={result.rising} rising /> : <EmptyState title="No rising queries" />}</SectionCard>
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Trending today">{daily.length ? <ul className="space-y-1.5">{daily.slice(0, 10).map((d, i) => <li key={i} className="flex items-center gap-2 text-[12.5px]"><span className="w-5 text-[11px] font-bold text-muted-foreground">{i + 1}</span> {d.title}{d.geo ? <span className="ms-auto text-[10.5px] text-muted-foreground">{d.geo}</span> : null}</li>)}</ul> : <EmptyState title="No daily trends" />}</SectionCard>
        <SectionCard title="Hot in your industry">{industry ? <div className="grid grid-cols-2 gap-3"><div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Most searched</p><QueryList items={industry.top?.slice(0, 6) || []} /></div><div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Fastest growing</p><QueryList items={industry.rising?.slice(0, 6) || []} rising /></div></div> : <EmptyState title="No industry data" />}</SectionCard>
      </div>
    </div>
  );
}

function QueryList({ items, rising }: { items: { query: string }[]; rising?: boolean }) {
  return <ul className="space-y-1.5">{items.map((q, i) => <li key={i} className="flex items-center gap-2 text-[12.5px]">{rising ? <ArrowUp className="h-3.5 w-3.5 text-emerald-500" /> : <span className="w-4 text-[11px] font-bold text-muted-foreground">{i + 1}</span>} <span className="truncate">{q.query}</span></li>)}</ul>;
}

// ─────────────────────────── SEO ───────────────────────────

interface SEOProduct { productId: string; name: string; score: number; issueCount: number; hasSeoTitle: boolean; hasSeoDescription: boolean }

function SeoTab() {
  const [rows, setRows] = useState<SEOProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | "bulk" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const j = await fetch("/api/ecommerce/intelligence/seo?action=bulk_analyze").then((r) => r.json()).catch(() => null);
    setRows(Array.isArray(j?.data?.products) ? j.data.products : []);
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const optimize = async (productId: string) => {
    setBusy(productId); setError("");
    try {
      const r = await fetch("/api/ecommerce/intelligence/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "optimize", productId }) });
      const j = await r.json().catch(() => null);
      if (r.ok) await load(); else setError(j?.error?.message || "Couldn't optimize that product.");
    } catch { setError("Couldn't optimize that product."); }
    finally { setBusy(null); }
  };

  const bulk = async () => {
    const ids = rows.filter((r) => r.issueCount > 0).map((r) => r.productId).slice(0, 50);
    if (!ids.length) return;
    setBusy("bulk"); setError("");
    try {
      const r = await fetch("/api/ecommerce/intelligence/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulk_optimize", productIds: ids }) });
      const j = await r.json().catch(() => null);
      if (r.ok) await load(); else setError(j?.error?.message || "Couldn't run bulk optimization.");
    } catch { setError("Couldn't run bulk optimization."); }
    finally { setBusy(null); }
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Analyzing SEO…" /></div></SectionCard>;
  const withIssues = rows.filter((r) => r.issueCount > 0).length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Products" value={String(rows.length)} />
        <StatTile label="Avg SEO score" value={`${avg}/100`} />
        <StatTile label="Need attention" value={String(withIssues)} />
      </div>
      <SectionCard icon={SeoIcon} title="Product SEO" hint="Titles, descriptions & keywords. Optimizing costs 3 credits per product." right={withIssues > 0 ? <button onClick={bulk} disabled={busy === "bulk"} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{busy === "bulk" ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Optimize {withIssues} ({withIssues * 3} cr)</button> : null}>
        {error && <p className="mb-2 flex items-center gap-1.5 text-[12px] text-rose-500"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
        {rows.length === 0 ? <EmptyState title="No products yet" sub="Add products to analyze their SEO." /> : (
          <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
            <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="pb-2 text-left font-bold">Product</th><th className="pb-2 text-left font-bold">Score</th><th className="pb-2 text-left font-bold">Title</th><th className="pb-2 text-left font-bold">Description</th><th></th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.productId} className="border-t border-border">
                <td className="py-2.5 pr-2 font-semibold">{p.name}</td>
                <td className="py-2.5 pr-2"><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", p.score >= 80 ? "bg-emerald-500/10 text-emerald-500" : p.score >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500")}>{p.score}</span></td>
                <td className="py-2.5 pr-2">{p.hasSeoTitle ? <Check className="h-4 w-4 text-emerald-500" /> : <span className="text-rose-500">—</span>}</td>
                <td className="py-2.5 pr-2">{p.hasSeoDescription ? <Check className="h-4 w-4 text-emerald-500" /> : <span className="text-rose-500">—</span>}</td>
                <td className="py-2.5 text-right"><button onClick={() => optimize(p.productId)} disabled={busy === p.productId} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{busy === p.productId ? <FlowLoader size={12} /> : <Sparkles className="h-3.5 w-3.5 text-brand-500" />} Optimize</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────── Market research ───────────────────────────

interface Research { industryOverview?: string; trendingProducts?: { name: string; reason?: string }[]; marketGaps?: { title?: string; opportunity?: string; description?: string }[]; categoryInsights?: { category: string; trend?: string }[]; actionItems?: string[] }

function ResearchTab({ currency }: { currency: string }) {
  void currency;
  const [report, setReport] = useState<Research | null>(null);
  const [history, setHistory] = useState<{ id: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const j = await fetch("/api/ecommerce/intelligence/market-research").then((r) => r.json()).catch(() => null);
    const d = j?.data;
    if (d) { setHistory(Array.isArray(d.reports) ? d.reports : []); if (d.latestReport?.data) setReport(d.latestReport.data); }
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const run = async () => {
    setRunning(true); setError("");
    try {
      const r = await fetch("/api/ecommerce/intelligence/market-research", { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data?.result) { setReport(j.data.result); await load(); }
      else setError(j?.error?.message || "Couldn't run market research right now.");
    } catch { setError("Couldn't run market research right now."); }
    finally { setRunning(false); }
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading research…" /></div></SectionCard>;

  return (
    <div className="space-y-4">
      <SectionCard icon={Sparkles} title="AI market research" hint="What to sell next, gaps to fill, and where your industry is heading. Costs 15 credits." right={<button onClick={run} disabled={running} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{running ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} {report ? "New research" : "Run research"} (15 cr)</button>}>
        {error && <p className="flex items-center gap-1.5 text-[12px] text-rose-500"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
        {!report && !error && <p className="text-[12.5px] text-muted-foreground">Run your first market research to get AI-picked product ideas, market gaps, and category trends for your industry.</p>}
        {report?.industryOverview && <p className="text-[13px] leading-relaxed text-foreground">{report.industryOverview}</p>}
      </SectionCard>

      {report && (
        <>
          {!!report.trendingProducts?.length && (
            <SectionCard icon={TrendingUp} title="Products you should sell">
              <div className="grid gap-2.5 sm:grid-cols-2">{report.trendingProducts.slice(0, 8).map((p, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-[13px] font-semibold">{p.name}</p>{p.reason && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{p.reason}</p>}</div>
              ))}</div>
            </SectionCard>
          )}
          {!!report.marketGaps?.length && (
            <SectionCard title="Market gaps & opportunities">
              <ul className="space-y-2">{report.marketGaps.slice(0, 6).map((g, i) => (
                <li key={i} className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-[12.8px] font-semibold">{g.title || g.opportunity}</p>{g.description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{g.description}</p>}</li>
              ))}</ul>
            </SectionCard>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {!!report.categoryInsights?.length && (
              <SectionCard title="Category trends"><ul className="space-y-1.5">{report.categoryInsights.slice(0, 8).map((c, i) => <li key={i} className="flex items-center gap-2 text-[12.5px]"><span className="font-semibold">{c.category}</span>{c.trend && <span className="ms-auto text-[11.5px] text-muted-foreground">{c.trend}</span>}</li>)}</ul></SectionCard>
            )}
            {!!report.actionItems?.length && (
              <SectionCard title="Recommended actions"><ul className="space-y-1.5">{report.actionItems.slice(0, 8).map((a, i) => <li key={i} className="flex items-start gap-1.5 text-[12.5px]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {a}</li>)}</ul></SectionCard>
            )}
          </div>
        </>
      )}
      {history.length > 0 && <p className="text-[11.5px] text-muted-foreground">{history.length} report{history.length === 1 ? "" : "s"} run to date.</p>}
    </div>
  );
}

// ─────────────────────────── shared sparkline ───────────────────────────

function Sparkline({ points, currency }: { points: number[]; currency?: string }) {
  const vals = points.filter((n) => Number.isFinite(n));
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const W = 600, H = 80;
  const d = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * (H - 8) - 4}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full min-w-[320px]" preserveAspectRatio="none">
        <polyline points={d} fill="none" stroke="url(#ig)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        <defs><linearGradient id="ig" x1="0" x2="1"><stop offset="0" stopColor="#7c5cff" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs>
      </svg>
      {currency && <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground"><span>{money(min, currency)}</span><span>{money(max, currency)}</span></div>}
    </div>
  );
}
