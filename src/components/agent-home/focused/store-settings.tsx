"use client";

import { useEffect, useState } from "react";
import { Save, Check, Settings as SettingsIcon, CreditCard, Bell, Store as StoreIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { FIELD, LABEL, SectionCard, Toggle, MoneyInput, toCents, dollars } from "./store-ui";

/**
 * Store settings — general (name/currency/region/industry), checkout (COD limit
 * & fee, auto-cancel), and notification prefs. Persists to /store/settings; the
 * settings JSON is read-merge-written so nothing else is clobbered. Store status
 * (live/paused) toggles isActive on the same route.
 */

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NGN", "GHS", "KES", "ZAR", "INR"];
interface Notif { newOrder?: boolean; lowStock?: boolean; weeklySummary?: boolean }

export function StoreSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [region, setRegion] = useState("");
  const [industry, setIndustry] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [codMax, setCodMax] = useState("");
  const [codFee, setCodFee] = useState("");
  const [autoCancel, setAutoCancel] = useState(false);
  const [notif, setNotif] = useState<Notif>({ newOrder: true, lowStock: true, weeklySummary: false });

  useEffect(() => {
    let alive = true;
    fetch("/api/ecommerce/store").then((r) => r.json()).then((j) => {
      if (!alive) return;
      const s = j?.data?.store;
      if (s) {
        setName(s.name || "");
        setCurrency((s.currency || "USD").toUpperCase());
        setRegion(s.region || "");
        setIndustry(s.industry || "");
        setIsActive(!!s.isActive);
        const cfg = s.settings && typeof s.settings === "object" ? s.settings : {};
        setSettings(cfg);
        setCodMax(dollars(cfg.codMaxAmount as number));
        setCodFee(dollars(cfg.codFee as number));
        setAutoCancel(!!cfg.autoCancel);
        if (cfg.notifications && typeof cfg.notifications === "object") setNotif(cfg.notifications as Notif);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const mergedSettings = {
        ...settings,
        codMaxAmount: toCents(codMax) ?? 0,
        codFee: toCents(codFee) ?? 0,
        autoCancel,
        notifications: notif,
      };
      const r = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, currency, region: region.trim() || null, industry: industry.trim() || null, isActive, settings: mergedSettings }),
      });
      if (r.ok) { setSettings(mergedSettings); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } finally { setSaving(false); }
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading settings…" /></div></SectionCard>;

  const SaveBtn = <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={14} tone="white" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {saved ? "Saved" : "Save settings"}</button>;

  return (
    <div className="space-y-4">
      <SectionCard icon={SettingsIcon} title="General" right={SaveBtn}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={LABEL}>Store name</span><input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} /></label>
          <label className="block"><span className={LABEL}>Industry</span><input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Food & beverage" className={FIELD} /></label>
          <label className="block"><span className={LABEL}>Currency</span><select value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="block"><span className={LABEL}>Region</span><input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="United States" className={FIELD} /></label>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={CreditCard} title="Checkout">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={LABEL}>Cash-on-delivery limit</span><MoneyInput currency={currency} value={codMax} onChange={setCodMax} /></label>
            <label className="block"><span className={LABEL}>COD handling fee</span><MoneyInput currency={currency} value={codFee} onChange={setCodFee} /></label>
          </div>
          <Row title="Auto-cancel unpaid orders" sub="Release stock if not paid within 48 hours" on={autoCancel} onToggle={() => setAutoCancel((v) => !v)} />
        </SectionCard>

        <SectionCard icon={Bell} title="Notifications">
          <div className="space-y-2">
            <Row title="New-order emails" sub="Email me when an order comes in" on={!!notif.newOrder} onToggle={() => setNotif((n) => ({ ...n, newOrder: !n.newOrder }))} />
            <Row title="Low-stock alerts" sub="When a product drops below its threshold" on={!!notif.lowStock} onToggle={() => setNotif((n) => ({ ...n, lowStock: !n.lowStock }))} />
            <Row title="Weekly summary" sub="A sales recap every Monday" on={!!notif.weeklySummary} onToggle={() => setNotif((n) => ({ ...n, weeklySummary: !n.weeklySummary }))} />
          </div>
        </SectionCard>
      </div>

      <SectionCard icon={StoreIcon} title="Store status">
        <Row title={isActive ? "Store is live" : "Store is paused"} sub={isActive ? "Accepting orders on your storefront" : "Hidden from buyers — no checkout"} on={isActive} onToggle={() => setIsActive((v) => !v)} />
        <p className="mt-2 text-[11.5px] text-muted-foreground">Changes save with the button above.</p>
      </SectionCard>
    </div>
  );
}

function Row({ title, sub, on, onToggle }: { title: string; sub?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12.8px] font-semibold">{title}</p>
        {sub && <p className="text-[11.5px] text-muted-foreground">{sub}</p>}
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  );
}
