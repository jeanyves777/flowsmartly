"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Download, Sparkles, Plus, RotateCcw, X, GripVertical } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { getProposalTheme, isServiceProposalContent } from "@/lib/pitch/proposal-detail-helpers";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import { PitchDocument, Editable } from "./pitch-document";
import { ProposalDeckPreview } from "@/components/pitch/proposal-deck-preview";

/**
 * Pitch Studio — the branded proposal PLAYGROUND for one lead (per the approved
 * mock, design/pitch-playground-mockup.html): agent chat left (from the focused
 * shell), the WYSIWYG branded document center (PitchDocument — NOT the legacy
 * renderer), and a right rail (Design / Sections / Type). Direct-manipulation:
 * click text to edit, "Edit with AI" hands a block to the agent, Type toggles
 * proposal-deck ⟷ cold-pitch-email. [[agent-writes-into-ui-element-not-chat]]
 */

interface PitchTarget { leadId?: string; leadName?: string; pitchId?: string }
interface PitchRecord { id: string; businessName: string; businessUrl?: string | null; documentType: string; content: ServiceProposalContent }

export function FocusedPitchStudio({ target, onAsk, refreshKey }: { target: PitchTarget | null; onAsk: (p: string) => void; refreshKey?: number }) {
  const { toast } = useToast();
  const [pitch, setPitch] = useState<PitchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [docType, setDocType] = useState<"deck" | "visual" | "email">("deck");
  const [tab, setTab] = useState<"design" | "sections" | "type">("design");
  const [ai, setAi] = useState<{ field: string; current: string } | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const baselineRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadById = useCallback(async (id: string): Promise<boolean> => {
    const d = await fetch(`/api/pitch/${id}`).then((r) => r.json()).catch(() => null);
    const p = d?.data?.pitch;
    if (p && p.pitchContent && isServiceProposalContent(p.pitchContent)) {
      setPitch({ id: p.id, businessName: p.businessName, businessUrl: p.businessUrl, documentType: p.documentType, content: p.pitchContent as ServiceProposalContent });
      dirtyRef.current = false;
      return true;
    }
    return false;
  }, []);

  const newestForLead = useCallback(async (leadId: string, leadName: string): Promise<string | null> => {
    const byLead = await fetch(`/api/pitch?savedLeadId=${leadId}&documentType=service_proposal&limit=1`).then((r) => r.json()).catch(() => null);
    const linked = byLead?.data?.pitches?.[0]?.id;
    if (linked) return linked;
    const recent = await fetch(`/api/pitch?documentType=service_proposal&limit=8`).then((r) => r.json()).catch(() => null);
    const match = (recent?.data?.pitches || []).find((p: { id: string; businessName?: string }) => (p.businessName || "").trim().toLowerCase() === leadName.trim().toLowerCase());
    return match?.id ?? null;
  }, []);

  // Resolve which pitch to show when the target changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!target) { setLoading(false); return; }
      setLoading(true); setPitch(null); setGenerating(false);
      const id = target.pitchId || (target.leadId ? await newestForLead(target.leadId, target.leadName || "") : null);
      if (cancelled) return;
      if (id) await loadById(id);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [target, loadById, newestForLead]);

  // Poll for a freshly-generated proposal (background task); only clear the state on a real load.
  useEffect(() => {
    if (!generating || !target?.leadId) return;
    const leadId = target.leadId, leadName = target.leadName || "";
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const id = await newestForLead(leadId, leadName);
      if (id && id !== baselineRef.current) { const ok = await loadById(id); if (ok && !stop) setGenerating(false); }
    };
    void tick();
    const iv = setInterval(tick, 3500);
    const t = setTimeout(() => setGenerating(false), 180000);
    return () => { stop = true; clearInterval(iv); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, target, refreshKey]);

  // After an agent edit (edit_pitch_field) the turn ends → refreshKey bumps →
  // reload the pitch so the change shows. Skip if we have a local unsaved edit.
  useEffect(() => {
    if (!pitch || dirtyRef.current || generating) return;
    loadById(pitch.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const theme = pitch ? getProposalTheme(pitch.content) : null;
  const bs = (pitch?.content.brandSnapshot as Record<string, unknown> | undefined);
  const brandName = (pitch && (typeof pitch.content.preparedBy === "string" ? pitch.content.preparedBy : (typeof bs?.name === "string" ? bs.name : undefined))) as string | undefined;
  const logoUrl = (typeof bs?.logoUrl === "string" ? bs.logoUrl : typeof bs?.iconLogoUrl === "string" ? bs.iconLogoUrl : null);

  // Debounced autosave of the edited document.
  const commit = useCallback((next: ServiceProposalContent) => {
    setPitch((p) => (p ? { ...p, content: next } : p));
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const id = pitch?.id;
    saveTimer.current = setTimeout(async () => {
      if (!id) return;
      await fetch(`/api/pitch/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pitchContent: next }) }).catch(() => {});
      dirtyRef.current = false;
    }, 900);
  }, [pitch?.id]);

  const editWithAI = (field: string, current: string) => { setAi({ field, current }); setAiInstruction(""); };
  const runAi = () => {
    if (!ai || !pitch) return;
    onAsk(`In Pitch Studio, rewrite the "${ai.field}" of the proposal (pitchId: ${pitch.id}). ${aiInstruction.trim() ? `Change: ${aiInstruction.trim()}. ` : "Make it sharper and on-brand. "}Current value: "${ai.current.slice(0, 600)}". Compose the new copy in my brand voice and call edit_pitch_field with pitchId="${pitch.id}", field="${ai.field}", and the new value. Don't paste it in the chat.`);
    setAi(null);
    toast({ title: "On it", description: `The agent is rewriting the ${ai.field}.` });
  };

  const generate = async () => {
    if (!target?.leadId) return;
    baselineRef.current = await newestForLead(target.leadId, target.leadName || "");
    setGenerating(true);
    onAsk(`Create a branded proposal for the lead "${target.leadName}" (savedLeadId: ${target.leadId}) in Pitch Studio — draw the services + value from my Brand Kit. Call propose_plan first (AI_SERVICE_PROPOSAL) so I can approve, then call create_proposal with savedLeadId="${target.leadId}", targetName="${target.leadName}", and a fitting serviceTitle + serviceDescription. Don't paste the proposal in the chat — it opens here in the studio.`);
  };

  const downloadPdf = async () => {
    if (!pitch) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/pitch/${pitch.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfOnly: true }) });
      if (res.ok) {
        const blob = await res.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${pitch.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      } else toast({ title: "PDF not ready", description: "Try again in a moment." });
    } catch { /* ignore */ } finally { setDownloading(false); }
  };

  const useInAutomation = () => {
    if (!pitch || !target) return;
    onAsk(`Attach the proposal (pitchId: ${pitch.id}) for "${target.leadName || pitch.businessName}" to the initial-pitch email step of this lead's outreach automation — call build_sequence_step with that pitchId so it's attached as the PDF. If there's no automation for the list yet, tell me to open the list's Pipeline first.`);
    toast({ title: "Attaching to automation", description: "The agent is adding this proposal to the pitch step." });
  };

  if (!target) return <div className="grid min-h-0 flex-1 place-items-center p-8 text-center text-[13px] text-muted-foreground">Open Pitch Studio from a lead to draft a tailored proposal.</div>;
  const displayName = target.leadName || pitch?.businessName || "this lead";
  const canGenerate = !!target.leadId;

  // Body states: loading / generating / empty.
  const body = (() => {
    if (loading) return <div className="grid h-full place-items-center"><FlowLoader size={28} withMark label="Opening Pitch Studio…" /></div>;
    if (generating && !pitch) return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-sm"><div className="mx-auto w-fit"><FlowLoader size={40} withMark /></div>
          <h3 className="mt-4 text-[15px] font-bold">Designing {displayName}’s proposal…</h3>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">The agent is researching them and building a branded, PDF-ready proposal from your Brand Kit. It’ll open here when it’s ready.</p>
        </div>
      </div>
    );
    if (!pitch || !theme) return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-md"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-7 w-7" /></span>
          {canGenerate ? (<>
            <h3 className="mt-4 text-[15px] font-bold">Draft a proposal for {displayName}</h3>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">The agent researches this prospect and builds a branded, PDF-ready proposal from your Brand Kit. Edit every block here and attach it to your outreach.</p>
            <button onClick={generate} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Generate proposal</button>
          </>) : (<>
            <h3 className="mt-4 text-[15px] font-bold">Proposal not found</h3>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">It may still be generating, or was removed. Open Pitch Studio from the lead to draft a new one.</p>
          </>)}
        </div>
      </div>
    );
    // Loaded — one of the three types.
    if (docType === "email") {
      return <EmailPreview content={pitch.content} theme={theme} businessName={pitch.businessName} brandName={brandName || "Your brand"} logoUrl={logoUrl} onChange={commit} onEditWithAI={editWithAI} onPunchUp={() => onAsk(`Rewrite the COLD PITCH EMAIL for "${displayName}" (pitchId: ${pitch!.id}) — make it high-energy and punchy: a bold one-line hook, 2-3 crisp benefit lines, and a confident CTA (NOT the long formal proposal summary). Keep it short. Save the new opener to the proposal's executiveSummary and the subject via edit_pitch_field (fields "subject" and "executiveSummary"). Don't paste it in chat.`)} />;
    }
    if (docType === "visual") {
      // The image-rich 16:9 slide deck — the on-screen twin of the PDF. Read-only
      // here; edit the copy on the Proposal-deck tab (it shares the same content).
      return (
        <div className="min-h-full overflow-x-auto bg-[#0b0d12] px-4 py-6">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between pb-3">
            <span className="text-[11.5px] text-muted-foreground">The branded visual deck (matches the PDF). Edit the copy on the Proposal-deck tab — it updates here.</span>
            <button onClick={() => onAsk(`Regenerate the branded VISUAL assets (cover/about/impact images) for the "${displayName}" proposal (pitchId: ${pitch!.id}) — pick on-brand images that fit the business type and attach them so the visual deck refreshes. Don't paste in chat.`)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-violet-500/40 px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-300 hover:bg-violet-500/10"><Sparkles className="h-3.5 w-3.5" /> Regenerate visuals</button>
          </div>
          <ProposalDeckPreview proposal={pitch.content} brandName={brandName || "Your brand"} businessUrl={pitch.businessUrl || undefined} theme={theme} />
        </div>
      );
    }
    return <div className="px-4 py-6 sm:px-6"><PitchDocument content={pitch.content} theme={theme} brandName={brandName || "Your brand"} businessName={pitch.businessName} logoUrl={logoUrl} onChange={commit} onEditWithAI={editWithAI} /></div>;
  })();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold leading-tight">Pitch Studio</div>
          <div className="truncate text-[11px] text-muted-foreground">{brandName ? `${brandName} → ` : ""}{displayName} · branded to your Brand Kit</div>
        </div>
        {pitch && (
          <select value={docType} onChange={(e) => setDocType(e.target.value as "deck" | "visual" | "email")} className="ml-2 rounded-[9px] border border-border bg-background px-2.5 py-1.5 text-[12px] font-bold outline-none focus:border-brand-500/60">
            <option value="deck">📄 Proposal deck</option>
            <option value="visual">🖼️ Visual deck (images)</option>
            <option value="email">✉️ Cold pitch email</option>
          </select>
        )}
        <div className="ms-auto flex items-center gap-2">
          {pitch && canGenerate && <button onClick={generate} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /> Regenerate</button>}
          {pitch && <button onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-50">{downloading ? <FlowLoader size={13} /> : <Download className="h-3.5 w-3.5" />} PDF</button>}
          {pitch && <button onClick={useInAutomation} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Use in automation</button>}
        </div>
      </div>

      {/* document + right rail */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        {pitch && theme && (
          <aside className="hidden w-[248px] shrink-0 flex-col border-s border-border bg-card/40 lg:flex">
            <div className="flex border-b border-border">
              {(["design", "sections", "type"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("flex-1 py-2.5 text-[12px] font-bold capitalize", tab === t ? "border-b-2 border-brand-500 text-foreground" : "text-muted-foreground")}>{t}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              {tab === "design" ? <DesignTab theme={theme} content={pitch.content} /> : tab === "sections" ? <SectionsTab content={pitch.content} onChange={commit} onAsk={onAsk} pitchId={pitch.id} /> : <TypeTab docType={docType} setDocType={setDocType} />}
            </div>
          </aside>
        )}
      </div>

      {/* Edit-with-AI popover */}
      {ai && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={() => setAi(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-[13px] font-bold"><Sparkles className="h-4 w-4 text-violet-400" /> Edit “{ai.field}” with AI <button onClick={() => setAi(null)} className="ms-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="p-4">
              <textarea autoFocus value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} rows={3} placeholder="Tell the agent how to change this block — e.g. “make it punchier, mention their 4.5★ rating”. Leave blank to just improve it." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
              <div className="mt-2 flex flex-wrap gap-1.5">{["Make it shorter", "More formal", "Add a stat", "Rewrite in brand voice"].map((c) => <button key={c} onClick={() => setAiInstruction((v) => (v ? v + "; " : "") + c.toLowerCase())} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">{c}</button>)}</div>
            </div>
            <div className="flex gap-2 px-4 pb-4"><button onClick={() => setAi(null)} className="flex-1 rounded-[10px] border border-border px-3 py-2 text-[12.5px] font-semibold text-muted-foreground">Cancel</button><button onClick={runAi} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-4 w-4" /> Rewrite</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Right-rail tabs ── */
function DesignTab({ theme, content }: { theme: { primary: string; secondary: string; accent: string; bg: string; ink: string }; content: ServiceProposalContent }) {
  const swatches: [string, string][] = [["Primary", theme.primary], ["Secondary", theme.secondary], ["Accent", theme.accent], ["Paper", theme.bg], ["Ink", theme.ink]];
  const typo = (content.design?.typography || {}) as { headline?: string; body?: string };
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Brand colours (from your Brand Kit)</p>
        <div className="flex gap-2">{swatches.map(([label, c]) => <div key={label} title={label} className="h-8 w-8 rounded-lg border-2 border-white/15" style={{ background: c }} />)}</div>
      </div>
      <div>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Typography</p>
        <div className="rounded-[9px] border border-border bg-card px-3 py-2 text-[12px]">Aa · <span className="text-muted-foreground">Headline{typo.headline ? ` · ${typo.headline}` : " · Georgia"}</span></div>
        <div className="mt-1.5 rounded-[9px] border border-border bg-card px-3 py-2 text-[12px]">Aa · <span className="text-muted-foreground">Body{typo.body ? ` · ${typo.body}` : " · Arial"}</span></div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Colours, fonts and logo come from your Brand Kit, so every proposal looks like you. Edit the Brand Kit to restyle every proposal (and the PDF).</p>
    </div>
  );
}

function SectionsTab({ content, onChange, onAsk, pitchId }: { content: ServiceProposalContent; onChange: (c: ServiceProposalContent) => void; onAsk: (p: string) => void; pitchId: string }) {
  const rows: { label: string; clear?: () => void }[] = [
    { label: "Cover" },
    { label: "Overview" },
    ...(content.aboutBrand ? [{ label: "About", clear: () => onChange({ ...content, aboutBrand: "" }) }] : []),
    ...((content.deliverables?.length ?? 0) > 0 ? [{ label: "Deliverables", clear: () => onChange({ ...content, deliverables: [] }) }] : []),
    ...((content.commitments?.length ?? 0) > 0 ? [{ label: "Commitments", clear: () => onChange({ ...content, commitments: [] }) }] : []),
    ...((content.benefits?.length ?? 0) > 0 ? [{ label: "Benefits", clear: () => onChange({ ...content, benefits: [] }) }] : []),
    ...((content.proofPoints?.length ?? 0) > 0 ? [{ label: "Proof", clear: () => onChange({ ...content, proofPoints: [] }) }] : []),
    ...(content.pricing?.name || typeof content.pricing?.amount === "number" ? [{ label: "Pricing" }] : []),
    ...((content.timeline?.length ?? 0) > 0 ? [{ label: "Timeline", clear: () => onChange({ ...content, timeline: [] }) }] : []),
    { label: "Booking CTA" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Sections</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 rounded-[9px] border border-border bg-card px-2.5 py-2 text-[12px]">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" /> {r.label}
          {r.clear && <button onClick={r.clear} className="ms-auto text-muted-foreground hover:text-rose-400"><X className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
      <button onClick={() => onAsk(`Add a new section to the proposal (pitchId: ${pitchId}) — pick a fitting one (case study, guarantee, FAQ…) and fill it from my Brand Kit, then save it with edit_pitch_field / update the proposal so it shows in the studio.`)} className="mt-1 w-full rounded-[9px] border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-brand-400 hover:border-brand-500/60">＋ Add section (agent fills it)</button>
    </div>
  );
}

function TypeTab({ docType, setDocType }: { docType: "deck" | "visual" | "email"; setDocType: (t: "deck" | "visual" | "email") => void }) {
  const opts: { id: "deck" | "visual" | "email"; label: string; desc: string }[] = [
    { id: "deck", label: "📄 Proposal deck", desc: "Clean, text-forward branded proposal — PDF-ready." },
    { id: "visual", label: "🖼️ Visual deck (images)", desc: "Image-rich style with the business-type asset images baked in — replace or regenerate any with AI." },
    { id: "email", label: "✉️ Cold pitch email", desc: "Short, high-energy outreach email with the proposal attached." },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Pitch type</p>
      {opts.map((o) => (
        <button key={o.id} onClick={() => setDocType(o.id)} className={cn("w-full rounded-[10px] border p-3 text-left", docType === o.id ? "border-brand-500 bg-brand-500/10" : "border-border")}><div className="text-[13px] font-bold">{o.label}</div><div className="text-[11px] text-muted-foreground">{o.desc}</div></button>
      ))}
      <p className="text-[11px] leading-relaxed text-muted-foreground">“Use in automation” drops this into the initial-pitch email step, with the proposal PDF attached.</p>
    </div>
  );
}

/* ── Cold-pitch email — an energetic, branded, editable outreach email ── */
function EmailPreview({ content, theme, businessName, brandName, logoUrl, onChange, onEditWithAI, onPunchUp }: {
  content: ServiceProposalContent; theme: { primary: string; secondary: string; accent: string; ink: string };
  businessName: string; brandName: string; logoUrl?: string | null;
  onChange: (next: ServiceProposalContent) => void; onEditWithAI: (field: string, current: string) => void; onPunchUp: () => void;
}) {
  const bullets = (content.commitments?.length ? content.commitments : content.benefits || []).slice(0, 3);
  const to = content.preparedFor || businessName;
  const set = (k: keyof ServiceProposalContent, v: string) => onChange({ ...content, [k]: v });
  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[640px] items-center justify-between pb-3">
        <span className="text-[11.5px] text-muted-foreground">A short, high-energy outreach email — the proposal rides along as the PDF.</span>
        <button onClick={onPunchUp} className="inline-flex items-center gap-1.5 rounded-[9px] border border-violet-500/40 px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-300 hover:bg-violet-500/10"><Sparkles className="h-3.5 w-3.5" /> Punch it up with AI</button>
      </div>
      <div className="mx-auto max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {/* branded header band */}
        <div className="flex items-center gap-3 px-7 py-4 text-white" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
          {logoUrl ? <img src={logoUrl} alt={brandName} className="h-6 w-auto object-contain" /> : <span className="text-[14px] font-extrabold tracking-wide" style={{ fontFamily: "Arial, sans-serif" }}>{brandName}</span>}
          <span className="ms-auto rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ fontFamily: "Arial, sans-serif" }}>Quick note for {to}</span>
        </div>
        <div className="p-7 text-[color:var(--ink)]" style={{ ["--ink" as string]: theme.ink, fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a2]">Subject</div>
          <Editable as="div" value={content.subject || content.title} onCommit={(v) => set("subject", v)} onAI={() => onEditWithAI("subject", content.subject || content.title)} className="text-[17px] font-extrabold leading-tight" />
          <p className="mt-4 text-[15px] font-bold">Hey {to} 👋</p>
          <Editable as="p" value={content.executiveSummary} onCommit={(v) => set("executiveSummary", v)} onAI={() => onEditWithAI("executiveSummary", content.executiveSummary)} className="mt-1 text-[14.5px] leading-relaxed text-[#26313f]" multiline />
          {bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] text-[#1f2937]"><span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: theme.primary }}>✓</span><span>{b}</span></li>
              ))}
            </ul>
          )}
          <div className="mt-5"><span className="inline-block rounded-full px-5 py-2.5 text-[13.5px] font-extrabold text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>Grab a 15-min call →</span></div>
          <p className="mt-4 text-[13.5px] text-[#6a7280]">Talk soon,<br/><b style={{ color: theme.ink }}>{brandName}</b></p>
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5" style={{ borderColor: `${theme.primary}55`, background: `${theme.primary}0d` }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: theme.primary }}>📎</span>
            <div className="text-[12.5px]"><b>{businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf</b><div className="text-[11.5px] text-[#6a7280]">The full branded proposal — edit it on the Proposal-deck tab.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
