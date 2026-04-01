"use client";

import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateGallery, type TemplateItem } from "../template-gallery/template-gallery";
import { createBlankSections } from "@/lib/marketing/email-renderer";
import type { EmailSection } from "@/lib/marketing/email-renderer";

interface TemplateStepProps {
  isGenerating: boolean;
  creditCost: number | null;
  onSelectTemplate: (templateId: string, name: string, sections: EmailSection[], subject?: string, preheader?: string) => void;
  onCreateBlank: (sections: EmailSection[]) => void;
  onGenerateAI: (prompt: string, mode: "content" | "template") => Promise<void>;
}

export function TemplateStep({ isGenerating, creditCost, onSelectTemplate, onCreateBlank, onGenerateAI }: TemplateStepProps) {
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  function handleSelectTemplate(tpl: TemplateItem) {
    let sections: EmailSection[] = [];
    try { sections = JSON.parse(tpl.sections); } catch { /* empty */ }
    onSelectTemplate(tpl.id, tpl.name, sections, tpl.subject || undefined, tpl.preheader || undefined);
  }

  if (showAI) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => setShowAI(false)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Templates
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Generate Email with AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Describe your email</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., A promotional email for our spring sale with 25% off all products, targeting returning customers..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about: purpose, audience, key message, any offers or CTAs
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onGenerateAI(aiPrompt, "content")}
                disabled={isGenerating || !aiPrompt.trim()}
                className="bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
              >
                {isGenerating ? "Generating..." : (
                  <><Sparkles className="w-4 h-4 mr-1" /> Generate Content</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => onGenerateAI(aiPrompt, "template")}
                disabled={isGenerating || !aiPrompt.trim()}
              >
                {isGenerating ? "Designing..." : (
                  <><Sparkles className="w-4 h-4 mr-1" /> Design Template</>
                )}
              </Button>
            </div>

            {creditCost && (
              <p className="text-xs text-center text-muted-foreground">
                Uses {creditCost} credits per generation
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <TemplateGallery
        onSelect={handleSelectTemplate}
        onCreateBlank={() => onCreateBlank(createBlankSections())}
        onGenerateAI={() => setShowAI(true)}
      />
    </div>
  );
}
