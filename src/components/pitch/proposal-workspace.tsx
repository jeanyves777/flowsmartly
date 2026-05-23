"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, FileText, Pencil, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlowActionSpinner } from "@/components/shared/ai-generation-loader";
import { StringListEditor } from "./string-list-editor";
import { cloneContent, decodeEntities, moneyLabel, normalizeLines, type ProposalTheme } from "@/lib/pitch/proposal-detail-helpers";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";

function ProposalDocumentSection({
  id,
  index,
  title,
  summary,
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  children,
  editor,
}: {
  id: string;
  index: number;
  title: string;
  summary?: string;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
  editor: ReactNode;
}) {
  return (
    <section id={`proposal-${id}`} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-500">Section {index}</div>
          <h2 className="break-words text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h2>
          {summary && <p className="mt-2 max-w-3xl text-sm italic text-muted-foreground">{summary}</p>}
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <FlowActionSpinner size={16} /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving} className="gap-1.5">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1.5">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>
      {isEditing ? editor : children}
    </section>
  );
}

function ReadableList({ items }: { items: string[] }) {
  const safeItems = (items || []).filter(Boolean);
  if (!safeItems.length) return <p className="text-sm text-muted-foreground">No items added yet.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {safeItems.map((item, index) => (
        <div key={`${item}-${index}`} className="flex gap-3 rounded-lg border border-border bg-card p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <p className="break-words text-sm leading-6 text-foreground">{decodeEntities(item)}</p>
        </div>
      ))}
    </div>
  );
}

export function ProposalDocumentWorkspace({
  proposal,
  businessName,
  businessUrl,
  brandName,
  theme,
  isSaving,
  onSaveProposal,
}: {
  proposal: ServiceProposalContent;
  businessName: string;
  businessUrl?: string;
  brandName: string;
  theme: ProposalTheme;
  isSaving: boolean;
  onSaveProposal: (proposal: ServiceProposalContent) => Promise<boolean>;
}) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceProposalContent>(() => cloneContent(proposal));

  useEffect(() => {
    if (!editingSectionId) setDraft(cloneContent(proposal));
  }, [proposal, editingSectionId]);

  const working = editingSectionId ? draft : proposal;
  const customSections = working.customSections || [];
  const contactWebsite = working.contact?.website || businessUrl || "";
  const sectionLinks = [
    { id: "overview", title: "Offer overview" },
    { id: "about", title: `About ${working.preparedBy || brandName || "us"}` },
    { id: "need", title: "Client need" },
    { id: "commitments", title: "Commitments" },
    { id: "deliverables", title: "Deliverables" },
    { id: "benefits", title: "Benefits" },
    { id: "proof", title: "Proof and findings" },
    { id: "pricing", title: "Pricing" },
    { id: "timeline", title: "Timeline" },
    { id: "terms", title: "Terms" },
    { id: "next", title: "Next steps" },
    ...customSections.map((section, index) => ({ id: `custom-${index}`, title: section.title || `Custom section ${index + 1}` })),
  ];

  const beginEdit = (sectionId: string) => {
    setDraft(cloneContent(proposal));
    setEditingSectionId(sectionId);
  };
  const cancelEdit = () => {
    setDraft(cloneContent(proposal));
    setEditingSectionId(null);
  };
  const saveDraft = async () => {
    const saved = await onSaveProposal(draft);
    if (saved) setEditingSectionId(null);
  };
  const patchDraft = (patch: Partial<ServiceProposalContent>) => setDraft((prev) => ({ ...prev, ...patch }));
  const patchPricing = (patch: Partial<ServiceProposalContent["pricing"]>) =>
    setDraft((prev) => ({ ...prev, pricing: { ...(prev.pricing || { name: "" }), ...patch } }));

  const addCustomSection = () => {
    const nextSections = [...(proposal.customSections || []), { title: "New client-specific section", body: "", bullets: [] }];
    setDraft({ ...cloneContent(proposal), customSections: nextSections });
    setEditingSectionId(`custom-${nextSections.length - 1}`);
  };

  return (
    <div className="bp-viewer-root space-y-10">
      <section
        className="relative overflow-hidden rounded-xl p-10 text-white shadow-xl md:p-14"
        style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)` }}
      >
        <div className="relative z-10 max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Service Proposal
          </div>
          <h1 className="break-words text-3xl font-bold tracking-tight md:text-5xl">{decodeEntities(working.title || `${working.serviceTitle} Proposal`)}</h1>
          <p className="mt-4 max-w-3xl break-words text-lg font-medium text-white/90 md:text-xl">{decodeEntities(working.subtitle || working.serviceTitle)}</p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm text-white/90">
            <span className="rounded-full bg-white/15 px-3 py-1">Prepared for {working.preparedFor || businessName}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">Prepared by {working.preparedBy || brandName || "FlowSmartly"}</span>
            {working.serviceTitle && <span className="rounded-full bg-white/15 px-3 py-1">{working.serviceTitle}</span>}
            {contactWebsite && <span className="rounded-full bg-white/15 px-3 py-1">{contactWebsite.replace(/^https?:\/\//, "")}</span>}
          </div>
        </div>
        <Sparkles className="absolute right-8 top-8 h-24 w-24 text-white/10" />
      </section>

      <nav>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Table of contents</h2>
          <Button variant="outline" size="sm" onClick={addCustomSection} className="gap-1.5" disabled={!!editingSectionId}>
            <Plus className="h-4 w-4" />
            Add specific section
          </Button>
        </div>
        <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {sectionLinks.map((section, index) => (
            <li key={section.id}>
              <a href={`#proposal-${section.id}`} className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-600">{index + 1}</span>
                <span className="break-words font-medium">{decodeEntities(section.title)}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ProposalDocumentSection
        id="overview"
        index={1}
        title="Offer overview"
        summary="Core message and business case."
        isEditing={editingSectionId === "overview"}
        isSaving={isSaving}
        onEdit={() => beginEdit("overview")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={draft.title || ""} onChange={(event) => patchDraft({ title: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Service package</Label>
              <Input value={draft.serviceTitle || ""} onChange={(event) => patchDraft({ serviceTitle: event.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Subtitle</Label>
              <Input value={draft.subtitle || ""} onChange={(event) => patchDraft({ subtitle: event.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Executive summary</Label>
              <Textarea rows={6} value={draft.executiveSummary || ""} onChange={(event) => patchDraft({ executiveSummary: event.target.value })} />
            </div>
          </div>
        }
      >
        <div className="prose prose-slate max-w-none dark:prose-invert">
          <p>{decodeEntities(working.executiveSummary)}</p>
        </div>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="about"
        index={2}
        title={`About ${working.preparedBy || brandName || "us"}`}
        isEditing={editingSectionId === "about"}
        isSaving={isSaving}
        onEdit={() => beginEdit("about")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={<Textarea rows={8} value={draft.aboutBrand || ""} onChange={(event) => patchDraft({ aboutBrand: event.target.value })} />}
      >
        <p className="whitespace-pre-line break-words text-base leading-8 text-foreground">{decodeEntities(working.aboutBrand)}</p>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="need"
        index={3}
        title="Client need"
        isEditing={editingSectionId === "need"}
        isSaving={isSaving}
        onEdit={() => beginEdit("need")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={<Textarea rows={8} value={draft.clientNeed || ""} onChange={(event) => patchDraft({ clientNeed: event.target.value })} />}
      >
        <p className="whitespace-pre-line break-words text-base leading-8 text-foreground">{decodeEntities(working.clientNeed)}</p>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="commitments"
        index={4}
        title="Commitments"
        isEditing={editingSectionId === "commitments"}
        isSaving={isSaving}
        onEdit={() => beginEdit("commitments")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={<StringListEditor title="Commitments" items={draft.commitments || []} onChange={(items) => patchDraft({ commitments: items })} />}
      >
        <ReadableList items={working.commitments || []} />
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="deliverables"
        index={5}
        title="Deliverables"
        isEditing={editingSectionId === "deliverables"}
        isSaving={isSaving}
        onEdit={() => beginEdit("deliverables")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={
          <div className="space-y-3">
            <Button type="button" variant="outline" size="sm" onClick={() => patchDraft({ deliverables: [...(draft.deliverables || []), { title: "", description: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            {(draft.deliverables || []).map((item, index) => (
              <div key={`deliverable-edit-${index}`} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)_auto]">
                <Input value={item.title || ""} onChange={(event) => patchDraft({ deliverables: (draft.deliverables || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) })} placeholder="Title" />
                <Textarea rows={2} value={item.description || ""} onChange={(event) => patchDraft({ deliverables: (draft.deliverables || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry) })} placeholder="Description" />
                <Button type="button" variant="ghost" size="icon" onClick={() => patchDraft({ deliverables: (draft.deliverables || []).filter((_, entryIndex) => entryIndex !== index) })}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {(working.deliverables || []).map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground">{decodeEntities(item.title)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{decodeEntities(item.description)}</p>
            </div>
          ))}
        </div>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="benefits"
        index={6}
        title="Benefits"
        isEditing={editingSectionId === "benefits"}
        isSaving={isSaving}
        onEdit={() => beginEdit("benefits")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={<StringListEditor title="Benefits" items={draft.benefits || []} onChange={(items) => patchDraft({ benefits: items })} />}
      >
        <ReadableList items={working.benefits || []} />
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="proof"
        index={7}
        title="Proof and findings"
        summary="Verified signals and realistic outcome points."
        isEditing={editingSectionId === "proof"}
        isSaving={isSaving}
        onEdit={() => beginEdit("proof")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={
          <div className="space-y-3">
            <Button type="button" variant="outline" size="sm" onClick={() => patchDraft({ proofPoints: [...(draft.proofPoints || []), { metric: "", label: "", note: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            {(draft.proofPoints || []).map((item, index) => (
              <div key={`proof-edit-${index}`} className="space-y-2 rounded-lg border border-border p-3">
                <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)_auto]">
                  <Input value={item.metric || ""} onChange={(event) => patchDraft({ proofPoints: (draft.proofPoints || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, metric: event.target.value } : entry) })} placeholder="2-3x" />
                  <Input value={item.label || ""} onChange={(event) => patchDraft({ proofPoints: (draft.proofPoints || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) })} placeholder="Label" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => patchDraft({ proofPoints: (draft.proofPoints || []).filter((_, entryIndex) => entryIndex !== index) })}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <Textarea rows={2} value={item.note || ""} onChange={(event) => patchDraft({ proofPoints: (draft.proofPoints || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, note: event.target.value } : entry) })} placeholder="Finding or proof note" />
              </div>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(working.proofPoints || []).map((point, index) => (
            <div key={`${point.metric}-${point.label}-${index}`} className="rounded-lg border border-border bg-card p-4">
              <div className="text-2xl font-black" style={{ color: [theme.primary, theme.secondary, theme.accent, "#dc2626"][index % 4] }}>{decodeEntities(point.metric)}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{decodeEntities(point.label)}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{decodeEntities(point.note)}</p>
            </div>
          ))}
        </div>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="pricing"
        index={8}
        title="Pricing"
        isEditing={editingSectionId === "pricing"}
        isSaving={isSaving}
        onEdit={() => beginEdit("pricing")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Pricing name</Label>
              <Input value={draft.pricing?.name || ""} onChange={(event) => patchPricing({ name: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input type="number" value={draft.pricing?.amount ?? ""} onChange={(event) => patchPricing({ amount: event.target.value ? Number(event.target.value) : undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label>Original price</Label>
              <Input type="number" value={draft.pricing?.originalAmount ?? ""} onChange={(event) => patchPricing({ originalAmount: event.target.value ? Number(event.target.value) : undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label>Interval</Label>
              <Input value={draft.pricing?.interval || ""} onChange={(event) => patchPricing({ interval: event.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-4">
              <Label>Pricing note</Label>
              <Textarea rows={3} value={draft.pricing?.note || ""} onChange={(event) => patchPricing({ note: event.target.value })} />
            </div>
          </div>
        }
      >
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold text-muted-foreground">{decodeEntities(working.pricing?.name || working.serviceTitle)}</div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <span className="text-4xl font-black text-foreground">{moneyLabel(working.pricing?.amount)}</span>
            {working.pricing?.interval && <span className="pb-1 text-muted-foreground">/ {working.pricing.interval}</span>}
            {working.pricing?.originalAmount && <span className="pb-1 text-sm text-muted-foreground line-through">{moneyLabel(working.pricing.originalAmount)}</span>}
          </div>
          {working.pricing?.note && <p className="mt-4 text-sm leading-6 text-muted-foreground">{decodeEntities(working.pricing.note)}</p>}
        </div>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="timeline"
        index={9}
        title="Timeline"
        isEditing={editingSectionId === "timeline"}
        isSaving={isSaving}
        onEdit={() => beginEdit("timeline")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={
          <div className="space-y-3">
            <Button type="button" variant="outline" size="sm" onClick={() => patchDraft({ timeline: [...(draft.timeline || []), { label: "", title: "", description: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            {(draft.timeline || []).map((item, index) => (
              <div key={`timeline-edit-${index}`} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input value={item.label || ""} onChange={(event) => patchDraft({ timeline: (draft.timeline || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) })} placeholder="Week 1" />
                  <Input value={item.title || ""} onChange={(event) => patchDraft({ timeline: (draft.timeline || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) })} placeholder="Title" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => patchDraft({ timeline: (draft.timeline || []).filter((_, entryIndex) => entryIndex !== index) })}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <Textarea rows={2} value={item.description || ""} onChange={(event) => patchDraft({ timeline: (draft.timeline || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry) })} placeholder="Description" />
              </div>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(working.timeline || []).map((step, index) => (
            <div key={`${step.label}-${index}`} className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-black text-brand-500">{decodeEntities(step.label)}</div>
              <h3 className="mt-2 font-semibold text-foreground">{decodeEntities(step.title)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{decodeEntities(step.description)}</p>
            </div>
          ))}
        </div>
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="terms"
        index={10}
        title="Terms"
        isEditing={editingSectionId === "terms"}
        isSaving={isSaving}
        onEdit={() => beginEdit("terms")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={<StringListEditor title="Terms" items={draft.terms || []} onChange={(items) => patchDraft({ terms: items })} />}
      >
        <ReadableList items={working.terms || []} />
      </ProposalDocumentSection>

      <ProposalDocumentSection
        id="next"
        index={11}
        title="Next steps"
        isEditing={editingSectionId === "next"}
        isSaving={isSaving}
        onEdit={() => beginEdit("next")}
        onSave={saveDraft}
        onCancel={cancelEdit}
        editor={<StringListEditor title="Next steps" items={draft.nextSteps || []} onChange={(items) => patchDraft({ nextSteps: items })} />}
      >
        <ReadableList items={working.nextSteps || []} />
      </ProposalDocumentSection>

      {customSections.map((section, index) => {
        const id = `custom-${index}`;
        return (
          <ProposalDocumentSection
            key={id}
            id={id}
            index={12 + index}
            title={section.title || `Custom section ${index + 1}`}
            isEditing={editingSectionId === id}
            isSaving={isSaving}
            onEdit={() => beginEdit(id)}
            onSave={saveDraft}
            onCancel={cancelEdit}
            editor={
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={draft.customSections?.[index]?.title || ""}
                    onChange={(event) => patchDraft({ customSections: (draft.customSections || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) })}
                    placeholder="Section title"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const nextProposal = {
                        ...draft,
                        customSections: (draft.customSections || []).filter((_, entryIndex) => entryIndex !== index),
                      };
                      setDraft(nextProposal);
                      const saved = await onSaveProposal(nextProposal);
                      if (saved) setEditingSectionId(null);
                    }}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <Textarea
                  rows={5}
                  value={draft.customSections?.[index]?.body || ""}
                  onChange={(event) => patchDraft({ customSections: (draft.customSections || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, body: event.target.value } : entry) })}
                  placeholder="Client-specific body copy"
                />
                <Textarea
                  rows={4}
                  value={(draft.customSections?.[index]?.bullets || []).join("\n")}
                  onChange={(event) => patchDraft({ customSections: (draft.customSections || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, bullets: normalizeLines(event.target.value) } : entry) })}
                  placeholder="One bullet per line"
                />
              </div>
            }
          >
            <div className="space-y-4">
              {section.body && <p className="whitespace-pre-line break-words text-base leading-8 text-foreground">{decodeEntities(section.body)}</p>}
              <ReadableList items={section.bullets || []} />
            </div>
          </ProposalDocumentSection>
        );
      })}

      <footer className="border-t pt-6 text-center text-xs text-muted-foreground">
        Generated by FlowSmartly for {working.preparedFor || businessName}
      </footer>
    </div>
  );
}
