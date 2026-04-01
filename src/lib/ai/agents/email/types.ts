import type { EmailSection } from "@/lib/marketing/email-renderer";
import type { BrandContext, ToneType } from "@/lib/ai/types";

export interface EmailAgentInput {
  prompt: string;
  category?: string;
  tone?: ToneType;
  brandContext?: BrandContext | null;
}

export interface EmailContentResult {
  sections: EmailSection[];
  subject: string;
  preheader: string;
}

export interface EmailTemplateResult extends EmailContentResult {
  name: string;
  description: string;
  category: string;
}

export interface EmailOptimizationResult {
  subjectVariants: string[];
  suggestedSendTime?: string;
  contentSuggestions: string[];
}
