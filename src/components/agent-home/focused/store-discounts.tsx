"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X, Check, Pencil, Ticket } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { FIELD, LABEL, SectionCard, EmptyState, Toggle, MoneyInput, money, toCents, dollars } from "./store-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Discount codes — store-scoped promo codes applied at checkout (percentage,
 * fixed amount, or free shipping) with usage limits + expiry. Full CRUD on
 * /api/ecommerce/coupons. (For a plain sale, set a product's compare-at price.)
 */

interface Coupon { id: string; code: string; type: string; value: number; minOrderCents?: number | null; usageLimit?: number | null; usageCount?: number; isActive?: boolean; expiresAt?: string | null; }
type Draft = { code: string; type: "percentage" | "fixed" | "free_shipping"; value: string; minOrder: string; usageLimit: string; expiresAt: string };
const EMPTY: Draft = { code: "", type: "percentage", value: "", minOrder: "", usageLimit: "", expiresAt: "" };

function describe(c: Coupon, currency: string): string {
  if (c.type === "percentage") return `${c.value}% off`;
  if (c.type === "fixed") return `${money(c.value, currency)} off`;
  return "Free shipping";
}

export function StoreDiscounts({ currency }: { currency: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/ecommerce/coupons").then((r) => r.json()).catch(() => null);
    setCoupons(Array.isArray(j?.data?.coupons) ? j.data.coupons : []);
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const openAdd = () => { setDraft(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (c: Coupon) => {
    setDraft({ code: c.code, type: (c.type as Draft["type"]) || "percentage", value: c.type === "fixed" ? dollars(c.value, currency) : String(c.value), minOrder: dollars(c.minOrderCents, currency), usageLimit: c.usageLimit != null ? String(c.usageLimit) : "", expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "" });
    setError(""); setEditing(c.id); setConfirmDelete(null);
  };

  const save = async () => {
    const code = draft.code.trim().toUpperCase();
    if (code.length < 2) { setError("Enter a code (min 2 characters)."); return; }
    if (!/^[A-Z0-9_-]+$/.test(code)) { setError("Codes can only use letters, numbers, - and _ (no spaces)."); return; }
    if (draft.expiresAt) { const d = new Date(draft.expiresAt + "T23:59:59"); if (!(d.getTime() > Date.now())) { setError("The expiry date must be in the future."); return; } }
    const value = draft.type === "fixed" ? (toCents(draft.value, currency) ?? 0) : Math.round(Number(draft.value) || 0);
    if (draft.type === "percentage" && (value < 1 || value > 100)) { setError("Percentage must be 1–100."); return; }
    if (draft.type === "fixed" && value < 1) { setError("Set an amount greater than 0."); return; }
    setSaving(true); setError("");
    try {
      const isEdit = editing && editing !== "new";
      const body = {
        code, type: draft.type, value,
        minOrderCents: draft.minOrder.trim() ? (toCents(draft.minOrder, currency) ?? null) : null,
        usageLimit: draft.usageLimit.trim() ? (Number(draft.usageLimit) || null) : null,
        expiresAt: draft.expiresAt || null,
      };
      const r = await fetch(isEdit ? `/api/ecommerce/coupons/${editing}` : "/api/ecommerce/coupons", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { setEditing(null); await load(); }
      else setError(j?.error || "Couldn't save the code.");
    } catch { setError("Couldn't save the code."); }
    finally { setSaving(false); }
  };

  const toggleActive = async (c: Coupon) => {
    setCoupons((cs) => cs.map((x) => (x.id === c.id ? { ...x, isActive: !x.isActive } : x)));
    await fetch(`/api/ecommerce/coupons/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !c.isActive }) }).catch(() => {});
  };

  const remove = async (id: string) => {
    await fetch(`/api/ecommerce/coupons/${id}`, { method: "DELETE" }).catch(() => {});
    setConfirmDelete(null); if (editing === id) setEditing(null); await load();
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading discounts…" /></div></SectionCard>;

  return (
    <SectionCard icon={Ticket} title="Discount codes" hint="Promo codes applied at checkout — percentage, fixed amount, or free shipping. For a plain sale, set a product's compare-at price." right={<button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> New code</button>}>
      {editing && (
        <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
          <p className="mb-2.5 text-[12.5px] font-semibold">{editing === "new" ? "New discount code" : "Edit code"}</p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <label className="block"><span className={LABEL}>Code</span><input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" className={cn(FIELD, "uppercase")} /></label>
            <label className="block"><span className={LABEL}>Type</span>
              <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as Draft["type"] }))} className={FIELD}>
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed amount</option>
                <option value="free_shipping">Free shipping</option>
              </select>
            </label>
            {draft.type !== "free_shipping" && (
              draft.type === "percentage"
                ? <label className="block"><span className={LABEL}>Percent off</span><div className="relative"><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span><input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} inputMode="numeric" placeholder="10" className={cn(FIELD, "pl-7")} /></div></label>
                : <label className="block"><span className={LABEL}>Amount off</span><MoneyInput currency={currency} value={draft.value} onChange={(v) => setDraft((d) => ({ ...d, value: v }))} /></label>
            )}
          </div>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
            <label className="block"><span className={LABEL}>Min. order (optional)</span><MoneyInput currency={currency} value={draft.minOrder} onChange={(v) => setDraft((d) => ({ ...d, minOrder: v }))} /></label>
            <label className="block"><span className={LABEL}>Usage limit (optional)</span><input value={draft.usageLimit} onChange={(e) => setDraft((d) => ({ ...d, usageLimit: e.target.value }))} inputMode="numeric" placeholder="Unlimited" className={FIELD} /></label>
            <label className="block"><span className={LABEL}>Expires (optional)</span><input type="date" value={draft.expiresAt} onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))} className={FIELD} /></label>
          </div>
          {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} {editing === "new" ? "Create code" : "Save"}</button>
            <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      )}

      {coupons.length === 0 && !editing ? (
        <EmptyState title="No discount codes yet" sub="Create a code buyers can redeem at checkout." action={<button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Create a code</button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="pb-2 text-left font-bold">Code</th><th className="pb-2 text-left font-bold">Discount</th><th className="pb-2 text-left font-bold">Used</th><th className="pb-2 text-left font-bold">Expires</th><th className="pb-2 text-left font-bold">Active</th><th></th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-2.5 pr-2 font-bold tabular-nums">{c.code}</td>
                  <td className="py-2.5 pr-2">{describe(c, currency)}{c.minOrderCents ? <span className="text-muted-foreground"> · min {money(c.minOrderCents, currency)}</span> : null}</td>
                  <td className="py-2.5 pr-2 tabular-nums text-muted-foreground">{c.usageCount ?? 0}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""}</td>
                  <td className="py-2.5 pr-2 tabular-nums text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                  <td className="py-2.5 pr-2"><Toggle on={!!c.isActive} onClick={() => toggleActive(c)} /></td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(c)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      {confirmDelete === c.id ? (
                        <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white"><Trash2 className="h-3 w-3" /> Delete</button>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
