"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles, Pencil, Plus, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";

/**
 * PitchDocument — the NEW branded WYSIWYG proposal, matching the approved
 * playground mockup (design/pitch-playground-mockup.html): a clean scrolling
 * document that looks like the PDF (branded cover gradient, serif headings,
 * deliverable cards, proof metrics, pricing bar, CTA), with direct-manipulation
 * editing — click any text to edit inline, hover for an "Edit with AI" chip that
 * hands that block to the agent, replace images, insert/reorder sections.
 * NOT the legacy ProposalDocumentWorkspace. [[agent-writes-into-ui-element-not-chat]]
 */

type Theme = { primary: string; secondary: string; accent: string; bg: string; ink: string };

interface Props {
  content: ServiceProposalContent;
  theme: Theme;
  brandName: string;
  businessName: string;
  logoUrl?: string | null;
  onChange: (next: ServiceProposalContent) => void;      // updates the draft (parent autosaves)
  onEditWithAI: (label: string, current: string) => void; // hand a block to the agent
  onReplaceImage?: (slot: string) => void;
}

/** Deep-ish immutable set of a top-level key. */
function setKey<T extends object, K extends keyof T>(obj: T, key: K, val: T[K]): T {
  return { ...obj, [key]: val };
}

export function PitchDocument({ content, theme, brandName, businessName, logoUrl, onChange, onEditWithAI, onReplaceImage }: Props) {
  const c = content;
  const set = <K extends keyof ServiceProposalContent>(k: K, v: ServiceProposalContent[K]) => onChange(setKey(c, k, v));
  const str = (k: keyof ServiceProposalContent): string => (typeof c[k] === "string" ? (c[k] as string) : "");
  const deliverables = Array.isArray(c.deliverables) ? c.deliverables : [];
  const proof = Array.isArray(c.proofPoints) ? c.proofPoints : [];
  const commitments = Array.isArray(c.commitments) ? c.commitments : [];
  const benefits = Array.isArray(c.benefits) ? c.benefits : [];
  const timeline = Array.isArray(c.timeline) ? c.timeline : [];
  const nextSteps = Array.isArray(c.nextSteps) ? c.nextSteps : [];
  const pricing = (c.pricing && typeof c.pricing === "object" ? c.pricing : {}) as { name?: string; amount?: number; originalAmount?: number; interval?: string; note?: string };
  const metricColors = [theme.primary, theme.secondary, theme.accent, "#dc2626"];

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="overflow-hidden rounded-2xl bg-white text-[color:var(--ink)] shadow-[0_20px_60px_rgba(0,0,0,0.45)]" style={{ ["--ink" as string]: theme.ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>

        {/* ── COVER ── */}
        <div className="relative px-9 pb-8 pt-8 text-white" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
          <span className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-[13px] font-bold" style={{ background: theme.accent, color: theme.ink, fontFamily: "Arial, sans-serif" }}>01</span>
          {logoUrl ? <img src={logoUrl} alt={brandName} className="h-7 w-auto object-contain" /> : <div className="text-[14px] font-extrabold tracking-wide" style={{ fontFamily: "Arial, sans-serif" }}>{brandName}</div>}
          <div className="mt-5 text-[11px] uppercase tracking-[0.14em] opacity-80" style={{ fontFamily: "Arial, sans-serif" }}>Prepared for {c.preparedFor || businessName}</div>
          <Editable as="h1" value={str("title")} onCommit={(v) => set("title", v)} onAI={() => onEditWithAI("title", str("title"))} className="mt-1.5 max-w-[85%] text-[31px] font-bold leading-[1.12]" light />
          <Editable as="p" value={str("subtitle")} onCommit={(v) => set("subtitle", v)} onAI={() => onEditWithAI("subtitle", str("subtitle"))} className="mt-2 max-w-[72%] text-[14px] opacity-90" style={{ fontFamily: "Arial, sans-serif" }} light />
          <span className="mt-5 inline-block rounded-full px-3 py-1.5 text-[11px] font-extrabold" style={{ background: theme.accent, color: theme.ink, fontFamily: "Arial, sans-serif" }}>Prepared by {c.preparedBy || brandName}</span>
        </div>

        {/* ── OVERVIEW ── */}
        <Section kicker="The opportunity" accent={theme.primary}>
          <Editable as="h2" value={str("serviceTitle") || "Overview"} onCommit={(v) => set("serviceTitle", v)} onAI={() => onEditWithAI("serviceTitle", str("serviceTitle"))} className="text-[21px] font-bold" />
          <Editable as="p" value={str("executiveSummary")} onCommit={(v) => set("executiveSummary", v)} onAI={() => onEditWithAI("executiveSummary", str("executiveSummary"))} className="mt-2 text-[14px] leading-relaxed text-[#26313f]" multiline />
          {str("clientNeed") && <Editable as="p" value={str("clientNeed")} onCommit={(v) => set("clientNeed", v)} onAI={() => onEditWithAI("clientNeed", str("clientNeed"))} className="mt-2 text-[14px] leading-relaxed text-[#26313f]" multiline />}
        </Section>

        {/* ── ABOUT ── */}
        {str("aboutBrand") && (
          <Section kicker={`About ${brandName}`} accent={theme.primary}>
            <Editable as="p" value={str("aboutBrand")} onCommit={(v) => set("aboutBrand", v)} onAI={() => onEditWithAI("aboutBrand", str("aboutBrand"))} className="text-[14px] leading-relaxed text-[#26313f]" multiline />
          </Section>
        )}

        {/* ── DELIVERABLES ── */}
        {deliverables.length > 0 && (
          <Section kicker="What you'll get" accent={theme.primary} onAdd={() => set("deliverables", [...deliverables, { title: "New deliverable", description: "Describe it…" }])}>
            <h2 className="text-[21px] font-bold">Deliverables</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {deliverables.map((d, i) => (
                <div key={i} className="group/card relative rounded-xl border border-[#e7eaee] p-3.5">
                  <button onClick={() => set("deliverables", deliverables.filter((_, j) => j !== i))} className="absolute right-2 top-2 hidden rounded-md p-0.5 text-[#9aa4b0] hover:text-[#d33] group-hover/card:block"><X className="h-3.5 w-3.5" /></button>
                  <Editable as="h4" value={d.title} onCommit={(v) => set("deliverables", deliverables.map((x, j) => (j === i ? { ...x, title: v } : x)))} className="text-[13.5px] font-bold" style={{ color: theme.secondary, fontFamily: "Arial, sans-serif" }} />
                  <Editable as="p" value={d.description} onCommit={(v) => set("deliverables", deliverables.map((x, j) => (j === i ? { ...x, description: v } : x)))} className="mt-0.5 text-[12.5px] text-[#3a4757]" multiline />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── COMMITMENTS / BENEFITS (bullets) ── */}
        {commitments.length > 0 && <BulletSection kicker="Our commitment" accent={theme.primary} items={commitments} onChange={(v) => set("commitments", v)} onAI={() => onEditWithAI("commitments", commitments.join("\n"))} />}
        {benefits.length > 0 && <BulletSection kicker="The impact" accent={theme.primary} items={benefits} onChange={(v) => set("benefits", v)} onAI={() => onEditWithAI("benefits", benefits.join("\n"))} />}

        {/* ── PROOF metrics ── */}
        {proof.length > 0 && (
          <Section kicker="Proof" accent={theme.primary}>
            <h2 className="text-[21px] font-bold">Results we drive</h2>
            <div className="mt-3 flex flex-wrap gap-6">
              {proof.map((p, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto grid h-[78px] w-[78px] place-items-center rounded-full text-[19px] font-extrabold text-white" style={{ background: metricColors[i % metricColors.length], color: metricColors[i % metricColors.length] === theme.accent ? theme.ink : "#fff", fontFamily: "Arial, sans-serif" }}>{p.metric}</div>
                  <div className="mt-1.5 text-[11px] text-[#55606e]" style={{ fontFamily: "Arial, sans-serif" }}>{p.label}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── PRICING ── */}
        {(pricing.name || typeof pricing.amount === "number") && (
          <Section kicker="Investment" accent={theme.primary}>
            <h2 className="text-[21px] font-bold">Pricing</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5 text-white" style={{ background: theme.secondary }}>
              <div>
                <div className="text-[14px] font-extrabold" style={{ fontFamily: "Arial, sans-serif" }}>{pricing.name || "Package"}</div>
                {pricing.note && <div className="text-[12px] opacity-75" style={{ fontFamily: "Arial, sans-serif" }}>{pricing.note}</div>}
              </div>
              {typeof pricing.amount === "number" && (
                <div className="ms-auto text-[26px] font-extrabold" style={{ fontFamily: "Arial, sans-serif" }}>
                  {typeof pricing.originalAmount === "number" && <s className="me-2 text-[16px] font-semibold opacity-50">${pricing.originalAmount.toLocaleString()}</s>}
                  ${pricing.amount.toLocaleString()}{pricing.interval && <span className="text-[13px] font-semibold">/{pricing.interval}</span>}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── TIMELINE ── */}
        {timeline.length > 0 && (
          <Section kicker="Timeline" accent={theme.primary}>
            <h2 className="text-[21px] font-bold">How we'll roll it out</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {timeline.map((t, i) => (
                <div key={i} className="rounded-xl border border-[#e7eaee] p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.primary, fontFamily: "Arial, sans-serif" }}>{t.label}</div>
                  <div className="mt-0.5 text-[13px] font-bold">{t.title}</div>
                  <div className="mt-0.5 text-[12px] text-[#55606e]">{t.description}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── CTA / NEXT STEPS ── */}
        <div className="px-9 py-7 text-center text-white" style={{ background: `linear-gradient(135deg, ${theme.secondary}, ${theme.primary})` }}>
          <Editable as="h2" value={nextSteps[0] || "Ready to get started?"} onCommit={(v) => set("nextSteps", [v, ...nextSteps.slice(1)])} onAI={() => onEditWithAI("nextSteps", nextSteps.join("\n"))} className="text-[22px] font-bold" light />
          <div className="mt-1 text-[13px] opacity-90" style={{ fontFamily: "Arial, sans-serif" }}>{nextSteps[1] || "Let's find 15 minutes this week to tailor this to you."}</div>
          <span className="mt-3 inline-block rounded-full px-5 py-2.5 text-[13px] font-extrabold" style={{ background: theme.accent, color: theme.ink, fontFamily: "Arial, sans-serif" }}>Book a call →</span>
        </div>

        {/* image slots note — replace hook (Phase 2b) */}
        {onReplaceImage && (
          <div className="flex items-center justify-center gap-2 border-t border-[#eef0f3] px-9 py-3 text-[11.5px] text-[#8a94a2]" style={{ fontFamily: "Arial, sans-serif" }}>
            <ImageIcon className="h-3.5 w-3.5" /> Hover a section image to replace it, or ask the agent to generate one.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Section shell ── */
function Section({ kicker, accent, children, onAdd }: { kicker: string; accent: string; children: ReactNode; onAdd?: () => void }) {
  return (
    <div className="group/sec relative border-t border-[#eef0f3] px-9 py-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: accent, fontFamily: "Arial, sans-serif" }}>{kicker}</span>
        {onAdd && <button onClick={onAdd} className="hidden items-center gap-1 rounded-full border border-[#dfe4ea] px-2 py-0.5 text-[10.5px] font-bold text-[#6a7684] group-hover/sec:inline-flex" style={{ fontFamily: "Arial, sans-serif" }}><Plus className="h-3 w-3" /> Add</button>}
      </div>
      {children}
    </div>
  );
}

/* ── Bullet-list section ── */
function BulletSection({ kicker, accent, items, onChange, onAI }: { kicker: string; accent: string; items: string[]; onChange: (v: string[]) => void; onAI: (text: string) => void }) {
  return (
    <Section kicker={kicker} accent={accent} onAdd={() => onChange([...items, "New point…"])}>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="group/li flex items-start gap-2 text-[14px] text-[#26313f]">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
            <Editable as="span" value={it} onCommit={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} onAI={() => onAI(it)} className="flex-1" multiline />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="mt-0.5 hidden text-[#9aa4b0] hover:text-[#d33] group-hover/li:block"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ── Editable text block: click to edit inline; hover shows AI + edit chips ── */
function Editable({ as: Tag = "p", value, onCommit, onAI, className, style, light, multiline }: {
  as?: "h1" | "h2" | "h4" | "p" | "span"; value: string; onCommit: (v: string) => void; onAI?: () => void;
  className?: string; style?: React.CSSProperties; light?: boolean; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.selectionStart = ref.current.value.length; } }, [editing]);

  const commit = () => { setEditing(false); if (draft !== value) onCommit(draft); };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter" && !multiline && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        rows={multiline ? 3 : 1}
        className={cn("w-full resize-y rounded-md border-2 bg-white/95 px-1.5 py-0.5 text-inherit outline-none", className)}
        style={{ borderColor: "#6366f1", color: light ? "#0b1220" : undefined, fontFamily: "inherit", ...style }}
      />
    );
  }
  return (
    <Tag
      className={cn("group/ed relative cursor-text rounded-md transition-shadow hover:shadow-[0_0_0_2px_rgba(99,102,241,0.7)]", className)}
      style={style}
      onClick={() => setEditing(true)}
    >
      {value || <span className={light ? "opacity-60" : "text-[#9aa4b0]"}>Click to add…</span>}
      <span className="absolute -top-3.5 right-1 hidden gap-0.5 rounded-md border border-border bg-[#12151c] p-0.5 shadow-lg group-hover/ed:flex" onClick={(e) => e.stopPropagation()}>
        {onAI && <button onClick={onAI} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-[#c4b5fd] hover:bg-[#20263180]" style={{ fontFamily: "Arial, sans-serif" }}><Sparkles className="h-3 w-3" /> Edit with AI</button>}
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-[#c9cfda] hover:bg-[#20263180]" style={{ fontFamily: "Arial, sans-serif" }}><Pencil className="h-3 w-3" /> Edit</button>
      </span>
    </Tag>
  );
}
