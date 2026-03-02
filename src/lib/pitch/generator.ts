import { ClaudeAI } from "@/lib/ai/client";
import type { ResearchData } from "./researcher";

export interface PitchContent {
  subject: string;
  headline: string;
  personalizedHook: string;
  keyFindings: string[];       // 3 teaser findings (create curiosity, not all)
  hiddenFindingsCount: number; // "We found X more issues we'd love to discuss"
  opportunityParagraph: string;
  solutionBullets: string[];   // 2-3 FlowSmartly features matched to needs
  impactParagraph: string;
  ctaText: string;
  ctaSubtext: string;          // Below the CTA button
  closingLine: string;
}

const FLOWSMARTLY_FEATURES = `
FlowSmartly is an all-in-one AI-powered marketing & growth platform offering:
- AI Social Media Content: Instantly generate branded posts, captions, reels, carousels
- Email Marketing: Beautiful campaigns, automated sequences, segmentation
- SMS Marketing: Text campaigns, follow-up automation, appointment reminders
- Contact Management: Smart contact lists, tagging, lead tracking
- Campaign Analytics: Real-time performance tracking and optimization
- AI Image & Video Generation: Brand-consistent visuals in seconds
- Follow-Up Automation: Automated touchpoints that convert leads to clients
- QR Code & Data Collection: Custom forms, surveys, event check-ins
- Team Collaboration: Multi-user workspace with role-based access
- White-Label Options: Branded client portals for agencies
- Scheduling & Booking Integration: Connect with existing booking systems
- Lead Generation Tools: AI-powered pitch board, prospecting, and outreach
`;

export async function generatePitch(
  research: ResearchData,
  businessName: string,
  senderName: string
): Promise<PitchContent> {
  const ai = ClaudeAI.getInstance();

  const hiddenCount = Math.max(0, research.painPoints.length - 3);
  const teaserPainPoints = research.painPoints.slice(0, 3);

  interface AIResult {
    subject: string;
    headline: string;
    personalizedHook: string;
    keyFindings: string[];
    opportunityParagraph: string;
    solutionBullets: string[];
    impactParagraph: string;
    ctaText: string;
    ctaSubtext: string;
    closingLine: string;
  }

  const result = await ai.generateJSON<AIResult>(
    `You are a world-class B2B sales strategist writing a personalized sales pitch for FlowSmartly — an AI-powered all-in-one digital marketing platform.

Write a compelling, highly personalized pitch for "${businessName}" based on the research below. The pitch must:
1. Feel like you personally reviewed their business (reference specific findings)
2. Create CURIOSITY — tease findings without revealing everything
3. Be professional yet conversational — NOT corporate or generic
4. Focus on REVENUE GROWTH and solving their specific pain points
5. Have a soft CTA — invite a conversation, not a hard sell

ABOUT FLOWSMARTLY:
${FLOWSMARTLY_FEATURES}

BUSINESS RESEARCH:
Industry: ${research.industry}
Summary: ${research.summary}
Services: ${research.services.join(", ")}
Key Pain Points Found: ${teaserPainPoints.join("; ")}
Additional issues found (not revealed): ${hiddenCount} more
Opportunities Identified: ${research.opportunities.join("; ")}
Has Analytics: ${research.hasAnalytics}
Has Social Media: ${research.socialLinks.length > 0}
Has Chat Widget: ${research.hasChatWidget}
Has Booking System: ${research.hasBookingSystem}
Has Email Capture: ${research.hasEmailCapture}
Tech Stack: ${research.techStack.join(", ") || "Unknown"}

Return a JSON object with these exact fields:
{
  "subject": "Email subject line (compelling, personalized, under 60 chars)",
  "headline": "Big headline for the proposal (10-15 words, specific to their business)",
  "personalizedHook": "Opening 2-3 sentences that show you've reviewed their business — reference something SPECIFIC. Make them say 'how did they know?'",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"] (3 specific pain points phrased as opportunities, NOT warnings),
  "opportunityParagraph": "1 paragraph (3-4 sentences) painting the picture of what's possible for this specific business if they solve these issues. Be specific to their industry.",
  "solutionBullets": ["Benefit 1 — feature matched to their need", "Benefit 2 — feature matched to their need", "Benefit 3 — feature matched to their need"] (2-3 FlowSmartly capabilities most relevant to THIS business),
  "impactParagraph": "1 paragraph about expected impact — mention revenue potential or customer growth. Be bold but believable. Mention specific percentages or numbers where appropriate.",
  "ctaText": "Call to action button text (5-8 words, action-oriented)",
  "ctaSubtext": "1 sentence below CTA explaining what happens next (e.g. 'No commitment. Just a 20-minute conversation.')",
  "closingLine": "Warm professional closing line (1 sentence, from ${senderName})"
}`,
    { model: "claude-opus-4-6", maxTokens: 2048 }
  );

  return {
    subject: result?.subject || `How we can help ${businessName} grow faster`,
    headline: result?.headline || `A Growth Strategy Built Specifically for ${businessName}`,
    personalizedHook: result?.personalizedHook || `We took a close look at ${businessName}'s digital presence and found several opportunities to accelerate your growth.`,
    keyFindings: result?.keyFindings || teaserPainPoints,
    hiddenFindingsCount: hiddenCount,
    opportunityParagraph: result?.opportunityParagraph || `${businessName} has significant untapped potential that the right digital tools could unlock immediately.`,
    solutionBullets: result?.solutionBullets || research.opportunities.slice(0, 3),
    impactParagraph: result?.impactParagraph || `Businesses in the ${research.industry} industry using FlowSmartly typically see a 30-50% increase in qualified leads within the first 90 days.`,
    ctaText: result?.ctaText || "Let's Talk About Your Growth",
    ctaSubtext: result?.ctaSubtext || "No commitment. Just a quick conversation about your business goals.",
    closingLine: result?.closingLine || `Looking forward to connecting, ${senderName}`,
  };
}
