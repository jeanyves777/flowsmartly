"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailPreview } from "../preview/email-preview";
import { renderEmailHtml } from "@/lib/marketing/email-renderer";
import type { TemplateItem } from "./template-gallery";
import type { EmailSection } from "@/lib/marketing/email-renderer";

interface TemplatePreviewModalProps {
  template: TemplateItem;
  onClose: () => void;
  onUse: () => void;
}

export function TemplatePreviewModal({ template, onClose, onUse }: TemplatePreviewModalProps) {
  let sections: EmailSection[] = [];
  try {
    sections = JSON.parse(template.sections);
  } catch { /* empty */ }

  const html = sections.length > 0 ? renderEmailHtml(sections) : "";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-sm font-semibold">{template.name}</h3>
            {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onUse}>Use This Template</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4">
          <EmailPreview html={html} subject={template.subject || undefined} preheader={template.preheader || undefined} />
        </div>
      </div>
    </div>
  );
}
