"use client";

import { Plus, X, ImageIcon, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import { Editable } from "./pitch-document";

/**
 * VisualDocument — the IMAGE-RICH proposal, fully editable and FLOWING (no page
 * breaks). Same visual language as the branded PDF/deck — bold sans-serif
 * headings, brand callout bands, metric rings, right-side business-type images,
 * timeline cards, decorative grid + circle motifs — but as one continuous,
 * click-to-edit document. Only the exported PDF paginates. Branded to the user's
 * theme. [[agent-writes-into-ui-element-not-chat]]
 */

type Theme = { primary: string; secondary: string; accent: string; bg: string; ink: string };
interface Props {
  content: ServiceProposalContent;
  theme: Theme;
  brandName: string;
  businessName: string;
  logoUrl?: string | null;
  onChange: (next: ServiceProposalContent) => void;
  onEditWithAI: (field: string, current: string) => void;
  onReplaceImage?: (slot: "cover" | "about" | "impact") => void;
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function VisualDocument({ content, theme, brandName, businessName, logoUrl, onChange, onEditWithAI, onReplaceImage }: Props) {
  const c = content;
  const set = <K extends keyof ServiceProposalContent>(k: K, v: ServiceProposalContent[K]) => onChange({ ...c, [k]: v });
  const str = (k: keyof ServiceProposalContent): string => (typeof c[k] === "string" ? (c[k] as string) : "");
  const deliverables = arr<{ title: string; description: string }>(c.deliverables);
  const commitments = arr<string>(c.commitments);
  const benefits = arr<string>(c.benefits);
  const proof = arr<{ metric: string; label: string; note: string }>(c.proofPoints);
  const timeline = arr<{ label: string; title: string; description: string }>(c.timeline);
  const terms = arr<string>(c.terms);
  const nextSteps = arr<string>(c.nextSteps);
  const contact = (c.contact || {}) as { name?: string; email?: string; phone?: string; website?: string };
  const pricing = (c.pricing || {}) as { name?: string; amount?: number; originalAmount?: number; interval?: string; note?: string };
  const images = arr<{ kind: string; url: string }>(c.visualAssets?.images);
  const imgUrl = (kind: "cover" | "about" | "impact") => images.find((im) => im.kind === kind)?.url;
  const metricColors = [theme.primary, theme.secondary, theme.accent, "#dc2626"];
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const savePricing = (patch: Partial<typeof pricing>) => set("pricing", { name: pricing.name || "Package", ...pricing, ...patch } as ServiceProposalContent["pricing"]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="relative overflow-hidden rounded-2xl bg-white text-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" style={{ fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
        {/* faint diagonal-grid motif + decorative brand circles */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(105deg,transparent 0 18%, rgba(226,232,240,0.5) 18.2%, transparent 18.6% 34%, rgba(226,232,240,0.5) 34.2%, transparent 34.6% 100%)" }} />
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full" style={{ background: `${theme.accent}20` }} />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full" style={{ background: `${theme.primary}10` }} />

        <div className="relative z-10">
          {/* ── COVER ── */}
          <div className="grid gap-8 p-9 sm:p-10 md:grid-cols-[1fr_0.85fr] md:items-center">
            <div>
              {logoUrl ? <img src={logoUrl} alt={brandName} className="max-h-12 w-auto object-contain" /> : <div className="text-[22px] font-black">{brandName}</div>}
              <p className="mt-6 text-[13px] font-semibold text-slate-500">Prepared for {c.preparedFor || businessName} · {date}</p>
              <Editable as="h1" value={str("title")} onCommit={(v) => set("title", v)} onAI={() => onEditWithAI("title", str("title"))} className="mt-4 text-[38px] font-black leading-[1.08]" />
              <Editable as="p" value={str("subtitle") || str("serviceTitle")} onCommit={(v) => set("subtitle", v)} onAI={() => onEditWithAI("subtitle", str("subtitle"))} className="mt-4 text-[19px] font-bold text-slate-600" multiline />
              <span className="mt-6 inline-block rounded-full px-6 py-3 text-[15px] font-black text-white" style={{ background: theme.primary }}>Get started →</span>
            </div>
            <VImg kind="cover" url={imgUrl("cover")} theme={theme} onReplace={onReplaceImage} big />
          </div>

          {/* ── OVERVIEW ── */}
          <VSection kicker="The opportunity" theme={theme}>
            <Editable as="h2" value={str("serviceTitle") || "Overview"} onCommit={(v) => set("serviceTitle", v)} onAI={() => onEditWithAI("serviceTitle", str("serviceTitle"))} className="text-[27px] font-black leading-tight" />
            <Editable as="p" value={str("executiveSummary")} onCommit={(v) => set("executiveSummary", v)} onAI={() => onEditWithAI("executiveSummary", str("executiveSummary"))} className="mt-3 text-[15px] leading-8 text-slate-700" multiline />
            {str("clientNeed") && <Editable as="p" value={str("clientNeed")} onCommit={(v) => set("clientNeed", v)} onAI={() => onEditWithAI("clientNeed", str("clientNeed"))} className="mt-3 text-[15px] leading-8 text-slate-700" multiline />}
          </VSection>

          {/* ── ABOUT (image + text) ── */}
          {str("aboutBrand") && (
            <VSection kicker={`About ${brandName}`} theme={theme}>
              <div className="grid gap-8 md:grid-cols-[0.85fr_1fr] md:items-center">
                <VImg kind="about" url={imgUrl("about")} theme={theme} onReplace={onReplaceImage} />
                <Editable as="p" value={str("aboutBrand")} onCommit={(v) => set("aboutBrand", v)} onAI={() => onEditWithAI("aboutBrand", str("aboutBrand"))} className="text-[15px] leading-8 text-slate-700" multiline />
              </div>
            </VSection>
          )}

          {/* ── DELIVERABLES ── */}
          {deliverables.length > 0 && (
            <VSection kicker="What you'll get" theme={theme} onAdd={() => set("deliverables", [...deliverables, { title: "New deliverable", description: "Describe it…" }])}>
              <h2 className="text-[27px] font-black">Deliverables</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {deliverables.map((d, i) => (
                  <div key={i} className="group/card relative rounded-xl border border-slate-200 p-4">
                    <button onClick={() => set("deliverables", deliverables.filter((_, j) => j !== i))} className="absolute right-2 top-2 hidden text-slate-400 hover:text-red-500 group-hover/card:block"><X className="h-3.5 w-3.5" /></button>
                    <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: theme.primary }}><CheckCircle2 className="h-4 w-4" /></span>
                    <Editable as="div" value={d.title} onCommit={(v) => set("deliverables", deliverables.map((x, j) => (j === i ? { ...x, title: v } : x)))} className="mt-2 text-[14px] font-black" />
                    <Editable as="p" value={d.description} onCommit={(v) => set("deliverables", deliverables.map((x, j) => (j === i ? { ...x, description: v } : x)))} className="mt-0.5 text-[13px] text-slate-600" multiline />
                  </div>
                ))}
              </div>
            </VSection>
          )}

          {commitments.length > 0 && <BulletVSection kicker="Our commitment" theme={theme} items={commitments} onChange={(v) => set("commitments", v)} onAI={() => onEditWithAI("commitments", commitments.join("\n"))} />}
          {benefits.length > 0 && <BulletVSection kicker="The impact" theme={theme} items={benefits} onChange={(v) => set("benefits", v)} onAI={() => onEditWithAI("benefits", benefits.join("\n"))} />}

          {/* ── PROOF: metric rings + launch timeline + impact image ── */}
          {(proof.length > 0 || timeline.length > 0) && (
            <VSection kicker="Proof" theme={theme}>
              <div className="grid gap-8 md:grid-cols-[1fr_0.7fr] md:items-start">
                <div>
                  <h2 className="text-[27px] font-black">Results we drive</h2>
                  {proof.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-6">
                      {proof.map((p, i) => (
                        <div key={i} className="group/m relative w-28 text-center">
                          <button onClick={() => set("proofPoints", proof.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 z-10 hidden rounded-full bg-white p-0.5 text-slate-400 shadow hover:text-red-500 group-hover/m:block"><X className="h-3 w-3" /></button>
                          <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full border-[7px] bg-white px-2" style={{ borderColor: metricColors[i % metricColors.length] }}>
                            <Editable as="span" value={p.metric} onCommit={(v) => set("proofPoints", proof.map((x, j) => (j === i ? { ...x, metric: v } : x)))} className={cn("break-words font-black leading-none text-slate-950", (p.metric || "").length > 6 ? "text-[12px]" : (p.metric || "").length > 4 ? "text-[15px]" : "text-[20px]")} />
                          </div>
                          <Editable as="div" value={p.label} onCommit={(v) => set("proofPoints", proof.map((x, j) => (j === i ? { ...x, label: v } : x)))} className="mt-2 text-[11px] font-semibold text-slate-600" />
                        </div>
                      ))}
                    </div>
                  )}
                  {timeline.length > 0 && (
                    <>
                      <div className="mt-8 flex items-center gap-2"><h3 className="text-[19px] font-black">Launch timeline</h3><AddBtn onClick={() => set("timeline", [...timeline, { label: "Phase", title: "New phase", description: "" }])} /></div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {timeline.map((t, i) => (
                          <div key={i} className="group/tl relative rounded-xl border border-slate-200 p-3">
                            <button onClick={() => set("timeline", timeline.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 hidden text-slate-400 hover:text-red-500 group-hover/tl:block"><X className="h-3 w-3" /></button>
                            <Editable as="div" value={t.label} onCommit={(v) => set("timeline", timeline.map((x, j) => (j === i ? { ...x, label: v } : x)))} className="text-[11px] font-black uppercase tracking-wide" style={{ color: theme.primary }} />
                            <Editable as="div" value={t.title} onCommit={(v) => set("timeline", timeline.map((x, j) => (j === i ? { ...x, title: v } : x)))} className="mt-1 text-[12.5px] font-bold" multiline />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <VImg kind="impact" url={imgUrl("impact")} theme={theme} onReplace={onReplaceImage} />
              </div>
            </VSection>
          )}

          {/* ── PRICING band ── */}
          {(pricing.name || typeof pricing.amount === "number") && (
            <VSection kicker="Investment" theme={theme}>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl px-6 py-5 text-white" style={{ background: theme.secondary }}>
                <div className="min-w-0">
                  <Editable as="div" value={pricing.name || "Package"} onCommit={(v) => savePricing({ name: v || "Package" })} className="text-[16px] font-black" light />
                  <Editable as="div" value={pricing.note || ""} onCommit={(v) => savePricing({ note: v })} className="text-[13px] opacity-80" light />
                </div>
                <div className="ms-auto flex items-baseline gap-1 text-[30px] font-black">
                  {typeof pricing.originalAmount === "number" && <s className="text-[17px] font-semibold opacity-50">${pricing.originalAmount.toLocaleString()}</s>}
                  ${<Editable as="span" value={typeof pricing.amount === "number" ? pricing.amount.toLocaleString() : ""} onCommit={(v) => { const n = Number(v.replace(/[^0-9.]/g, "")); savePricing({ amount: Number.isFinite(n) && n > 0 ? n : pricing.amount }); }} light />}
                  {pricing.interval && <span className="text-[15px] font-semibold">/{pricing.interval}</span>}
                </div>
              </div>
            </VSection>
          )}

          {/* ── TERMS + NEXT STEPS ── */}
          {(terms.length > 0 || nextSteps.length > 0) && (
            <VSection kicker="What happens next" theme={theme}>
              <div className="grid gap-10 md:grid-cols-2">
                {terms.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-[19px] font-black">Terms</h3><AddBtn onClick={() => set("terms", [...terms, "New term…"])} /></div>
                    <ul className="mt-3 space-y-2.5">
                      {terms.map((t, i) => (
                        <li key={i} className="group/li flex items-start gap-2 text-[14px] text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <Editable as="span" value={t} onCommit={(v) => set("terms", terms.map((x, j) => (j === i ? v : x)))} className="flex-1" multiline />
                          <button onClick={() => set("terms", terms.filter((_, j) => j !== i))} className="mt-0.5 hidden text-slate-400 hover:text-red-500 group-hover/li:block"><X className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nextSteps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-[19px] font-black">Next steps</h3><AddBtn onClick={() => set("nextSteps", [...nextSteps, "Next step…"])} /></div>
                    <ol className="mt-3 space-y-3">
                      {nextSteps.map((s, i) => (
                        <li key={i} className="group/li flex items-start gap-3 text-[14px] text-slate-700">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black text-white" style={{ background: theme.primary }}>{i + 1}</span>
                          <Editable as="span" value={s} onCommit={(v) => set("nextSteps", nextSteps.map((x, j) => (j === i ? v : x)))} className="flex-1 font-semibold" multiline />
                          <button onClick={() => set("nextSteps", nextSteps.filter((_, j) => j !== i))} className="mt-1 hidden text-slate-400 hover:text-red-500 group-hover/li:block"><X className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </VSection>
          )}

          {/* ── CLOSING / CONTACT ── */}
          <VSection kicker="Let's get started" theme={theme}>
            <div className="grid gap-8 md:grid-cols-[1fr_0.7fr] md:items-center">
              <div>
                <Editable as="h2" value={nextSteps[0] || "Ready to get started?"} onCommit={(v) => set("nextSteps", [v, ...nextSteps.slice(1)])} onAI={() => onEditWithAI("nextSteps", nextSteps.join("\n"))} className="text-[27px] font-black" />
                <p className="mt-3 text-[15px] leading-8 text-slate-700">{str("executiveSummary").slice(0, 220)}</p>
                <span className="mt-5 inline-block rounded-full px-6 py-3 text-[15px] font-black text-white" style={{ background: theme.primary }}>Get started →</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-[16px] font-black">{contact.name || brandName}</div>
                <div className="mt-2 space-y-1 text-[13px] text-slate-600">
                  {contact.email && <div>{contact.email}</div>}
                  {contact.phone && <div>{contact.phone}</div>}
                  {contact.website && <div style={{ color: theme.primary }}>{contact.website}</div>}
                </div>
              </div>
            </div>
          </VSection>
        </div>
      </div>
    </div>
  );
}

/* ── A flowing section with a separation line + kicker + optional Add ── */
function VSection({ kicker, theme, children, onAdd }: { kicker: string; theme: Theme; children: ReactNode; onAdd?: () => void }) {
  return (
    <div className="group/sec relative border-t border-slate-100 px-9 py-8 sm:px-10">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: theme.primary }}>{kicker}</span>
        {onAdd && <AddBtn onClick={onAdd} />}
      </div>
      {children}
    </div>
  );
}

function BulletVSection({ kicker, theme, items, onChange, onAI }: { kicker: string; theme: Theme; items: string[]; onChange: (v: string[]) => void; onAI: () => void }) {
  return (
    <VSection kicker={kicker} theme={theme} onAdd={() => onChange([...items, "New point…"])}>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="group/li flex items-start gap-3 text-[15px] leading-7 text-slate-700">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: theme.primary }} />
            <Editable as="span" value={it} onCommit={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} onAI={i === 0 ? onAI : undefined} className="flex-1" multiline />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="mt-0.5 hidden text-slate-400 hover:text-red-500 group-hover/li:block"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
    </VSection>
  );
}

function VImg({ kind, url, theme, onReplace, big }: { kind: "cover" | "about" | "impact"; url?: string; theme: Theme; onReplace?: (slot: "cover" | "about" | "impact") => void; big?: boolean }) {
  if (!url && !onReplace) return null;
  return (
    <div className="group/img relative grid place-items-center">
      {url
        ? <img src={url} alt={kind} className={cn("w-full object-contain", big ? "max-h-[360px]" : "max-h-[280px]")} />
        : <div className="grid min-h-[180px] w-full place-items-center rounded-xl text-[12px] text-slate-400" style={{ background: `${theme.primary}0d` }}>{kind} image</div>}
      {onReplace && (
        <button onClick={() => onReplace(kind)} className="absolute inset-0 hidden place-items-center rounded-xl bg-[#0b1220b3] text-white group-hover/img:grid">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><ImageIcon className="h-4 w-4" /> Replace image</span>
        </button>
      )}
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] font-bold text-slate-500 hover:border-slate-300"><Plus className="h-3 w-3" /> Add</button>;
}
