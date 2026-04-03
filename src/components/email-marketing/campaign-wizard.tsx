"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { useCampaignForm } from "@/hooks/use-campaign-form";
import { TemplateStep } from "./steps/template-step";
import { EditorStep } from "./steps/editor-step";
import { SendStep } from "./steps/send-step";
import { renderEmailHtml, sectionsToPlainText } from "@/lib/marketing/email-renderer";
import type { EmailSection, EmailBrand } from "@/lib/marketing/email-renderer";
import type { OptimizationData } from "./builder/optimization-panel";

const STEPS = [
  { id: "template" as const, label: "Choose Template" },
  { id: "editor" as const, label: "Design Email" },
  { id: "send" as const, label: "Audience & Send" },
];

interface CampaignWizardProps {
  editCampaignId?: string | null;
}

export function CampaignWizard({ editCampaignId }: CampaignWizardProps) {
  const { state, dispatch, canProceedToEditor, canProceedToSend, canSend, goToStep } = useCampaignForm(
    editCampaignId ? { editCampaignId } : undefined
  );
  const { toast } = useToast();
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [optimizationData, setOptimizationData] = useState<OptimizationData | null>(null);

  // Fetch brand kit
  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const bk = d.data;
          let colors;
          try { colors = typeof bk.colors === "string" ? JSON.parse(bk.colors) : bk.colors; } catch { colors = undefined; }
          let fonts;
          try { fonts = typeof bk.fonts === "string" ? JSON.parse(bk.fonts) : bk.fonts; } catch { fonts = undefined; }
          let socials;
          try { socials = typeof bk.handles === "string" ? JSON.parse(bk.handles) : bk.handles; } catch { socials = undefined; }
          const brand: EmailBrand = {
            name: bk.name,
            logo: bk.logo || undefined,
            iconLogo: bk.iconLogo || undefined,
            colors: colors?.primary ? colors : { primary: "#6366f1", secondary: "#f3f4f6", accent: "#f59e0b" },
            fonts: fonts?.heading ? fonts : { heading: "Georgia, serif", body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
            website: bk.website || undefined,
            email: bk.email || undefined,
            phone: bk.phone || undefined,
            address: bk.address || undefined,
            socials,
          };
          dispatch({ type: "SET_BRAND_KIT", brandKit: brand });
        }
      })
      .catch(() => {});
  }, [dispatch]);

  // Fetch credit costs
  useEffect(() => {
    fetch("/api/credits/costs")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCreditCost(d.data?.AI_POST || null); })
      .catch(() => {});
  }, []);

  // Load existing campaign for edit mode
  useEffect(() => {
    if (!editCampaignId) return;
    fetch(`/api/campaigns/${editCampaignId}`)
      .then((r) => r.json())
      .then(async (d) => {
        if (d.success && d.data) {
          const c = d.data.campaign || d.data;

          // Load sections from linked template
          let sections: EmailSection[] = [];
          const templateId = c.templateId || null;
          if (templateId) {
            try {
              const tplRes = await fetch(`/api/email-templates/${templateId}`);
              const tplData = await tplRes.json();
              if (tplData.success && tplData.data?.sections) {
                sections = typeof tplData.data.sections === "string"
                  ? JSON.parse(tplData.data.sections)
                  : tplData.data.sections;
              }
            } catch { /* template may have been deleted */ }
          }

          // Parse custom recipients
          let customEmails: string[] = [];
          try { customEmails = c.customRecipients ? JSON.parse(c.customRecipients) : []; } catch { /* */ }
          let excludedContactIds: string[] = [];
          try { excludedContactIds = c.excludedRecipients ? JSON.parse(c.excludedRecipients) : []; } catch { /* */ }

          // If no sections from template but campaign has HTML, create a text section from content
          if (sections.length === 0 && c.content) {
            const { generateSectionId } = await import("@/lib/marketing/email-renderer");
            // Split plain text content into heading + text sections
            const lines = (c.content as string).split("\n\n").filter(Boolean);
            if (lines.length > 0) {
              sections.push({ id: generateSectionId(), type: "heading", content: lines[0], level: "h1" });
              for (let i = 1; i < lines.length; i++) {
                sections.push({ id: generateSectionId(), type: "text", content: lines[i] });
              }
            }
          }

          dispatch({
            type: "LOAD_CAMPAIGN",
            state: {
              editCampaignId: c.id,
              campaignName: c.name,
              subject: c.subject || "",
              preheader: c.preheaderText || "",
              selectedContactListId: c.contactListId || "",
              selectedTemplateId: templateId,
              sections,
              customEmails,
              excludedContactIds,
              step: "editor",  // Always go to editor for drafts
            },
          });
        }
      })
      .catch(() => {});
  }, [editCampaignId, dispatch]);

  // AI generation handler
  const handleGenerateAI = useCallback(async (prompt: string, mode: "content" | "template") => {
    dispatch({ type: "SET_GENERATING", value: true });
    try {
      const res = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Generation failed");

      dispatch({
        type: "LOAD_TEMPLATE",
        templateId: data.data.template.id,
        templateName: data.data.template.name,
        sections: data.data.sections,
        subject: data.data.subject,
        preheader: data.data.preheader,
      });
      toast({ title: "Email generated!", description: `Used ${data.data.creditsUsed} credits` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
    } finally {
      dispatch({ type: "SET_GENERATING", value: false });
    }
  }, [dispatch, toast]);

  // Optimize handler — shows results in an inline panel, not a toast
  const handleOptimize = useCallback(async () => {
    dispatch({ type: "SET_GENERATING", value: true });
    try {
      const res = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "optimize", subject: state.subject, sections: state.sections }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOptimizationData(data.data);
      } else {
        toast({ title: "Optimization failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Optimization failed", variant: "destructive" });
    } finally {
      dispatch({ type: "SET_GENERATING", value: false });
    }
  }, [dispatch, state.subject, state.sections, toast]);

  // Save as template
  const handleSaveAsTemplate = useCallback(async () => {
    try {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.campaignName || state.subject || "My Template",
          category: "custom",
          subject: state.subject,
          preheader: state.preheader,
          sections: state.sections,
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.success) toast({ title: "Template saved!" });
      else throw new Error(data.error);
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    }
  }, [state, toast]);

  // Save draft — also saves/updates a linked template to preserve sections
  const handleSaveDraft = useCallback(async () => {
    dispatch({ type: "SET_SAVING", value: true });
    try {
      const contentHtml = renderEmailHtml(state.sections, state.brandKit || undefined, {
        showLogo: state.showLogo,
        showBrandName: state.showBrandName,
        logoSize: state.logoSize,
      });

      // Save or update the linked template to preserve sections for re-editing
      let templateId = state.selectedTemplateId || null;
      if (state.sections.length > 0) {
        if (templateId) {
          // Update existing template sections
          await fetch(`/api/email-templates/${templateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections: state.sections, subject: state.subject, preheader: state.preheader }),
          });
        } else {
          // Create a new template to hold the sections
          const tplRes = await fetch("/api/email-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `Draft: ${state.campaignName || state.subject || "Untitled"}`,
              category: "custom",
              subject: state.subject,
              preheader: state.preheader,
              sections: state.sections,
              source: "manual",
            }),
          });
          const tplData = await tplRes.json();
          if (tplData.success) templateId = tplData.data.id;
        }
      }

      const body = {
        name: state.campaignName || "Untitled",
        type: "EMAIL",
        subject: state.subject,
        preheaderText: state.preheader,
        content: sectionsToPlainText(state.sections),
        contentHtml,
        contactListId: state.selectedContactListId || null,
        templateId,
        customRecipients: state.customEmails.length > 0 ? JSON.stringify(state.customEmails) : null,
        excludedRecipients: state.excludedContactIds.length > 0 ? JSON.stringify(state.excludedContactIds) : null,
        status: "DRAFT",
        // Images are embedded in sections/contentHtml — clear legacy inject fields to prevent duplication
        imageUrl: null,
        imageSource: null,
        imageOverlayText: null,
      };

      const method = state.editCampaignId ? "PATCH" : "POST";
      const url = state.editCampaignId ? `/api/campaigns/${state.editCampaignId}` : "/api/campaigns";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Save failed");

      if (!state.editCampaignId) dispatch({ type: "LOAD_CAMPAIGN", state: { editCampaignId: data.data?.campaign?.id || data.data?.id } });
      if (templateId && !state.selectedTemplateId) dispatch({ type: "LOAD_CAMPAIGN", state: { selectedTemplateId: templateId } });
      toast({ title: "Draft saved!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  }, [state, dispatch, toast]);

  // Send campaign
  const handleSend = useCallback(async () => {
    // Auto-fill campaign name from subject if empty
    if (!state.campaignName.trim() && state.subject.trim()) {
      dispatch({ type: "SET_CAMPAIGN_NAME", value: state.subject });
    }
    dispatch({ type: "SET_SENDING", value: true });
    try {
      const contentHtml = renderEmailHtml(state.sections, state.brandKit || undefined, {
        showLogo: state.showLogo,
        showBrandName: state.showBrandName,
        logoSize: state.logoSize,
      });
      const campaignName = state.campaignName.trim() || state.subject.trim() || "Untitled";
      const campaignBody = {
        name: campaignName,
        type: "EMAIL",
        subject: state.subject,
        preheaderText: state.preheader,
        content: sectionsToPlainText(state.sections),
        contentHtml,
        contactListId: state.selectedContactListId || null,
        templateId: state.selectedTemplateId || null,
        customRecipients: state.customEmails.length > 0 ? JSON.stringify(state.customEmails) : null,
        excludedRecipients: state.excludedContactIds.length > 0 ? JSON.stringify(state.excludedContactIds) : null,
        status: "DRAFT",
        // Images are embedded in sections/contentHtml — clear legacy inject fields to prevent duplication
        imageUrl: null,
        imageSource: null,
        imageOverlayText: null,
      };

      let campaignId = state.editCampaignId;
      if (campaignId) {
        await fetch(`/api/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaignBody) });
      } else {
        const createRes = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaignBody) });
        const createData = await createRes.json();
        if (!createData.success) throw new Error(createData.error?.message || "Create failed");
        campaignId = createData.data?.campaign?.id || createData.data?.id;
      }

      if (!campaignId) throw new Error("Failed to create campaign");

      // Send
      const sendRes = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: state.scheduleType === "later" ? "schedule" : "send",
          scheduledAt: state.scheduleType === "later" && state.scheduledDate ? new Date(`${state.scheduledDate}T${state.scheduledTime || "09:00"}`).toISOString() : undefined,
          customEmails: state.customEmails,
          excludedContactIds: state.excludedContactIds,
        }),
      });
      const sendData = await sendRes.json();
      if (!sendData.success) throw new Error(sendData.error?.message || "Send failed");

      toast({ title: state.scheduleType === "later" ? "Campaign scheduled!" : "Campaign sent!", description: `${sendData.data?.sentCount || 0} emails sent` });
      window.location.href = "/email-marketing";
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Send failed", variant: "destructive" });
    } finally {
      dispatch({ type: "SET_SENDING", value: false });
    }
  }, [state, dispatch, toast]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === state.step);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (i === 0) goToStep("template");
                if (i === 1 && canProceedToEditor) goToStep("editor");
                if (i === 2 && canProceedToSend) goToStep("send");
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                state.step === step.id
                  ? "bg-brand-500 text-white"
                  : i < currentStepIndex
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {i < currentStepIndex ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
              {step.label}
            </button>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {state.step === "template" && (
        <TemplateStep
          isGenerating={state.isGenerating}
          creditCost={creditCost}
          onSelectTemplate={(id, name, sections, subject, preheader) => {
            dispatch({ type: "LOAD_TEMPLATE", templateId: id, templateName: name, sections, subject, preheader });
          }}
          onCreateBlank={(sections) => {
            dispatch({ type: "LOAD_TEMPLATE", templateId: "", templateName: "Blank Email", sections });
          }}
          onGenerateAI={handleGenerateAI}
        />
      )}

      {state.step === "editor" && (
        <EditorStep
          sections={state.sections}
          subject={state.subject}
          preheader={state.preheader}
          brand={state.brandKit}
          showLogo={state.showLogo}
          showBrandName={state.showBrandName}
          logoSize={state.logoSize}
          campaignName={state.campaignName}
          isGenerating={state.isGenerating}
          optimizationData={optimizationData}
          onSubjectChange={(v) => dispatch({ type: "SET_SUBJECT", value: v })}
          onPreheaderChange={(v) => dispatch({ type: "SET_PREHEADER", value: v })}
          onCampaignNameChange={(v) => dispatch({ type: "SET_CAMPAIGN_NAME", value: v })}
          onAddSection={(s) => dispatch({ type: "ADD_SECTION", section: s })}
          onUpdateSection={(id, u) => dispatch({ type: "UPDATE_SECTION", id, updates: u })}
          onDeleteSection={(id) => dispatch({ type: "DELETE_SECTION", id })}
          onDuplicateSection={(id) => dispatch({ type: "DUPLICATE_SECTION", id })}
          onReorderSections={(a, o) => dispatch({ type: "REORDER_SECTIONS", activeId: a, overId: o })}
          onToggleLogo={(v) => dispatch({ type: "SET_BRAND_OPTIONS", showLogo: v })}
          onToggleBrandName={(v) => dispatch({ type: "SET_BRAND_OPTIONS", showBrandName: v })}
          onLogoSize={(v) => dispatch({ type: "SET_BRAND_OPTIONS", logoSize: v })}
          onOptimize={handleOptimize}
          onClearOptimization={() => setOptimizationData(null)}
          onSaveAsTemplate={handleSaveAsTemplate}
        />
      )}

      {state.step === "send" && (
        <SendStep
          campaignName={state.campaignName}
          subject={state.subject}
          selectedContactListId={state.selectedContactListId}
          customEmails={state.customEmails}
          excludedContactIds={state.excludedContactIds}
          scheduleType={state.scheduleType}
          scheduledDate={state.scheduledDate}
          scheduledTime={state.scheduledTime}
          isSending={state.isSending}
          onSelectContactList={(id) => dispatch({ type: "SET_CONTACT_LIST", id })}
          onAddCustomEmail={(e) => dispatch({ type: "ADD_CUSTOM_EMAIL", email: e })}
          onRemoveCustomEmail={(e) => dispatch({ type: "REMOVE_CUSTOM_EMAIL", email: e })}
          onSetCustomEmails={(emails) => dispatch({ type: "SET_CUSTOM_EMAILS", emails })}
          onToggleExcludeContact={(id) => dispatch({ type: "TOGGLE_EXCLUDE_CONTACT", contactId: id })}
          onSetSchedule={(type, date, time) => dispatch({ type: "SET_SCHEDULE", scheduleType: type, date, time })}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="ghost"
          onClick={() => {
            if (state.step === "editor") goToStep("template");
            if (state.step === "send") goToStep("editor");
          }}
          disabled={state.step === "template"}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {state.step !== "send" && (
          <Button
            onClick={() => {
              if (state.step === "template" && canProceedToEditor) goToStep("editor");
              if (state.step === "editor" && canProceedToSend) goToStep("send");
            }}
            disabled={
              (state.step === "template" && !canProceedToEditor) ||
              (state.step === "editor" && !canProceedToSend)
            }
          >
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
