"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Download, Sparkles, Plus } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { ProposalDocumentWorkspace } from "@/components/pitch/proposal-workspace";
import { getProposalTheme, isServiceProposalContent } from "@/lib/pitch/proposal-detail-helpers";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";

/**
 * Pitch Studio — the branded proposal playground for one lead. It mounts the
 * WYSIWYG ProposalDocumentWorkspace (same renderer as the PDF, themed from the
 * user's Brand Kit) so the user sees + edits exactly what the prospect receives.
 * Opened from a lead (detail sheet / pipeline). Phase 1: load → render → save an
 * existing proposal, or generate one for the lead if none exists yet.
 * [[lead-studio-redesign-approved]]
 */

interface PitchTarget { leadId: string; leadName: string; pitchId?: string }
interface PitchRecord {
  id: string; businessName: string; businessUrl?: string | null; documentType: string;
  recipientName?: string | null; recipientEmail?: string | null; content: ServiceProposalContent;
}

export function FocusedPitchStudio({ target, onAsk, refreshKey }: { target: PitchTarget | null; onAsk: (p: string) => void; refreshKey?: number }) {
  const { toast } = useToast();
  const [pitch, setPitch] = useState<PitchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const baselineRef = useRef<string | null>(null); // newest pitch id before a generate

  const loadById = useCallback(async (id: string): Promise<boolean> => {
    const d = await fetch(`/api/pitch/${id}`).then((r) => r.json()).catch(() => null);
    const p = d?.data?.pitch;
    if (p && p.pitchContent && isServiceProposalContent(p.pitchContent)) {
      setPitch({ id: p.id, businessName: p.businessName, businessUrl: p.businessUrl, documentType: p.documentType, recipientName: p.recipientName, recipientEmail: p.recipientEmail, content: p.pitchContent as ServiceProposalContent });
      return true;
    }
    return false;
  }, []);

  // Find the newest proposal for this lead (used on open + to detect a new one after generate).
  const newestForLead = useCallback(async (leadId: string): Promise<string | null> => {
    const j = await fetch(`/api/pitch?savedLeadId=${leadId}&documentType=service_proposal&limit=1`).then((r) => r.json()).catch(() => null);
    return j?.data?.pitches?.[0]?.id ?? null;
  }, []);

  // Resolve which pitch to show when the target changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!target) { setLoading(false); return; }
      setLoading(true); setPitch(null); setGenerating(false);
      const id = target.pitchId || (await newestForLead(target.leadId));
      if (cancelled) return;
      if (id) await loadById(id);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [target, loadById, newestForLead]);

  // While generating, poll for the freshly-created proposal (a background task —
  // it lands after the agent turn, so refreshKey alone won't catch it).
  useEffect(() => {
    if (!generating || !target) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const id = await newestForLead(target.leadId);
      if (id && id !== baselineRef.current) { await loadById(id); setGenerating(false); }
    };
    void tick();
    const iv = setInterval(tick, 3500);
    const timeout = setTimeout(() => setGenerating(false), 180000); // give up after 3 min
    return () => { stop = true; clearInterval(iv); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, target, refreshKey]);

  const theme = pitch ? getProposalTheme(pitch.content) : null;
  const brandName = (pitch && (typeof pitch.content.preparedBy === "string" ? pitch.content.preparedBy : (pitch.content.brandSnapshot as Record<string, unknown> | undefined)?.name)) as string | undefined;

  const onSaveProposal = useCallback(async (next: ServiceProposalContent): Promise<boolean> => {
    if (!pitch) return false;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/pitch/${pitch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pitchContent: next }) });
      const d = await res.json().catch(() => null);
      if (d?.success && d.data?.pitch?.pitchContent) {
        setPitch((p) => (p ? { ...p, content: d.data.pitch.pitchContent as ServiceProposalContent } : p));
        toast({ title: "Saved", description: "Your proposal edits are saved." });
        return true;
      }
      toast({ title: "Couldn't save", description: "Please try again in a moment." });
      return false;
    } catch { return false; } finally { setIsSaving(false); }
  }, [pitch, toast]);

  const generate = async () => {
    if (!target) return;
    baselineRef.current = await newestForLead(target.leadId);
    setGenerating(true);
    onAsk(
      `Create a branded proposal for the lead "${target.leadName}" (savedLeadId: ${target.leadId}) in Pitch Studio — draw the services + value from my Brand Kit. Call propose_plan first (AI_SERVICE_PROPOSAL) so I can approve, then call create_proposal with savedLeadId="${target.leadId}", targetName="${target.leadName}", and a fitting serviceTitle + serviceDescription. Don't paste the proposal in the chat — it opens here in the studio.`,
    );
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
    onAsk(`Attach the proposal (pitchId: ${pitch.id}) for "${target.leadName}" to the initial-pitch email step of this lead's outreach automation — call build_sequence_step with that pitchId so it's attached as the PDF. If there's no automation for the list yet, tell me to open the list's Pipeline first.`);
    toast({ title: "Attaching to automation", description: "The agent is adding this proposal to the pitch step." });
  };

  if (!target) {
    return <div className="grid min-h-0 flex-1 place-items-center p-8 text-center text-[13px] text-muted-foreground">Open Pitch Studio from a lead to draft a tailored proposal.</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold leading-tight">Pitch for {target.leadName}</div>
          <div className="truncate text-[11px] text-muted-foreground">{brandName ? `From ${brandName} · ` : ""}branded to your Brand Kit</div>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {pitch && (
            <>
              <button onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-50">{downloading ? <FlowLoader size={13} /> : <Download className="h-3.5 w-3.5" />} PDF</button>
              <button onClick={useInAutomation} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Use in automation</button>
            </>
          )}
        </div>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid h-full place-items-center"><FlowLoader size={28} withMark label="Opening Pitch Studio…" /></div>
        ) : generating && !pitch ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto w-fit"><FlowLoader size={40} withMark /></div>
              <h3 className="mt-4 text-[15px] font-bold">Designing {target.leadName}’s proposal…</h3>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">The agent is researching them and building a branded, PDF-ready proposal from your Brand Kit. It’ll open here when it’s ready.</p>
            </div>
          </div>
        ) : pitch && theme ? (
          <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
            <ProposalDocumentWorkspace
              proposal={pitch.content}
              businessName={pitch.businessName}
              businessUrl={pitch.businessUrl || undefined}
              brandName={brandName || "Your brand"}
              theme={theme}
              isSaving={isSaving}
              onSaveProposal={onSaveProposal}
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="max-w-md">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-7 w-7" /></span>
              <h3 className="mt-4 text-[15px] font-bold">Draft a proposal for {target.leadName}</h3>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">The agent researches this prospect and builds a branded, PDF-ready proposal from your Brand Kit. You can then edit every section here and attach it to your outreach.</p>
              <button onClick={generate} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Generate proposal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
