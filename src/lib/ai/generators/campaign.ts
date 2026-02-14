/**
 * Campaign Content Generator
 * AI-powered email and SMS content generation based on brand identity
 * Supports both legacy template types and the full 61-template library
 */

import { ai } from "../client";
import { buildBrandContext } from "../prompts";
import type { BrandContext, ToneType } from "../types";

// ---------------------------------------------------------------------------
// Template library integration (lazy-loaded to avoid circular deps)
// ---------------------------------------------------------------------------

let _templateCache: Map<string, { name: string; description: string; aiPromptHint: string }> | null = null;

async function getTemplateInfo(templateId: string) {
  if (!_templateCache) {
    // Dynamic import to avoid circular dependencies
    const { getAllTemplates } = await import("@/lib/marketing/templates");
    _templateCache = new Map();
    for (const t of getAllTemplates()) {
      _templateCache.set(t.id, { name: t.name, description: t.description, aiPromptHint: t.aiPromptHint });
    }
  }
  return _templateCache.get(templateId);
}

// ---------------------------------------------------------------------------
// Legacy template types (kept for backward compatibility)
// ---------------------------------------------------------------------------

export type EmailTemplateType =
  | "welcome"
  | "newsletter"
  | "promotional"
  | "announcement"
  | "abandoned-cart"
  | "re-engagement"
  | "thank-you"
  | "feedback"
  | "event-invite"
  | "product-launch";

export type SMSTemplateType =
  | "promotional"
  | "reminder"
  | "confirmation"
  | "flash-sale"
  | "appointment"
  | "shipping-update"
  | "welcome"
  | "feedback"
  | "loyalty"
  | "alert";

// Legacy template maps (used as fallback when template library ID not found)
const LEGACY_EMAIL_TEMPLATES: Record<string, { name: string; description: string; icon: string }> = {
  welcome: { name: "Welcome Email", description: "Greet new subscribers and set expectations", icon: "\u{1F44B}" },
  newsletter: { name: "Newsletter", description: "Share updates, news, and valuable content", icon: "\u{1F4F0}" },
  promotional: { name: "Promotional", description: "Highlight sales, discounts, and offers", icon: "\u{1F381}" },
  announcement: { name: "Announcement", description: "Share important news or updates", icon: "\u{1F4E2}" },
  "abandoned-cart": { name: "Abandoned Cart", description: "Recover lost sales with cart reminders", icon: "\u{1F6D2}" },
  "re-engagement": { name: "Re-engagement", description: "Win back inactive subscribers", icon: "\u{1F4AB}" },
  "thank-you": { name: "Thank You", description: "Show appreciation to customers", icon: "\u{1F64F}" },
  feedback: { name: "Feedback Request", description: "Ask customers for reviews or feedback", icon: "\u2B50" },
  "event-invite": { name: "Event Invitation", description: "Invite subscribers to events or webinars", icon: "\u{1F4C5}" },
  "product-launch": { name: "Product Launch", description: "Announce new products or services", icon: "\u{1F680}" },
};

const LEGACY_SMS_TEMPLATES: Record<string, { name: string; description: string; icon: string }> = {
  promotional: { name: "Promotional", description: "Sales and special offers", icon: "\u{1F381}" },
  reminder: { name: "Reminder", description: "Event or appointment reminders", icon: "\u23F0" },
  confirmation: { name: "Confirmation", description: "Order or booking confirmations", icon: "\u2705" },
  "flash-sale": { name: "Flash Sale", description: "Limited-time urgent offers", icon: "\u26A1" },
  appointment: { name: "Appointment", description: "Schedule reminders and updates", icon: "\u{1F4C5}" },
  "shipping-update": { name: "Shipping Update", description: "Delivery status notifications", icon: "\u{1F4E6}" },
  welcome: { name: "Welcome", description: "Welcome new subscribers", icon: "\u{1F44B}" },
  feedback: { name: "Feedback", description: "Request reviews and feedback", icon: "\u2B50" },
  loyalty: { name: "Loyalty Rewards", description: "Points and rewards notifications", icon: "\u{1F3C6}" },
  alert: { name: "Alert", description: "Important notifications", icon: "\u{1F514}" },
};

// Re-export for backward compatibility
export const EMAIL_TEMPLATES = LEGACY_EMAIL_TEMPLATES;
export const SMS_TEMPLATES = LEGACY_SMS_TEMPLATES;

// ---------------------------------------------------------------------------
// Request/Response types
// ---------------------------------------------------------------------------

export interface EmailGenerationRequest {
  templateType?: string; // template library ID or legacy type (optional — customPrompt can drive generation alone)
  brandContext?: BrandContext;
  tone?: ToneType;
  topic?: string;
  productName?: string;
  discount?: string;
  eventName?: string;
  eventDate?: string;
  customPrompt?: string;
}

export interface SMSGenerationRequest {
  templateType: string; // template library ID or legacy type
  brandContext?: BrandContext;
  tone?: ToneType;
  topic?: string;
  productName?: string;
  discount?: string;
  eventName?: string;
  link?: string;
  customPrompt?: string;
}

export interface EmailGenerationResult {
  subject: string;
  preheader: string;
  content: string;
  htmlContent: string;
}

export interface SMSGenerationResult {
  content: string;
  characterCount: number;
  segmentCount: number;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const EMAIL_SYSTEM_PROMPT = `You are an expert email marketing copywriter.
You create compelling, engaging, and conversion-focused email content.
You understand email best practices, deliverability, and what drives opens and clicks.
You write in a way that avoids spam triggers and connects authentically with readers.
You include merge tags like {{firstName}}, {{company}}, {{couponCode}} where appropriate.
Always return structured JSON as requested.`;

const SMS_SYSTEM_PROMPT = `You are an expert SMS marketing copywriter.
You create concise, impactful SMS messages that drive action.
You understand SMS character limits (160 per segment) and optimize for clarity.
You include clear CTAs and respect the personal nature of text messaging.
You use merge tags like {{firstName}} where appropriate.
Messages must be under 160 characters for single segment, or clearly formatted for multi-segment.`;

// ---------------------------------------------------------------------------
// Resolve template info from library or legacy maps
// ---------------------------------------------------------------------------

async function resolveTemplateInfo(
  templateType: string,
  channel: "email" | "sms"
): Promise<{ name: string; description: string; aiPromptHint?: string }> {
  // First try the template library
  const libraryTemplate = await getTemplateInfo(templateType);
  if (libraryTemplate) {
    return libraryTemplate;
  }

  // Fall back to legacy maps
  const legacy =
    channel === "email"
      ? LEGACY_EMAIL_TEMPLATES[templateType]
      : LEGACY_SMS_TEMPLATES[templateType];

  if (legacy) {
    return { name: legacy.name, description: legacy.description };
  }

  // Unknown template type — use the type itself as the name
  return { name: templateType, description: `Generate ${templateType} content` };
}

// ---------------------------------------------------------------------------
// Generate email content
// ---------------------------------------------------------------------------

export async function generateEmailContent(request: EmailGenerationRequest): Promise<EmailGenerationResult> {
  const { templateType, brandContext, tone = "professional", topic, productName, discount, eventName, eventDate, customPrompt } = request;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  if (templateType) {
    const templateInfo = await resolveTemplateInfo(templateType, "email");
    prompt += `Generate a "${templateInfo.name}" email.

Template Type: ${templateType}
Template Purpose: ${templateInfo.description}
Tone: ${tone}`;

    if (templateInfo.aiPromptHint) {
      prompt += `\n\nSpecific Instructions: ${templateInfo.aiPromptHint}`;
    }
  } else {
    prompt += `Generate a marketing email.
Tone: ${tone}`;
  }

  if (topic) prompt += `\nTopic: ${topic}`;
  if (productName) prompt += `\nProduct/Service: ${productName}`;
  if (discount) prompt += `\nDiscount/Offer: ${discount}`;
  if (eventName) prompt += `\nEvent Name: ${eventName}`;
  if (eventDate) prompt += `\nEvent Date: ${eventDate}`;
  if (customPrompt) prompt += `\n\nAdditional Instructions: ${customPrompt}`;

  prompt += `

Generate a complete email with:
1. Subject line (max 60 characters, compelling, avoid spam triggers)
2. Preheader text (max 100 characters, complements subject)
3. Email body content (plain text version with merge tags like {{firstName}})
4. HTML content (professional HTML email with inline styles)

Return ONLY valid JSON in this exact format:
{
  "subject": "Subject line here",
  "preheader": "Preheader text here",
  "content": "Plain text email content here",
  "htmlContent": "<!DOCTYPE html><html>...</html>"
}`;

  const response = await ai.generate(prompt, {
    maxTokens: 2500,
    temperature: 0.7,
    systemPrompt: EMAIL_SYSTEM_PROMPT,
  });

  return parseEmailResponse(response);
}

// ---------------------------------------------------------------------------
// Generate SMS content
// ---------------------------------------------------------------------------

export async function generateSMSContent(request: SMSGenerationRequest): Promise<SMSGenerationResult> {
  const { templateType, brandContext, tone = "friendly", topic, productName, discount, eventName, link, customPrompt } = request;

  const templateInfo = await resolveTemplateInfo(templateType, "sms");

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Generate a "${templateInfo.name}" SMS message.

Template Type: ${templateType}
Template Purpose: ${templateInfo.description}
Tone: ${tone}`;

  if (templateInfo.aiPromptHint) {
    prompt += `\n\nSpecific Instructions: ${templateInfo.aiPromptHint}`;
  }

  if (topic) prompt += `\nTopic: ${topic}`;
  if (productName) prompt += `\nProduct/Service: ${productName}`;
  if (discount) prompt += `\nDiscount/Offer: ${discount}`;
  if (eventName) prompt += `\nEvent Name: ${eventName}`;
  if (link) prompt += `\nLink to include: ${link}`;
  if (customPrompt) prompt += `\n\nAdditional Instructions: ${customPrompt}`;

  prompt += `

Generate an SMS message that:
- Is concise and impactful
- Includes a clear call-to-action
- Uses merge tags like {{firstName}} where appropriate
- Fits within 160 characters if possible (single segment)
- If longer, optimize for 320 characters max (2 segments)
- Includes the brand name
- Respects the personal nature of SMS

Return ONLY the SMS message text, nothing else. No quotes, no labels, just the message.`;

  const response = await ai.generate(prompt, {
    maxTokens: 200,
    temperature: 0.6,
    systemPrompt: SMS_SYSTEM_PROMPT,
  });

  const content = response.trim();
  const characterCount = content.length;
  const segmentCount = Math.ceil(characterCount / 160);

  return {
    content,
    characterCount,
    segmentCount,
  };
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseEmailResponse(response: string): EmailGenerationResult {
  try {
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.slice(7);
    }
    if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith("```")) {
      cleanResponse = cleanResponse.slice(0, -3);
    }

    const parsed = JSON.parse(cleanResponse.trim());

    return {
      subject: String(parsed.subject || ""),
      preheader: String(parsed.preheader || ""),
      content: String(parsed.content || ""),
      htmlContent: String(parsed.htmlContent || generateDefaultHTML(parsed.content || "", parsed.subject || "")),
    };
  } catch {
    console.error("Failed to parse email response:", response);
    return {
      subject: "Your Update",
      preheader: "Check out what's new",
      content: response,
      htmlContent: generateDefaultHTML(response, "Your Update"),
    };
  }
}

function generateDefaultHTML(content: string, subject: string): string {
  const escapedContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #333333;">
                ${escapedContent}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Get token estimates for tracking
export function getCampaignTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
