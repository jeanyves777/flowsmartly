// ---------------------------------------------------------------------------
// Marketing Template Types
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | "lifecycle"
  | "birthday"
  | "holiday"
  | "promotional"
  | "content"
  | "transactional";

export interface DefaultEmailContent {
  subject: string;
  preheader: string;
  content: string;
  htmlContent: string;
}

export interface MarketingTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  channels: ("email" | "sms")[];
  automatable: boolean;
  triggerEvent?: string;
  defaultEmail?: DefaultEmailContent;
  defaultSms?: string;
  aiPromptHint: string;
  suggestedMergeTags: string[];
}

export const TEMPLATE_CATEGORIES: Record<
  TemplateCategory,
  { label: string; icon: string; description: string }
> = {
  lifecycle: {
    label: "Lifecycle",
    icon: "\u{1F504}",
    description: "Automated emails triggered by customer journey events",
  },
  birthday: {
    label: "Birthday & Milestones",
    icon: "\u{1F382}",
    description: "Celebrate personal milestones with your contacts",
  },
  holiday: {
    label: "Holiday & Calendar",
    icon: "\u{1F384}",
    description: "Seasonal and holiday-themed campaigns",
  },
  promotional: {
    label: "Promotional & Sales",
    icon: "\u{1F4B0}",
    description: "Drive sales with offers, discounts, and promotions",
  },
  content: {
    label: "Content & Value",
    icon: "\u{1F4DA}",
    description: "Share valuable content, news, and insights",
  },
  transactional: {
    label: "Transactional",
    icon: "\u{1F4E8}",
    description: "System-triggered emails for orders, auth, and support",
  },
};
