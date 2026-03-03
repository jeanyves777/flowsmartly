import { ClaudeAI } from "@/lib/ai/client";
import type { ResearchData } from "./researcher";

export interface PitchContent {
  subject: string;
  headline: string;
  personalizedHook: string;
  keyFindings: string[];       // 3 teaser findings (create curiosity, not all)
  hiddenFindingsCount: number; // "We found X more issues we'd love to discuss"
  opportunityParagraph: string;
  solutionBullets: string[];   // 2-3 brand service bullets matched to prospect's needs
  impactParagraph: string;
  ctaText: string;
  ctaSubtext: string;          // Below the CTA button
  closingLine: string;
}

export interface BrandContext {
  name: string;
  description?: string;
  industry?: string;
  niche?: string;
  products?: string[];        // Services/products the brand offers
  uniqueValue?: string;       // Unique value proposition
  targetAudience?: string;
  website?: string;
  senderName?: string;        // Name of the person sending (from user profile)
}

/** Build a human-readable "what we offer" section from brand context */
function buildBrandOffer(brand: BrandContext): string {
  const products = brand.products?.filter(Boolean) || [];
  const lines: string[] = [];

  if (brand.description) lines.push(brand.description);
  if (products.length) {
    lines.push(`Services/Products offered:`);
    products.forEach(p => lines.push(`- ${p}`));
  }
  if (brand.uniqueValue) lines.push(`Unique value proposition: ${brand.uniqueValue}`);
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);

  return lines.length
    ? lines.join("\n")
    : `${brand.name} is a ${brand.industry || "digital marketing"} company.`;
}

export async function generatePitch(
  research: ResearchData,
  businessName: string,
  brand: BrandContext
): Promise<PitchContent> {
  const ai = ClaudeAI.getInstance();
  const senderName = brand.senderName || brand.name;

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

  // Build Google enrichment context
  const gp = research.googlePlaces;
  const googleContext = gp
    ? `
VERIFIED GOOGLE BUSINESS DATA (authoritative source):
- Google Rating: ${gp.rating !== undefined ? `${gp.rating}/5 ⭐` : "No rating"} (${gp.reviewCount ?? 0} reviews)
- Business Status: ${gp.businessStatus || "Unknown"}
- Phone (verified): ${gp.phone || "N/A"}
- Address (verified): ${gp.address || "N/A"}
${gp.priceLevel !== undefined ? `- Price Level: ${"$".repeat(gp.priceLevel + 1)}` : ""}
${gp.recentReviews?.length ? `
REAL CUSTOMER REVIEWS from Google:
${gp.recentReviews.map(rv => `  [${rv.rating}⭐ · ${rv.timeAgo}]: "${rv.text}`).join("\n")}` : "- No public reviews found"}
`
    : "- No Google Business listing found (significant gap in online presence)";

  const brandOffer = buildBrandOffer(brand);

  const result = await ai.generateJSON<AIResult>(
    `You are a world-class B2B sales strategist writing a highly personalized outreach pitch on behalf of ${brand.name}${brand.industry ? ` — a ${brand.industry} company` : ""}.

You are writing to "${businessName}" to show them how ${brand.name} can specifically solve their pain points based on thorough research.

The pitch must:
1. Be written as if it came PERSONALLY from ${senderName} at ${brand.name} — use first person ("we", "our team")
2. Feel like you personally audited their business — reference SPECIFIC data (Google rating, review count, exact gaps found)
3. Create CURIOSITY — tease findings without revealing everything. Mention you found ${hiddenCount + 3} total opportunities
4. Be professional yet conversational — NOT corporate or generic
5. Map ${brand.name}'s specific services to THIS business's exact pain points
6. Focus on REVENUE GROWTH for the prospect — quantify the opportunity where possible
7. Soft CTA — invite a conversation, not a hard sell
8. If there are real customer reviews, subtly reference what customers are saying

ABOUT ${brand.name.toUpperCase()} (the sender):
${brandOffer}

VERIFIED RESEARCH ON "${businessName}" (the prospect):
Industry: ${research.industry}
Summary: ${research.summary}
Services they offer: ${research.services.join(", ")}
Key Pain Points (first 3 of ${research.painPoints.length} found): ${teaserPainPoints.join("; ")}
Growth Opportunities: ${research.opportunities.join("; ")}
Has Analytics: ${research.hasAnalytics}
Social Media Presence: ${research.socialLinks.length > 0 ? research.socialLinks.join(", ") : "None found"}
Has Live Chat: ${research.hasChatWidget}
Has Online Booking: ${research.hasBookingSystem}
Has Email Capture: ${research.hasEmailCapture}
Tech Stack: ${research.techStack.join(", ") || "Unknown"}
${googleContext}

Return a JSON object with these exact fields:
{
  "subject": "Email subject line (compelling, personalized, under 60 chars — from ${brand.name})",
  "headline": "Big proposal headline (10-15 words, specific to their situation, written for ${businessName})",
  "personalizedHook": "Opening 2-3 sentences from ${senderName} at ${brand.name} that show you've reviewed their business — reference something SPECIFIC. Make them say 'how did they know?'",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"] (3 specific pain points phrased as opportunities — not warnings),
  "opportunityParagraph": "1 paragraph (3-4 sentences) from ${brand.name}'s perspective, painting the picture of what's possible if they fix these issues. Make it specific to their industry and their business.",
  "solutionBullets": ["How ${brand.name} solves pain point 1", "How ${brand.name} solves pain point 2", "How ${brand.name} solves pain point 3"] (2-3 specific ${brand.name} capabilities matched to THIS prospect's pain points),
  "impactParagraph": "1 paragraph about the impact ${brand.name} has delivered for similar businesses. Be bold but believable. Use specific percentages or numbers where appropriate.",
  "ctaText": "Call to action text (5-8 words, action-oriented, e.g. 'Book a Free 20-Minute Call')",
  "ctaSubtext": "1 sentence below CTA — what happens next (e.g. 'No commitment. Just a quick chat about your goals.')",
  "closingLine": "Warm professional closing (1 sentence from ${senderName} at ${brand.name})"
}`,
    { model: "claude-opus-4-6", maxTokens: 2048 }
  );

  return {
    subject: result?.subject || `How ${brand.name} can help ${businessName} grow faster`,
    headline: result?.headline || `A Growth Strategy Built Specifically for ${businessName}`,
    personalizedHook: result?.personalizedHook || `We at ${brand.name} took a close look at ${businessName}'s digital presence and found several opportunities to accelerate your growth.`,
    keyFindings: result?.keyFindings || teaserPainPoints,
    hiddenFindingsCount: hiddenCount,
    opportunityParagraph: result?.opportunityParagraph || `${businessName} has significant untapped potential that the right support from ${brand.name} could unlock immediately.`,
    solutionBullets: result?.solutionBullets || research.opportunities.slice(0, 3),
    impactParagraph: result?.impactParagraph || `Businesses in the ${research.industry} industry that partner with ${brand.name} typically see a 30-50% increase in qualified leads within the first 90 days.`,
    ctaText: result?.ctaText || "Let's Talk About Your Growth",
    ctaSubtext: result?.ctaSubtext || "No commitment. Just a quick conversation about your business goals.",
    closingLine: result?.closingLine || `Looking forward to connecting, ${senderName} at ${brand.name}`,
  };
}
