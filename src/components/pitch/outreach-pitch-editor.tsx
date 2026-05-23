"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StringListEditor } from "./string-list-editor";
import type { OutreachPitchContent } from "@/lib/pitch/pitch-detail-types";

export function OutreachPitchEditor({
  content,
  onChange,
}: {
  content: OutreachPitchContent;
  onChange: (content: OutreachPitchContent) => void;
}) {
  const setContent = (patch: Partial<OutreachPitchContent>) => onChange({ ...content, ...patch });
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Editable final pitch</h2>
        <p className="mt-1 text-sm text-muted-foreground">Adjust the pitch before sending or downloading the PDF.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input value={content.subject || ""} onChange={(event) => setContent({ subject: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>CTA</Label>
          <Input value={content.ctaText || ""} onChange={(event) => setContent({ ctaText: event.target.value })} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Headline</Label>
          <Input value={content.headline || ""} onChange={(event) => setContent({ headline: event.target.value })} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Personalized hook</Label>
          <Textarea rows={3} value={content.personalizedHook || ""} onChange={(event) => setContent({ personalizedHook: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Opportunity paragraph</Label>
          <Textarea rows={4} value={content.opportunityParagraph || ""} onChange={(event) => setContent({ opportunityParagraph: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Impact paragraph</Label>
          <Textarea rows={4} value={content.impactParagraph || ""} onChange={(event) => setContent({ impactParagraph: event.target.value })} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Closing line</Label>
          <Input value={content.closingLine || ""} onChange={(event) => setContent({ closingLine: event.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StringListEditor title="Key findings" items={content.keyFindings || []} onChange={(items) => setContent({ keyFindings: items })} />
        <StringListEditor title="Solution bullets" items={content.solutionBullets || []} onChange={(items) => setContent({ solutionBullets: items })} />
      </div>
    </div>
  );
}
