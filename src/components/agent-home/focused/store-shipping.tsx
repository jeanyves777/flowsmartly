"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X, Check, Truck, Save, Pencil } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { FIELD, LABEL, SectionCard, EmptyState, Toggle, MoneyInput, money, toCents, dollars } from "./store-ui";

/**
 * Shipping — store-wide free-shipping threshold + flat fallback rate (persisted
 * to /store/settings, which mirrors them into the Store columns the storefront
 * reads), plus full shipping-method CRUD (/api/ecommerce/shipping-methods). The
 * settings blob is read-merge-written so other settings are never clobbered.
 */

interface Method { id: string; name: string; description?: string | null; priceCents?: number; estimatedDays?: string | null; isActive?: boolean; sortOrder?: number; }
type Draft = { name: string; description: string; price: string; estimatedDays: string };
const EMPTY: Draft = { name: "", description: "", price: "", estimatedDays: "" };

export function StoreShipping({ currency }: { currency: string }) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [freeOver, setFreeOver] = useState("");
  const [flatRate, setFlatRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSaved, setRatesSaved] = useState(false);

  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    const j = await fetch("/api/ecommerce/shipping-methods").then((r) => r.json()).catch(() => null);
    setMethods(Array.isArray(j?.data?.methods) ? j.data.methods : []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [sj] = await Promise.all([
        fetch("/api/ecommerce/store").then((r) => r.json()).catch(() => null),
        loadMethods(),
      ]);
      if (!alive) return;
      const store = sj?.data?.store;
      if (store) {
        setSettings(store.settings && typeof store.settings === "object" ? store.settings : {});
        setFreeOver(dollars(store.freeShippingThresholdCents));
        setFlatRate(dollars(store.flatRateShippingCents));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadMethods]);

  const saveRates = async () => {
    setSavingRates(true); setRatesSaved(false);
    try {
      const shipping = { ...(settings.shipping as Record<string, unknown> || {}), flatRateCents: toCents(flatRate) ?? 0, freeShippingThresholdCents: toCents(freeOver) ?? 0 };
      const r = await fetch("/api/ecommerce/store/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { ...settings, shipping } }) });
      if (r.ok) { setSettings((s) => ({ ...s, shipping })); setRatesSaved(true); setTimeout(() => setRatesSaved(false), 2500); }
    } finally { setSavingRates(false); }
  };

  const openAdd = () => { setDraft(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (m: Method) => { setDraft({ name: m.name, description: m.description || "", price: dollars(m.priceCents), estimatedDays: m.estimatedDays || "" }); setError(""); setEditing(m.id); setConfirmDelete(null); };

  const saveMethod = async () => {
    if (!draft.name.trim()) { setError("Name the method."); return; }
    setSaving(true); setError("");
    try {
      const isEdit = editing && editing !== "new";
      const body = { name: draft.name.trim(), description: draft.description.trim() || undefined, priceCents: toCents(draft.price) ?? 0, estimatedDays: draft.estimatedDays.trim() || undefined };
      const r = await fetch(isEdit ? `/api/ecommerce/shipping-methods/${editing}` : "/api/ecommerce/shipping-methods", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { setEditing(null); await loadMethods(); }
      else setError(j?.error || j?.error?.message || "Couldn't save the method.");
    } catch { setError("Couldn't save the method."); }
    finally { setSaving(false); }
  };

  const toggleActive = async (m: Method) => {
    setMethods((ms) => ms.map((x) => (x.id === m.id ? { ...x, isActive: !x.isActive } : x)));
    await fetch(`/api/ecommerce/shipping-methods/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !m.isActive }) }).catch(() => {});
  };

  const remove = async (id: string) => {
    await fetch(`/api/ecommerce/shipping-methods/${id}`, { method: "DELETE" }).catch(() => {});
    setConfirmDelete(null); if (editing === id) setEditing(null); await loadMethods();
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading shipping…" /></div></SectionCard>;

  return (
    <div className="space-y-4">
      <SectionCard icon={Truck} title="Shipping rates" hint="Free-shipping threshold + a flat fallback rate. These sync to your storefront checkout and promo bar." right={<button onClick={saveRates} disabled={savingRates} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{savingRates ? <FlowLoader size={13} tone="white" /> : ratesSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />} {ratesSaved ? "Saved" : "Save rates"}</button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={LABEL}>Free shipping on orders over</span><MoneyInput currency={currency} value={freeOver} onChange={setFreeOver} /></label>
          <label className="block"><span className={LABEL}>Flat rate (below the threshold)</span><MoneyInput currency={currency} value={flatRate} onChange={setFlatRate} /></label>
        </div>
      </SectionCard>

      <SectionCard title="Shipping methods" hint="What buyers choose at checkout." right={<button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> Add method</button>}>
        {editing && (
          <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
            <p className="mb-2.5 text-[12.5px] font-semibold">{editing === "new" ? "New shipping method" : "Edit method"}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block"><span className={LABEL}>Name *</span><input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Standard shipping" className={FIELD} /></label>
              <label className="block"><span className={LABEL}>Price ({currency}) · 0 = free</span><MoneyInput currency={currency} value={draft.price} onChange={(v) => setDraft((d) => ({ ...d, price: v }))} /></label>
              <label className="block"><span className={LABEL}>Estimated time</span><input value={draft.estimatedDays} onChange={(e) => setDraft((d) => ({ ...d, estimatedDays: e.target.value }))} placeholder="3–5 business days" className={FIELD} /></label>
              <label className="block"><span className={LABEL}>Description</span><input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Tracked, insured" className={FIELD} /></label>
            </div>
            {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveMethod} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} {editing === "new" ? "Add method" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
            </div>
          </div>
        )}
        {methods.length === 0 && !editing ? (
          <EmptyState title="No shipping methods" sub="Add at least one so buyers can check out." action={<button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a method</button>} />
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{m.name}</p>
                  {(m.estimatedDays || m.description) && <p className="truncate text-[11.5px] text-muted-foreground">{[m.estimatedDays, m.description].filter(Boolean).join(" · ")}</p>}
                </div>
                <span className="text-[13px] font-bold tabular-nums">{m.priceCents ? money(m.priceCents, currency) : "Free"}</span>
                <Toggle on={!!m.isActive} onClick={() => toggleActive(m)} />
                <button onClick={() => openEdit(m)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                {confirmDelete === m.id ? (
                  <button onClick={() => remove(m.id)} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white"><Trash2 className="h-3 w-3" /> Delete</button>
                ) : (
                  <button onClick={() => setConfirmDelete(m.id)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
