"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionToolbar } from "./section-toolbar";
import { SectionCanvas } from "./section-canvas";
import { BrandPanel } from "./brand-panel";
import { MergeTagPicker } from "./merge-tag-picker";
import { EmailPreview } from "../preview/email-preview";
import { renderEmailHtml } from "@/lib/marketing/email-renderer";
import type { EmailSection, EmailBrand, RenderOptions } from "@/lib/marketing/email-renderer";

interface EmailBuilderProps {
  sections: EmailSection[];
  subject: string;
  preheader: string;
  brand: EmailBrand | null;
  showLogo: boolean;
  showBrandName: boolean;
  logoSize: "normal" | "large" | "big";
  onSubjectChange: (v: string) => void;
  onPreheaderChange: (v: string) => void;
  onAddSection: (section: EmailSection) => void;
  onUpdateSection: (id: string, updates: Partial<EmailSection>) => void;
  onDeleteSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onReorderSections: (activeId: string, overId: string) => void;
  onToggleLogo: (v: boolean) => void;
  onToggleBrandName: (v: boolean) => void;
  onLogoSize: (v: "normal" | "large" | "big") => void;
}

export function EmailBuilder({
  sections, subject, preheader, brand,
  showLogo, showBrandName, logoSize,
  onSubjectChange, onPreheaderChange,
  onAddSection, onUpdateSection, onDeleteSection, onDuplicateSection, onReorderSections,
  onToggleLogo, onToggleBrandName, onLogoSize,
}: EmailBuilderProps) {
  // Render live preview HTML
  const previewHtml = useMemo(() => {
    if (sections.length === 0) return "";
    const renderOpts: RenderOptions = { showLogo, showBrandName, logoSize };
    return renderEmailHtml(sections, brand || undefined, renderOpts);
  }, [sections, brand, showLogo, showBrandName, logoSize]);

  return (
    <div className="grid lg:grid-cols-2 gap-6 h-full">
      {/* Left: Editor */}
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-2">
        {/* Subject + Preheader */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Subject Line *</Label>
              <MergeTagPicker onInsert={(tag) => onSubjectChange(subject + tag)} />
            </div>
            <Input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Enter email subject..."
            />
            <p className="text-[10px] text-muted-foreground">{subject.length}/60 characters</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Preheader Text</Label>
            <Input
              value={preheader}
              onChange={(e) => onPreheaderChange(e.target.value)}
              placeholder="Preview text shown in inbox..."
            />
            <p className="text-[10px] text-muted-foreground">{preheader.length}/100 characters</p>
          </div>
        </div>

        {/* Brand panel */}
        <BrandPanel
          brand={brand}
          showLogo={showLogo}
          showBrandName={showBrandName}
          logoSize={logoSize}
          onToggleLogo={onToggleLogo}
          onToggleBrandName={onToggleBrandName}
          onLogoSize={onLogoSize}
        />

        {/* Section toolbar */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Add Content Block</Label>
          <SectionToolbar onAdd={onAddSection} />
        </div>

        {/* Section canvas (drag-and-drop) */}
        <SectionCanvas
          sections={sections}
          onReorder={onReorderSections}
          onUpdate={onUpdateSection}
          onDelete={onDeleteSection}
          onDuplicate={onDuplicateSection}
        />
      </div>

      {/* Right: Live Preview */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold">Live Preview</Label>
        <EmailPreview html={previewHtml} subject={subject} preheader={preheader} />
      </div>
    </div>
  );
}
