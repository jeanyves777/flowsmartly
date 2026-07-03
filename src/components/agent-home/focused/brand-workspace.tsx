"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Save, Check, Plus, X, Palette } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { LanguageSwitcher } from "../language-switcher";
import { cn } from "@/lib/utils/cn";

/**
 * Brand identity, reinvented in the new design (a focused-view canvas) — the
 * brand kit powers ALL AI output. Agent-first: lead with AI generation; real
 * load (GET /api/brand) + save (POST /api/brand) + generate (POST
 * /api/brand/generate). Improves on the legacy: drops the dead fields
 * (avoidWords / guidelines / fonts) and the redundant User.links handle-sync —
 * the brand kit is the single source of truth. See [[new-design-no-legacy]].
 */

type Handles = { instagram?: string; twitter?: string; linkedin?: string; facebook?: string; youtube?: string; tiktok?: string };
type Colors = { primary?: string; secondary?: string; accent?: string };

interface Kit {
  name: string;
  tagline: string;
  description: string;
  logo: string;
  iconLogo: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  industry: string;
  niche: string;
  targetAudience: string;
  audienceAge: string;
  audienceLocation: string;
  uniqueValue: string;
  voiceTone: string;
  personality: string[];
  keywords: string[];
  hashtags: string[];
  products: string[];
  colors: Colors;
  handles: Handles;
  preferredLanguage: string;
}

const EMPTY: Kit = {
  name: "", tagline: "", description: "", logo: "", iconLogo: "", email: "", phone: "", website: "", address: "", city: "", country: "",
  industry: "", niche: "", targetAudience: "", audienceAge: "", audienceLocation: "", uniqueValue: "",
  voiceTone: "", personality: [], keywords: [], hashtags: [], products: [], colors: {}, handles: {}, preferredLanguage: "en",
};

const TONES = ["professional", "casual", "playful", "inspirational", "educational", "friendly", "authoritative"];
const TRAITS = ["Bold", "Trustworthy", "Innovative", "Warm", "Premium", "Approachable", "Energetic", "Minimal", "Witty", "Caring", "Confident", "Down-to-earth"];
const HANDLE_KEYS: (keyof Handles)[] = ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"];

const FIELD = "w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

function arr(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; }
function str(v: unknown): string { return typeof v === "string" ? v : ""; }

export function FocusedBrand({ dirtyRef, saverRef, refreshKey = 0 }: {
  dirtyRef: MutableRefObject<boolean>;
  saverRef: MutableRefObject<null | (() => void | Promise<void>)>;
  /** Bumps after a relevant agent action — reloads the kit so an agent-driven
   *  save (update_brand_identity) shows up live, unless the form has edits. */
  refreshKey?: number;
}) {
  const [kit, setKit] = useState<Kit>(EMPTY);
  // Portal the save action into the FocusedView shell header (#fv-header-slot) so
  // there's ONE top bar instead of a second full-width toolbar under it.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const snapshot = useRef<string>(JSON.stringify(EMPTY));

  const set = useCallback(<K extends keyof Kit>(k: K, v: Kit[K]) => setKit((p) => ({ ...p, [k]: v })), []);

  const applyKit = useCallback((b: Record<string, unknown>) => {
    const next: Kit = {
      ...EMPTY,
      name: str(b.name), tagline: str(b.tagline), description: str(b.description), logo: str(b.logo), iconLogo: str(b.iconLogo),
      email: str(b.email), phone: str(b.phone), website: str(b.website), address: str(b.address), city: str(b.city), country: str(b.country),
      industry: str(b.industry), niche: str(b.niche), targetAudience: str(b.targetAudience), audienceAge: str(b.audienceAge),
      audienceLocation: str(b.audienceLocation), uniqueValue: str(b.uniqueValue), voiceTone: str(b.voiceTone),
      personality: arr(b.personality), keywords: arr(b.keywords), hashtags: arr(b.hashtags), products: arr(b.products),
      colors: (b.colors && typeof b.colors === "object") ? (b.colors as Colors) : {},
      handles: (b.handles && typeof b.handles === "object") ? (b.handles as Handles) : {},
      preferredLanguage: str(b.preferredLanguage) || "en",
    };
    setKit(next);
    snapshot.current = JSON.stringify(next);
  }, []);

  // Load the brand kit on mount.
  useEffect(() => {
    let alive = true;
    fetch("/api/brand")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.data?.brandKit) applyKit(j.data.brandKit); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [applyKit]);

  // After a relevant agent action (e.g. the agent filled the kit via
  // update_brand_identity), silently reload so the form shows the new values —
  // but ONLY when the form is clean, so we never clobber the user's own edits.
  const firstRefresh = useRef(true);
  useEffect(() => {
    if (firstRefresh.current) { firstRefresh.current = false; return; }
    if (JSON.stringify(kit) !== snapshot.current) return; // unsaved edits → skip
    let alive = true;
    fetch("/api/brand")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.data?.brandKit) applyKit(j.data.brandKit); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const save = useCallback(async () => {
    if (!kit.name.trim()) { return; }
    setSaving(true);
    try {
      const clean = (s: string) => (s.trim() ? s.trim() : null);
      const payload = {
        name: kit.name.trim(),
        tagline: clean(kit.tagline), description: clean(kit.description), logo: clean(kit.logo), iconLogo: clean(kit.iconLogo),
        email: clean(kit.email), phone: clean(kit.phone), website: clean(kit.website), address: clean(kit.address), city: clean(kit.city), country: clean(kit.country),
        industry: clean(kit.industry), niche: clean(kit.niche), targetAudience: clean(kit.targetAudience), audienceAge: clean(kit.audienceAge),
        audienceLocation: clean(kit.audienceLocation), uniqueValue: clean(kit.uniqueValue), voiceTone: kit.voiceTone || null,
        personality: kit.personality, keywords: kit.keywords, hashtags: kit.hashtags, products: kit.products,
        colors: kit.colors, handles: kit.handles, preferredLanguage: kit.preferredLanguage || "en",
      };
      const r = await fetch("/api/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) {
        snapshot.current = JSON.stringify(kit);
        dirtyRef.current = false;
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 1800);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, [kit, dirtyRef]);

  // Report dirty + saver to the shell's navigation guard.
  useEffect(() => {
    dirtyRef.current = JSON.stringify(kit) !== snapshot.current;
    saverRef.current = save;
  }, [kit, save, dirtyRef, saverRef]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your brand…" /></div>;
  }

  const dirty = JSON.stringify(kit) !== snapshot.current;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Save action lives in the shell header (#fv-header-slot) — one top bar. */}
      {(() => {
        const header = (
          <>
            <span className="text-[12px] text-muted-foreground">{kit.name ? "Editing" : "New brand"}{dirty ? " · unsaved" : ""}</span>
            {savedToast && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-500"><Check className="h-3.5 w-3.5" /> Saved</span>}
            <button onClick={save} disabled={saving || !kit.name.trim() || !dirty} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
              {saving ? <FlowLoader size={15} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save brand
            </button>
          </>
        );
        return headerSlot ? createPortal(header, headerSlot) : (
          <div className="flex items-center gap-2 border-b border-border bg-card/30 px-4 py-2">{header}</div>
        );
      })()}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Identity */}
          <Section title="Identity" icon={Palette}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand name" required><input value={kit.name} onChange={(e) => set("name", e.target.value)} className={FIELD} placeholder="Acme Coffee" /></Field>
              <Field label="Tagline"><input value={kit.tagline} onChange={(e) => set("tagline", e.target.value)} className={FIELD} placeholder="Freshly roasted, always" /></Field>
            </div>
            <Field label="Description" className="mt-3"><textarea rows={2} value={kit.description} onChange={(e) => set("description", e.target.value)} className={FIELD} placeholder="What you do, for whom, and why it matters." /></Field>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Full logo"><MediaUploader value={kit.logo ? [kit.logo] : []} onChange={(u) => set("logo", u[0] ?? "")} variant="large" fit="contain" placeholder="Logo" showButtons /></Field>
              <Field label="Icon / mark"><MediaUploader value={kit.iconLogo ? [kit.iconLogo] : []} onChange={(u) => set("iconLogo", u[0] ?? "")} variant="large" fit="contain" placeholder="Icon" showButtons /></Field>
            </div>
          </Section>

          {/* Visual */}
          <Section title="Brand colors" icon={Palette}>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["primary", "secondary", "accent"] as const).map((key) => (
                <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                  <div className="flex items-center gap-2">
                    <input type="color" value={kit.colors[key] || "#0ea5e9"} onChange={(e) => set("colors", { ...kit.colors, [key]: e.target.value })} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent" />
                    <input value={kit.colors[key] || ""} onChange={(e) => set("colors", { ...kit.colors, [key]: e.target.value })} className={FIELD} placeholder="#0ea5e9" />
                  </div>
                </Field>
              ))}
            </div>
          </Section>

          {/* Industry & audience */}
          <Section title="Industry & audience" icon={Palette}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Industry"><input value={kit.industry} onChange={(e) => set("industry", e.target.value)} className={FIELD} placeholder="Food & beverage" /></Field>
              <Field label="Niche"><input value={kit.niche} onChange={(e) => set("niche", e.target.value)} className={FIELD} placeholder="Specialty coffee" /></Field>
            </div>
            <Field label="Target audience" className="mt-3"><textarea rows={2} value={kit.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} className={FIELD} placeholder="Who you serve." /></Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Age range"><input value={kit.audienceAge} onChange={(e) => set("audienceAge", e.target.value)} className={FIELD} placeholder="25–40" /></Field>
              <Field label="Location"><input value={kit.audienceLocation} onChange={(e) => set("audienceLocation", e.target.value)} className={FIELD} placeholder="US, urban" /></Field>
              <Field label="Unique value"><input value={kit.uniqueValue} onChange={(e) => set("uniqueValue", e.target.value)} className={FIELD} placeholder="What sets you apart" /></Field>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice & language" icon={Palette}>
            <Field label="Tone of voice">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button key={t} onClick={() => set("voiceTone", t)} className={cn("rounded-full border px-3 py-1.5 text-[12px] capitalize transition", kit.voiceTone === t ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:text-foreground")}>{t}</button>
                ))}
              </div>
            </Field>
            <Field label="Personality" className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {TRAITS.map((t) => {
                  const on = kit.personality.includes(t);
                  return <button key={t} onClick={() => set("personality", on ? kit.personality.filter((x) => x !== t) : [...kit.personality, t])} className={cn("rounded-full border px-3 py-1.5 text-[12px] transition", on ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:text-foreground")}>{t}</button>;
                })}
              </div>
            </Field>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="text-[12.5px] font-medium">AI language</p><p className="text-[11.5px] text-muted-foreground">Controls the language of all AI output across the app.</p></div>
              <LanguageSwitcher language={kit.preferredLanguage} onChange={(t) => set("preferredLanguage", t)} />
            </div>
          </Section>

          {/* Keywords / hashtags / products */}
          <Section title="Keywords, hashtags & products" icon={Palette}>
            <Field label="Keywords"><ChipInput values={kit.keywords} onChange={(v) => set("keywords", v)} placeholder="Add a keyword…" /></Field>
            <Field label="Hashtags" className="mt-3"><ChipInput values={kit.hashtags} onChange={(v) => set("hashtags", v)} placeholder="Add a hashtag…" prefix="#" /></Field>
            <Field label="Products / services" className="mt-3"><ChipInput values={kit.products} onChange={(v) => set("products", v)} placeholder="Add a product or service…" /></Field>
          </Section>

          {/* Contact */}
          <Section title="Contact" icon={Palette}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email"><input value={kit.email} onChange={(e) => set("email", e.target.value)} className={FIELD} placeholder="hello@brand.com" /></Field>
              <Field label="Phone"><input value={kit.phone} onChange={(e) => set("phone", e.target.value)} className={FIELD} placeholder="+1 555 0100" /></Field>
              <Field label="Website"><input value={kit.website} onChange={(e) => set("website", e.target.value)} className={FIELD} placeholder="brand.com" /></Field>
              <Field label="City"><input value={kit.city} onChange={(e) => set("city", e.target.value)} className={FIELD} placeholder="Austin" /></Field>
            </div>
          </Section>

          {/* Social */}
          <Section title="Social handles" icon={Palette}>
            <div className="grid gap-3 sm:grid-cols-2">
              {HANDLE_KEYS.map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  <input value={kit.handles[k] || ""} onChange={(e) => set("handles", { ...kit.handles, [k]: e.target.value })} className={FIELD} placeholder={`@your-${k}`} />
                </Field>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, accent }: { title: string; icon: ElementType; children: ReactNode; accent?: boolean }) {
  return (
    <section className={cn("rounded-2xl border p-4 sm:p-5", accent ? "border-brand-500/30 bg-gradient-to-br from-brand-500/5 to-violet-500/5" : "border-border bg-card")}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent ? "text-brand-500" : "text-muted-foreground")} />
        <h3 className="text-[13px] font-bold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11.5px] font-medium text-muted-foreground">{label}{required && <span className="text-brand-500"> *</span>}</span>
      {children}
    </label>
  );
}

function ChipInput({ values, onChange, placeholder, prefix }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; prefix?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    let v = draft.trim();
    if (prefix && v && !v.startsWith(prefix)) v = prefix + v.replace(/^#/, "");
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} className={FIELD} />
        <button onClick={add} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[12px]">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
