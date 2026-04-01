"use client";

import { Save, Wand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailBuilder } from "../builder/email-builder";
import { OptimizationPanel, type OptimizationData } from "../builder/optimization-panel";
import type { EmailSection, EmailBrand } from "@/lib/marketing/email-renderer";

interface EditorStepProps {
  sections: EmailSection[];
  subject: string;
  preheader: string;
  brand: EmailBrand | null;
  showLogo: boolean;
  showBrandName: boolean;
  logoSize: "normal" | "large" | "big";
  campaignName: string;
  isGenerating: boolean;
  optimizationData: OptimizationData | null;
  onSubjectChange: (v: string) => void;
  onPreheaderChange: (v: string) => void;
  onCampaignNameChange: (v: string) => void;
  onAddSection: (section: EmailSection) => void;
  onUpdateSection: (id: string, updates: Partial<EmailSection>) => void;
  onDeleteSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onReorderSections: (activeId: string, overId: string) => void;
  onToggleLogo: (v: boolean) => void;
  onToggleBrandName: (v: boolean) => void;
  onLogoSize: (v: "normal" | "large" | "big") => void;
  onOptimize: () => Promise<void>;
  onClearOptimization: () => void;
  onSaveAsTemplate: () => Promise<void>;
}

export function EditorStep(props: EditorStepProps) {
  return (
    <div className="space-y-4">
      {/* Campaign name + actions bar */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Campaign Name *</Label>
          <Input
            value={props.campaignName}
            onChange={(e) => props.onCampaignNameChange(e.target.value)}
            placeholder="e.g., Spring Sale 2026"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={props.onOptimize}
          disabled={props.isGenerating || props.sections.length === 0}
        >
          <Wand className="w-3.5 h-3.5 mr-1" />
          {props.isGenerating ? "Optimizing..." : "Optimize"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={props.onSaveAsTemplate}
          disabled={props.sections.length === 0}
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Save as Template
        </Button>
      </div>

      {/* Optimization panel (shown inline after clicking Optimize) */}
      {props.optimizationData && (
        <OptimizationPanel
          data={props.optimizationData}
          currentSubject={props.subject}
          onApplySubject={props.onSubjectChange}
          onClose={props.onClearOptimization}
        />
      )}

      {/* Email builder */}
      <EmailBuilder
        sections={props.sections}
        subject={props.subject}
        preheader={props.preheader}
        brand={props.brand}
        showLogo={props.showLogo}
        showBrandName={props.showBrandName}
        logoSize={props.logoSize}
        onSubjectChange={props.onSubjectChange}
        onPreheaderChange={props.onPreheaderChange}
        onAddSection={props.onAddSection}
        onUpdateSection={props.onUpdateSection}
        onDeleteSection={props.onDeleteSection}
        onDuplicateSection={props.onDuplicateSection}
        onReorderSections={props.onReorderSections}
        onToggleLogo={props.onToggleLogo}
        onToggleBrandName={props.onToggleBrandName}
        onLogoSize={props.onLogoSize}
      />
    </div>
  );
}
