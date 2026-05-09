"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bug, CheckCircle2, Image as ImageIcon, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

type FeedbackReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PRESETS = [
  { id: "GENERAL", label: "General feedback", helper: "Something I want the team to know" },
  { id: "BUG", label: "Bug or error", helper: "A feature is not working correctly" },
  { id: "DISPLAY", label: "Display issue", helper: "Layout, mobile, image, or visual problem" },
  { id: "POSTING", label: "Posting issue", helper: "Publishing, scheduling, or social account problem" },
  { id: "ACCOUNT", label: "Account connection", helper: "Login, onboarding, profile, or integration issue" },
  { id: "BILLING", label: "Credits or billing", helper: "Credits, plan, unlocks, or payment problem" },
];

function getErrorMessage(data: any, fallback: string) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

export function FeedbackReportModal({ open, onOpenChange }: FeedbackReportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("GENERAL");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");

  const selectedPreset = useMemo(
    () => PRESETS.find((preset) => preset.id === category) || PRESETS[0],
    [category]
  );

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  useEffect(() => {
    if (!open) setSubmittedCode("");
  }, [open]);

  const resetForm = () => {
    setCategory("GENERAL");
    setMessage("");
    setScreenshot(null);
    setSubmittedCode("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Screenshot must be an image", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Screenshot is too large", description: "Please upload an image under 10MB.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    setScreenshot(file);
  };

  const handleSubmit = async () => {
    const cleanMessage = message.trim();
    if (cleanMessage.length < 6) {
      toast({
        title: "Add a short description",
        description: "Tell us what happened or what you expected to happen.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("message", cleanMessage);
      if (typeof window !== "undefined") {
        formData.append("pageUrl", window.location.href);
        formData.append("userAgent", window.navigator.userAgent);
        formData.append("viewport", `${window.innerWidth}x${window.innerHeight}`);
      }
      if (screenshot) formData.append("screenshot", screenshot);

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "Could not submit the report"));
      }

      const referenceCode = data.data?.report?.referenceCode || "";
      setSubmittedCode(referenceCode);
      toast({
        title: "Report submitted",
        description: referenceCode ? `Reference ${referenceCode}` : "Thank you. We saved the report.",
      });
      resetForm();
      setSubmittedCode(referenceCode);
    } catch (error) {
      toast({
        title: "Report failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FloatingPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Report Issue"
      description="Send a bug, error, or product feedback report to the FlowSmartly team."
      icon={<Bug className="h-4 w-4" />}
      defaultSize={{ width: 620, height: 760 }}
      defaultPosition={{ y: 88 }}
      minSize={{ width: 360, height: 520 }}
      contentClassName="p-5"
    >
      <div className="space-y-5">
        {submittedCode ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-semibold">Saved as {submittedCode}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin can now track this report from the feedback queue.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-semibold">What kind of issue is this?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((preset) => {
              const isActive = preset.id === category;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setCategory(preset.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    isActive
                      ? "border-sky-500 bg-sky-500/10"
                      : "bg-background hover:border-sky-500/40 hover:bg-muted/30"
                  }`}
                >
                  <span className="block text-sm font-semibold">{preset.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{preset.helper}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold">Details</label>
            <span className="text-xs text-muted-foreground">{selectedPreset.label}</span>
          </div>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            maxLength={4000}
            placeholder="Describe what happened, what page you were on, and what you expected instead..."
            disabled={isSubmitting}
          />
          <p className="text-right text-[10px] text-muted-foreground">{message.length}/4000</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Screenshot</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border bg-muted/20">
              <img src={previewUrl} alt="Issue screenshot preview" className="max-h-72 w-full object-contain" />
              <button
                type="button"
                onClick={() => {
                  setScreenshot(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove screenshot</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center transition hover:border-sky-500/50 hover:bg-sky-500/5"
            >
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold">Upload screenshot</span>
              <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, or WebP up to 10MB</span>
            </button>
          )}
        </div>

        <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          We automatically attach the current page URL, browser, and viewport so the report is easier to reproduce.
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || message.trim().length < 6} className="gap-2">
            {isSubmitting ? <AISpinner className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit report
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}
