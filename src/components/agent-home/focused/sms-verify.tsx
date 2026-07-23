"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import { ShieldCheck, Megaphone, Bell, Headphones, KeyRound, Building2, Link2, ImageUp, MessageSquare, Plus, Trash2, CheckCircle2, Hourglass, AlertTriangle, Phone, Search, Sparkles, ArrowRight, RotateCw } from "lucide-react";
import { MediaUploader } from "@/components/shared/media-uploader";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * SMS verification — the structured "Get verified to send" intake, in the UI.
 * A brand-new client provides business + use-case + opt-in proof + sample
 * messages, which POST to /api/sms/compliance (→ PENDING_REVIEW) for admin
 * review. Once approved they rent a sender number here (auto-registers A2P).
 * This is the front door to sending; nothing texts until it's cleared.
 * [[sms-studio-telnyx-redesign]]
 */

const USE_CASES: { v: string; label: string; blurb: string; icon: ElementType }[] = [
  { v: "marketing", label: "Marketing & offers", blurb: "Promos, launches, win-backs", icon: Megaphone },
  { v: "notifications", label: "Order / appointment updates", blurb: "Confirmations & reminders", icon: Bell },
  { v: "customer_support", label: "Customer support", blurb: "Replies & follow-ups", icon: Headphones },
  { v: "two_factor_auth", label: "Verification codes", blurb: "One-time passcodes (2FA)", icon: KeyRound },
];

interface Compliance {
  businessName?: string | null; businessWebsite?: string | null;
  businessStreetAddress?: string | null; businessCity?: string | null; businessStateProvinceRegion?: string | null; businessPostalCode?: string | null; businessCountry?: string | null;
  privacyPolicyUrl?: string | null; termsOfServiceUrl?: string | null;
  smsUseCase?: string | null; smsUseCaseDescription?: string | null; smsMessageSamples?: string[];
  smsOptInImageUrl?: string | null; optOutMessage?: string | null;
  complianceSubmittedAt?: string | null; complianceNotes?: string | null;
}
interface AvailNumber { phoneNumber: string; friendlyName?: string; locality?: string; region?: string; capabilities?: { sms?: boolean }; monthlyRentalCost?: number; }

export function SmsVerify({ onDone }: { onDone?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("NOT_STARTED");

  // form
  const [useCase, setUseCase] = useState("marketing");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("US");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [description, setDescription] = useState("");
  const [samples, setSamples] = useState<string[]>(["", ""]);
  const [optIn, setOptIn] = useState<string[]>([]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/sms/compliance").then((r) => r.json()).catch(() => null);
    if (j?.success && j.data) {
      setStatus(j.data.status || "NOT_STARTED");
      const c = (j.data.compliance || {}) as Compliance;
      if (c.smsUseCase) setUseCase(c.smsUseCase);
      if (c.businessName) setBusinessName(c.businessName);
      if (c.businessWebsite) setWebsite(c.businessWebsite);
      if (c.businessStreetAddress) setStreet(c.businessStreetAddress);
      if (c.businessCity) setCity(c.businessCity);
      if (c.businessStateProvinceRegion) setRegion(c.businessStateProvinceRegion);
      if (c.businessPostalCode) setPostal(c.businessPostalCode);
      if (c.businessCountry) setCountry(c.businessCountry);
      if (c.privacyPolicyUrl) setPrivacyUrl(c.privacyPolicyUrl);
      if (c.termsOfServiceUrl) setTermsUrl(c.termsOfServiceUrl);
      if (c.smsUseCaseDescription) setDescription(c.smsUseCaseDescription);
      if (c.smsMessageSamples?.length) setSamples([...c.smsMessageSamples, ""].slice(0, 4));
      if (c.smsOptInImageUrl) setOptIn([c.smsOptInImageUrl]);
      setSubmittedAt(c.complianceSubmittedAt || null);
      setNotes(c.complianceNotes || null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cleanSamples = samples.map((s) => s.trim()).filter(Boolean);
  const descLen = description.trim().length;
  const canSubmit = !!(businessName.trim() && website.trim() && street.trim() && city.trim() && region.trim() && postal.trim() && privacyUrl.trim() && termsUrl.trim() && useCase && descLen >= 50 && optIn.length > 0 && cleanSamples.length >= 1);

  const submit = useCallback(async () => {
    setSubmitting(true); setError(null);
    try {
      const body = {
        businessName: businessName.trim(), businessWebsite: website.trim(),
        businessStreetAddress: street.trim(), businessCity: city.trim(), businessStateProvinceRegion: region.trim(), businessPostalCode: postal.trim(), businessCountry: country.trim() || "US",
        privacyPolicyUrl: privacyUrl.trim(), termsOfServiceUrl: termsUrl.trim(),
        smsUseCase: useCase, smsUseCaseDescription: description.trim(), smsMessageSamples: cleanSamples,
        smsOptInImageUrl: optIn[0], optOutMessage: "Reply STOP to unsubscribe",
      };
      const method = status === "REJECTED" ? "PATCH" : "POST";
      const j = await fetch("/api/sms/compliance", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
      if (j?.success) { setStatus("PENDING_REVIEW"); setSubmittedAt(new Date().toISOString()); onDone?.(); }
      else setError(j?.error?.message || j?.error || "Could not submit. Please check every field.");
    } catch { setError("Could not submit — please try again."); } finally { setSubmitting(false); }
  }, [businessName, website, street, city, region, postal, country, privacyUrl, termsUrl, useCase, description, cleanSamples, optIn, status, onDone]);

  if (loading) return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your setup…" /></div>;

  // ── APPROVED → rent a number ──
  if (status === "APPROVED") return <RentNumber onDone={onDone} />;

  // ── PENDING_REVIEW → status ──
  if (status === "PENDING_REVIEW") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-500"><Hourglass className="h-7 w-7" /></span>
            <h2 className="mt-3 text-[18px] font-extrabold">Verification submitted</h2>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">We&apos;re reviewing your business + opt-in details{submittedAt ? ` (submitted ${new Date(submittedAt).toLocaleDateString()})` : ""}. Approval is usually within one business day — we&apos;ll let you know, then you can rent your sender number.</p>
          </div>
          <Stepper active="review" />
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">What you submitted</p>
            <div className="mt-2 space-y-1.5 text-[12.5px]">
              <Line k="Business" v={businessName} /><Line k="Use case" v={USE_CASES.find((u) => u.v === useCase)?.label} /><Line k="Opt-in proof" v={optIn.length ? "Uploaded ✓" : "—"} /><Line k="Sample messages" v={`${cleanSamples.length}`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── NOT_STARTED / REJECTED → intake form ──
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><ShieldCheck className="h-6 w-6" /></span>
          <div>
            <h2 className="text-[18px] font-extrabold">Get verified to send</h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">US carriers require a one-time verification before any SMS goes out. It&apos;s a quick form — reviewed within a business day, then you rent your number.</p>
          </div>
        </div>

        {status === "REJECTED" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div><p className="text-[12.5px] font-semibold text-rose-500">Your last submission was rejected</p>{notes && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{notes}</p>}<p className="mt-0.5 text-[11.5px] text-muted-foreground">Fix the items below and resubmit.</p></div>
          </div>
        )}

        {/* use case */}
        <Section icon={Megaphone} title="What are you texting?" hint="Pick the main purpose — it sets your carrier registration.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {USE_CASES.map((u) => {
              const on = useCase === u.v;
              return (
                <button key={u.v} onClick={() => setUseCase(u.v)} className={cn("flex flex-col items-start gap-1.5 rounded-xl border-2 p-2.5 text-left transition", on ? "border-brand-500 bg-brand-500/5" : "border-border bg-card hover:border-brand-500/40")}>
                  <span className={cn("grid h-7 w-7 place-items-center rounded-lg", on ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}><u.icon className="h-4 w-4" /></span>
                  <b className="text-[11.5px] leading-tight">{u.label}</b>
                  <span className="text-[9.5px] leading-snug text-muted-foreground">{u.blurb}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* business */}
        <Section icon={Building2} title="Your business" hint="Carriers verify this against public records — use your real registered details.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Legal business name" value={businessName} onChange={setBusinessName} placeholder="General Computing Solutions" />
            <Field label="Website" value={website} onChange={setWebsite} placeholder="https://yourbusiness.com" />
            <Field label="Street address" value={street} onChange={setStreet} placeholder="9 Pearl St" className="sm:col-span-2" />
            <Field label="City" value={city} onChange={setCity} placeholder="Adams" />
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="State" value={region} onChange={setRegion} placeholder="MA" />
              <Field label="ZIP" value={postal} onChange={setPostal} placeholder="01220" />
            </div>
          </div>
        </Section>

        {/* compliance links */}
        <Section icon={Link2} title="Compliance links" hint="Required by carriers — the pages where customers see how you use their number.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Privacy policy URL" value={privacyUrl} onChange={setPrivacyUrl} placeholder="https://…/privacy" />
            <Field label="Terms of service URL" value={termsUrl} onChange={setTermsUrl} placeholder="https://…/terms" />
          </div>
        </Section>

        {/* opt-in proof + description */}
        <Section icon={ImageUp} title="How people opt in" hint="Show where customers agree to receive texts (a checkout checkbox, signup form, etc.).">
          <MediaUploader value={optIn} onChange={setOptIn} maxFiles={1} variant="large" label="Opt-in screenshot" description="A screenshot showing your SMS consent checkbox / form" />
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">How you use SMS <span className="text-muted-foreground/70">(min 50 characters)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="e.g. We text opted-in customers about order updates, appointment reminders, and occasional promotions. Customers opt in at checkout and can reply STOP to unsubscribe." className="w-full resize-y rounded-lg border border-border bg-muted/40 p-3 text-[12.5px] leading-relaxed outline-none focus:border-brand-500" />
            <p className={cn("mt-1 text-[10.5px]", descLen >= 50 ? "text-emerald-500" : "text-muted-foreground")}>{descLen} / 50 characters</p>
          </div>
        </Section>

        {/* samples */}
        <Section icon={MessageSquare} title="Sample messages" hint="A couple of real examples of what you'll send — include your opt-out line.">
          <div className="space-y-2">
            {samples.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <textarea value={s} onChange={(e) => setSamples((arr) => arr.map((x, n) => (n === i ? e.target.value : x)))} rows={2} placeholder={i === 0 ? "Hi {name}! 15% off this week — reply STOP to opt out." : "Another example…"} className="flex-1 resize-y rounded-lg border border-border bg-muted/40 p-2.5 text-[12px] outline-none focus:border-brand-500" />
                {samples.length > 1 && <button onClick={() => setSamples((arr) => arr.filter((_, n) => n !== i))} className="mt-1 text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            {samples.length < 4 && <button onClick={() => setSamples((arr) => [...arr, ""])} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-400 hover:text-brand-500"><Plus className="h-3.5 w-3.5" /> Add a sample</button>}
          </div>
        </Section>

        {error && <p className="inline-flex items-start gap-1.5 text-[12px] text-rose-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</p>}

        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <span className="text-[11px] text-muted-foreground">Reviewed within ~1 business day · nothing is charged yet.</span>
          <button onClick={submit} disabled={!canSubmit || submitting} className={cn("ms-auto inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[13.5px] font-bold text-white transition", canSubmit && !submitting ? "bg-gradient-to-r from-brand-500 to-violet-500 shadow-lg shadow-brand-500/30" : "cursor-not-allowed bg-muted text-muted-foreground")}>
            {submitting ? <FlowLoader size={15} /> : <ShieldCheck className="h-4 w-4" />} Submit for review
          </button>
        </div>
      </div>
    </div>
  );
}

// ── rent number step (after approval) ────────────────────────────────────────
function RentNumber({ onDone }: { onDone?: () => void }) {
  const [areaCode, setAreaCode] = useState("");
  const [numbers, setNumbers] = useState<AvailNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [rentingId, setRentingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setSearching(true); setError(null); setNumbers([]);
    const qs = new URLSearchParams({ country: "US", numberType: "local", limit: "9" });
    if (areaCode.trim()) qs.set("areaCode", areaCode.trim());
    const j = await fetch(`/api/sms/numbers?${qs.toString()}`).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data?.numbers) setNumbers(j.data.numbers as AvailNumber[]);
    else setError(j?.error?.message || "Could not search numbers.");
    setSearching(false);
  }, [areaCode]);
  useEffect(() => { void search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rent = useCallback(async (phoneNumber: string) => {
    setRentingId(phoneNumber); setError(null);
    const j = await fetch("/api/sms/numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber }) }).then((r) => r.json()).catch(() => null);
    if (j?.success) { onDone?.(); }
    else setError(j?.error?.message || "Could not rent this number.");
    setRentingId(null);
  }, [onDone]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-6 w-6" /></span>
          <h2 className="mt-2 text-[16px] font-extrabold">You&apos;re verified — pick your sender number</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Renting a number kicks off carrier (A2P 10DLC) registration automatically. ~$5/mo.</p>
        </div>
        <Stepper active="number" />
        <div className="flex items-end gap-2">
          <div className="flex-1"><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Area code (optional)</label><input value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="413" className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-brand-500" /></div>
          <button onClick={search} disabled={searching} className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2 text-[12.5px] font-semibold hover:border-brand-500 disabled:opacity-60">{searching ? <FlowLoader size={14} /> : <Search className="h-4 w-4" />} Search</button>
        </div>
        {error && <p className="inline-flex items-start gap-1.5 text-[12px] text-rose-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</p>}
        {searching ? <div className="grid place-items-center py-10"><FlowLoader size={22} label="Finding numbers…" /></div> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {numbers.map((n) => (
              <div key={n.phoneNumber} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-500" /><b className="font-mono text-[14px]">{n.phoneNumber}</b></div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{[n.locality, n.region].filter(Boolean).join(", ") || "United States"}</p>
                <button onClick={() => rent(n.phoneNumber)} disabled={!!rentingId} className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">{rentingId === n.phoneNumber ? <FlowLoader size={13} /> : <ArrowRight className="h-3.5 w-3.5" />} Use this number</button>
              </div>
            ))}
            {!numbers.length && <p className="col-span-full py-6 text-center text-[12.5px] text-muted-foreground">No numbers found — try a different area code.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── bits ─────────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, hint, children }: { icon: ElementType; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Icon className="h-4 w-4" /></span>
        <div><h3 className="text-[13.5px] font-bold">{title}</h3><p className="text-[11px] text-muted-foreground">{hint}</p></div>
      </div>
      {children}
    </section>
  );
}
function Field({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" />
    </div>
  );
}
function Line({ k, v }: { k: string; v?: string | null }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{k}</span><b className="truncate text-right">{v || "—"}</b></div>;
}
function Stepper({ active }: { active: "review" | "number" | "a2p" | "ready" }) {
  const steps: { k: string; label: string; icon: ElementType }[] = [
    { k: "review", label: "Business review", icon: ShieldCheck },
    { k: "number", label: "Rent a number", icon: Phone },
    { k: "a2p", label: "Carrier registration", icon: Sparkles },
    { k: "ready", label: "Ready to send", icon: CheckCircle2 },
  ];
  const idx = steps.findIndex((s) => s.k === active);
  return (
    <div className="my-4 flex items-center gap-1">
      {steps.map((s, i) => {
        const done = i < idx, cur = i === idx;
        return (
          <div key={s.k} className="flex flex-1 items-center gap-1">
            <div className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2", cur ? "border-brand-500/40 bg-brand-500/5" : done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card")}>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg", cur ? "bg-brand-500/15 text-brand-500" : done ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>{done ? <CheckCircle2 className="h-3.5 w-3.5" /> : cur ? <Hourglass className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}</span>
              <span className={cn("truncate text-[10.5px] font-semibold", cur ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <RotateCw className="hidden h-3 w-3 rotate-90 text-muted-foreground/40 sm:block" style={{ transform: "none" }} />}
          </div>
        );
      })}
    </div>
  );
}
