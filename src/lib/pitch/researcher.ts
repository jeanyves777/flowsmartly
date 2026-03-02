import { ClaudeAI } from "@/lib/ai/client";

export interface ResearchData {
  websiteTitle: string;
  metaDescription: string;
  hasSSL: boolean;
  hasMobileViewport: boolean;
  hasAnalytics: boolean;
  hasChatWidget: boolean;
  hasBookingSystem: boolean;
  hasEmailCapture: boolean;
  hasEcommerce: boolean;
  socialLinks: string[];
  contactInfo: { email?: string | null; phone?: string | null; address?: string | null };
  techStack: string[];
  services: string[];
  painPoints: string[];
  opportunities: string[];
  summary: string;
  industry: string;
  fetchError?: string;
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || "";
}

function extractSocialLinks(html: string): string[] {
  const platforms = ["facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com", "youtube.com", "tiktok.com", "pinterest.com"];
  const found: string[] = [];
  for (const p of platforms) {
    if (html.includes(p)) {
      const match = html.match(new RegExp(`https?://(?:www\.)?${p.replace(".", "\\.")}[^"' >]+`, "i"));
      if (match) found.push(match[0]);
    }
  }
  return [...new Set(found)];
}

function extractContact(html: string): { email?: string; phone?: string; address?: string } {
  // Extract all emails from page — prefer non-noreply/non-generic
  const allEmails = [...html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)]
    .map(m => m[0])
    .filter(e => !e.includes("example.") && !e.includes("@w3.org") && !e.includes("sentry.io"));
  const businessEmail = allEmails.find(e => !e.startsWith("noreply") && !e.startsWith("no-reply")) || allEmails[0];

  // Multiple phone patterns: US, international
  const phonePatterns = [
    /(?:tel:|phone:|call us:?\s*)([+\d][\d\s\-().]{7,18}\d)/i,
    /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/,
  ];
  let phone: string | undefined;
  for (const re of phonePatterns) {
    const m = html.match(re);
    if (m) { phone = (m[1] || m[0]).trim(); break; }
  }

  // Address: look for structured data or common patterns
  const addressMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/) ||
    html.match(/itemprop=["']streetAddress["'][^>]*>([^<]+)</) ||
    html.match(/<address[^>]*>([^<]+)</i);
  const address = addressMatch?.[1]?.trim();

  return { email: businessEmail, phone, address };
}

function detectTechStack(html: string): string[] {
  const stack: string[] = [];
  const checks: [string, string][] = [
    ["WordPress", "wp-content"],
    ["Shopify", "shopify"],
    ["Wix", "wix.com"],
    ["Squarespace", "squarespace"],
    ["Webflow", "webflow"],
    ["Google Analytics", "gtag("],
    ["Google Analytics", "ga.js"],
    ["Facebook Pixel", "fbq("],
    ["Hotjar", "hotjar"],
    ["Intercom", "intercom"],
    ["Zendesk", "zendesk"],
    ["HubSpot", "hubspot"],
    ["Mailchimp", "mailchimp"],
    ["Calendly", "calendly"],
    ["Stripe", "stripe.js"],
    ["PayPal", "paypal"],
    ["Klaviyo", "klaviyo"],
    ["React", "_next/"],
    ["Next.js", "__NEXT_DATA__"],
  ];
  for (const [name, pattern] of checks) {
    if (html.toLowerCase().includes(pattern.toLowerCase())) {
      stack.push(name);
    }
  }
  return [...new Set(stack)];
}

export async function researchBusiness(url: string, businessName: string): Promise<ResearchData> {
  let html = "";
  let fetchError: string | undefined;
  let hasSSL = url.startsWith("https://");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BusinessResearchBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    hasSSL = res.url.startsWith("https://");
    html = await res.text();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to fetch website";
  }

  const websiteTitle = extractTitle(html) || businessName;
  const metaDescription = extractMeta(html, "description");
  const hasMobileViewport = html.includes("viewport");
  const hasAnalytics = html.includes("gtag(") || html.includes("ga.js") || html.includes("analytics");
  const hasChatWidget = html.includes("intercom") || html.includes("zendesk") || html.includes("tawk") || html.includes("crisp");
  const hasBookingSystem = html.includes("calendly") || html.includes("booking") || html.includes("acuity") || html.includes("mindbody");
  const hasEmailCapture = html.includes("newsletter") || html.includes("subscribe") || html.includes("email") && html.includes("form");
  const hasEcommerce = html.includes("shopify") || html.includes("add-to-cart") || html.includes("add_to_cart") || html.includes("woocommerce");
  const socialLinks = extractSocialLinks(html);
  const contactInfo = extractContact(html);
  const techStack = detectTechStack(html);

  // Use AI to extract services, pain points, and opportunities
  const ai = ClaudeAI.getInstance();
  const snippet = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  const analysisContext = `
Business Name: ${businessName}
Website URL: ${url}
Title: ${websiteTitle}
Meta Description: ${metaDescription}
Has SSL: ${hasSSL}
Has Mobile Viewport: ${hasMobileViewport}
Has Analytics: ${hasAnalytics}
Has Chat Widget: ${hasChatWidget}
Has Booking System: ${hasBookingSystem}
Has Email Capture: ${hasEmailCapture}
Has Ecommerce: ${hasEcommerce}
Social Media Present: ${socialLinks.length > 0 ? socialLinks.join(", ") : "None detected"}
Tech Stack: ${techStack.join(", ") || "Unknown"}
Website Text Content:
${snippet}
${fetchError ? `Note: Website could not be fetched (${fetchError}). Use business name and URL to infer.` : ""}
`;

  interface AIAnalysis {
    summary: string;
    industry: string;
    services: string[];
    painPoints: string[];
    opportunities: string[];
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
  }

  const aiResult = await ai.generateJSON<AIAnalysis>(
    `Analyze this business and return a JSON object with these exact fields:
- summary: 2-3 sentences describing what this business does and who they serve
- industry: single industry category (e.g. "Restaurant", "E-commerce", "Law Firm", "Real Estate", "Healthcare", "Fitness", "Beauty Salon", "Consulting")
- services: array of 3-6 main services/products they offer (infer from content)
- painPoints: array of 4-7 specific weaknesses you identify in their digital presence based on what's MISSING or poorly executed. Be specific (e.g. "No email capture form detected", "Missing social media presence", "No live chat for customer support", "Website not mobile optimized", "No analytics tracking found", "No online booking system"). Reference actual findings.
- opportunities: array of 4-6 specific growth opportunities for this business using digital marketing tools like FlowSmartly (e.g. "Automated follow-up sequences to convert leads", "SMS marketing campaigns for promotions", "Contact list building from website traffic", "AI-generated social media content for brand awareness"). Be specific to their industry.
- contactEmail: the primary business contact email found in the content, or null if none found. Must be a real business email, not noreply@ or example.com.
- contactPhone: the primary business phone number found in the content, formatted cleanly (e.g. "+1 (305) 555-1234"), or null if none found.
- contactAddress: the physical business address found in the content, or null if none found.

Context:
${analysisContext}`,
    { model: "claude-opus-4-6", maxTokens: 2048 }
  );

  // Merge: AI-extracted contact info takes priority over regex (more accurate)
  const finalContactInfo = {
    email: aiResult?.contactEmail || contactInfo.email,
    phone: aiResult?.contactPhone || contactInfo.phone,
    address: aiResult?.contactAddress || contactInfo.address,
  };

  return {
    websiteTitle,
    metaDescription,
    hasSSL,
    hasMobileViewport,
    hasAnalytics,
    hasChatWidget,
    hasBookingSystem,
    hasEmailCapture,
    hasEcommerce,
    socialLinks,
    contactInfo: finalContactInfo,
    techStack,
    services: aiResult?.services || [],
    painPoints: aiResult?.painPoints || [],
    opportunities: aiResult?.opportunities || [],
    summary: aiResult?.summary || `${businessName} is a business seeking digital growth opportunities.`,
    industry: aiResult?.industry || "Business",
    fetchError,
  };
}
