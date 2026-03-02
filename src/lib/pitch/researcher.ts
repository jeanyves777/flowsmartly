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
  googlePlaces?: GooglePlacesData;
  fetchError?: string;
}

export interface GooglePlacesData {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  hours?: string[];
  isOpenNow?: boolean;
  businessStatus?: string;
  types?: string[];
  googleMapsUrl?: string;
  recentReviews?: Array<{ rating: number; text: string; timeAgo: string }>;
  priceLevel?: number;
}

// ── Precise pattern-based tech detection (no false positives) ─────────────────

function detectTechStack(html: string): {
  techStack: string[];
  hasAnalytics: boolean;
  hasChatWidget: boolean;
  hasBookingSystem: boolean;
  hasEmailCapture: boolean;
  hasEcommerce: boolean;
} {
  const lower = html.toLowerCase();
  const techStack: string[] = [];

  // CMS / site builders — match actual file paths, not just words
  if (lower.includes("/wp-content/themes/") || lower.includes("/wp-includes/js/") || lower.includes("wordpress")) techStack.push("WordPress");
  else if (lower.includes("cdn.shopify.com") || lower.includes("shopify.com/s/files/")) techStack.push("Shopify");
  else if (lower.includes("wix.com/") && lower.includes("wixstatic.com")) techStack.push("Wix");
  else if (lower.includes("squarespace.com") && (lower.includes("static1.squarespace") || lower.includes("squarespace-cdn"))) techStack.push("Squarespace");
  else if (lower.includes("webflow.io") || lower.includes("webflow-badge")) techStack.push("Webflow");
  else if (lower.includes("__next_data__") || lower.includes("_next/static/")) techStack.push("Next.js");

  // Analytics — match script loading patterns, not just the word
  const hasGA4 = /gtag\/js\?id=G-|gtag\('config',\s*'G-/i.test(html);
  const hasGA3 = /gtag\/js\?id=UA-|ga\('create'/i.test(html);
  const hasFBPixel = /fbq\s*\(\s*['"]init['"]/i.test(html);
  const hasHotjar = /hotjar\.com\/c\/[\w-]+\/hotjar-/.test(lower) || lower.includes("_hjsettings");
  const hasGTM = /googletagmanager\.com\/gtm\.js\?id=GTM-/i.test(html);

  if (hasGA4) techStack.push("Google Analytics 4");
  else if (hasGA3) techStack.push("Google Analytics");
  if (hasFBPixel) techStack.push("Facebook Pixel");
  if (hasHotjar) techStack.push("Hotjar");
  if (hasGTM) techStack.push("Google Tag Manager");

  const hasAnalytics = hasGA4 || hasGA3 || hasGTM || hasHotjar;

  // CRM / marketing tools
  if (lower.includes("hubspot.com/hs/") || lower.includes("hs-analytics")) techStack.push("HubSpot");
  if (lower.includes("mailchimp.com/") && lower.includes("mc.us")) techStack.push("Mailchimp");
  if (lower.includes("klaviyo.com/media/") || lower.includes("klaviyo-")) techStack.push("Klaviyo");
  if (lower.includes("activecampaign.com/")) techStack.push("ActiveCampaign");

  // Chat widgets — match their specific embed patterns
  const hasTawk = lower.includes("tawk.to/") && lower.includes("tawk_");
  const hasIntercom = lower.includes("intercom.io/") || lower.includes("widget.intercom.io");
  const hasZendesk = lower.includes("ekr.zdassets.com") || lower.includes("zopim");
  const hasCrisp = lower.includes("client.crisp.chat") || lower.includes("crisp.chat/");
  const hasTidio = lower.includes("code.tidio.co");
  const hasFBMessenger = lower.includes("connect.facebook.net") && lower.includes("customer_chat");
  const hasLiveChat = lower.includes("livechatinc.com/") || lower.includes("cdn.livechatinc.com");

  if (hasTawk) techStack.push("Tawk.to Live Chat");
  else if (hasIntercom) techStack.push("Intercom");
  else if (hasZendesk) techStack.push("Zendesk Chat");
  else if (hasCrisp) techStack.push("Crisp Chat");
  else if (hasTidio) techStack.push("Tidio");
  else if (hasFBMessenger) techStack.push("Facebook Messenger");
  else if (hasLiveChat) techStack.push("LiveChat");

  const hasChatWidget = hasTawk || hasIntercom || hasZendesk || hasCrisp || hasTidio || hasFBMessenger || hasLiveChat;

  // Booking systems — match embed script sources
  const hasCalendly = lower.includes("calendly.com/") && (lower.includes("assets.calendly.com") || lower.includes("calendly.com/api/"));
  const hasAcuity = lower.includes("acuityscheduling.com") && lower.includes("embed");
  const hasMindBody = lower.includes("mindbodyonline.com");
  const hasSimplyBook = lower.includes("simplybook.me") || lower.includes("simplybook.it");
  const hasOpenTable = lower.includes("opentable.com") && lower.includes("widget");
  const hasBookingCom = lower.includes("booking.com") && lower.includes("widget");
  const hasSquareBooking = lower.includes("squareup.com") && lower.includes("appointments");
  const hasSetMore = lower.includes("setmore.com/") && lower.includes("embed");
  const has10to8 = lower.includes("10to8.com") && lower.includes("widget");
  const hasDockHQ = lower.includes("doctolib.fr") || lower.includes("zocdoc.com");

  if (hasCalendly) techStack.push("Calendly");
  else if (hasAcuity) techStack.push("Acuity Scheduling");
  else if (hasMindBody) techStack.push("Mindbody");
  else if (hasSimplyBook) techStack.push("SimplyBook.me");
  else if (hasOpenTable) techStack.push("OpenTable");
  else if (hasSquareBooking) techStack.push("Square Appointments");
  else if (hasSetMore) techStack.push("Setmore");
  else if (hasDockHQ) techStack.push("Online Booking");

  const hasBookingSystem = hasCalendly || hasAcuity || hasMindBody || hasSimplyBook || hasOpenTable || hasBookingCom || hasSquareBooking || hasSetMore || has10to8 || hasDockHQ;

  // Email capture — only count actual HTML forms with email input fields
  const hasEmailForm = /<form[^>]*>[\s\S]{0,2000}?<input[^>]+type=["']?email["']?/i.test(html) ||
    /<input[^>]+type=["']?email["']?[\s\S]{0,2000}?<\/form>/i.test(html);
  const hasEmailCapture = hasEmailForm || lower.includes("mailchimp.com/subscribe") || lower.includes("klaviyo-form");

  // E-commerce
  const hasWooCommerce = lower.includes("woocommerce") && lower.includes("add-to-cart");
  const hasShopifyCart = lower.includes("cdn.shopify.com") && lower.includes("cart");
  const hasBigCommerce = lower.includes("bigcommerce.com");
  const hasWixStore = lower.includes("wixstatic.com") && lower.includes("stores");
  const hasEcommerce = hasWooCommerce || hasShopifyCart || hasBigCommerce || hasWixStore ||
    lower.includes("cdn.shopify.com/s/files/");

  // Payment processors
  if (lower.includes("js.stripe.com/v3")) techStack.push("Stripe Payments");
  else if (lower.includes("paypal.com/sdk") || lower.includes("paypalobjects.com")) techStack.push("PayPal");
  else if (lower.includes("squareup.com/") && lower.includes("payment")) techStack.push("Square Payments");

  return { techStack: [...new Set(techStack)], hasAnalytics, hasChatWidget, hasBookingSystem, hasEmailCapture, hasEcommerce };
}

// ── Social links — extract actual profile URLs from href attributes ────────────

function extractSocialLinks(html: string): string[] {
  const platforms = [
    { domain: "facebook.com", pattern: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/(?!share|sharer|tr\?|login)[^"'\s?#]+)/gi },
    { domain: "instagram.com", pattern: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s?#/][^"'\s?#]*)/gi },
    { domain: "twitter.com", pattern: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share)[^"'\s?#/][^"'\s?#]*)/gi },
    { domain: "linkedin.com", pattern: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s?#]*)/gi },
    { domain: "youtube.com", pattern: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/@?[^"'\s?#/][^"'\s?#]*)/gi },
    { domain: "tiktok.com", pattern: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s?#]*)/gi },
    { domain: "pinterest.com", pattern: /href=["'](https?:\/\/(?:www\.)?pinterest\.com\/[^"'\s?#/][^"'\s?#]*)/gi },
  ];

  const found: string[] = [];
  for (const { pattern } of platforms) {
    const matches = [...html.matchAll(pattern)];
    for (const m of matches) {
      const url = m[1]?.split(/['"]/)[0];
      if (url && url.length < 200) found.push(url);
    }
  }
  return [...new Set(found)].slice(0, 8);
}

// ── Contact extraction ────────────────────────────────────────────────────────

function extractContact(html: string): { email?: string; phone?: string; address?: string } {
  // Extract emails — filter out common non-business addresses
  const allEmails = [...html.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)]
    .map(m => m[1])
    .filter(e =>
      !e.includes("example.") &&
      !e.includes("@w3.org") &&
      !e.includes("sentry.io") &&
      !e.includes("@schemacache") &&
      !/\.(png|jpg|gif|css|js)$/i.test(e) &&
      e.split("@")[0].length > 2
    );
  const businessEmail = allEmails.find(e =>
    !e.toLowerCase().startsWith("noreply") &&
    !e.toLowerCase().startsWith("no-reply") &&
    !e.toLowerCase().startsWith("mailer-daemon")
  ) || allEmails[0];

  // Phone — multiple patterns, prefer tel: href (most accurate)
  const telHref = html.match(/href=["']tel:([+\d\s()./-]{7,20})["']/i);
  let phone = telHref?.[1]?.trim();
  if (!phone) {
    const patterns = [
      /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/,
      /\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]\d{2,4}[-.\s]\d{2,4}/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) { phone = m[0].trim(); break; }
    }
  }

  // Address — structured data first (most reliable), then microdata
  const jsonLd = html.match(/"streetAddress"\s*:\s*"([^"]{5,100})"/);
  const microdata = html.match(/itemprop=["']streetAddress["'][^>]*>([^<]{5,80})</);
  const addressTag = html.match(/<address[^>]*>\s*([^<]{10,150})\s*</i);
  const address = (jsonLd?.[1] || microdata?.[1] || addressTag?.[1])?.trim();

  return { email: businessEmail, phone, address };
}

// ── Google Places lookup ──────────────────────────────────────────────────────

async function lookupGooglePlaces(businessName: string, websiteUrl: string): Promise<GooglePlacesData | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    // Search by business name (extract domain as additional context)
    let domain = "";
    try {
      domain = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).hostname.replace("www.", "");
    } catch { /* ignore */ }

    const searchQuery = businessName + (domain ? ` ${domain}` : "");
    const textSearchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    textSearchUrl.searchParams.set("query", searchQuery);
    textSearchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(textSearchUrl.toString(), { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json() as {
      results: Array<{ place_id: string; name: string }>;
      status: string;
    };

    if (searchData.status !== "OK" || !searchData.results?.length) return null;

    // Get full details for best match
    const placeId = searchData.results[0].place_id;
    const detailFields = [
      "name", "formatted_address", "formatted_phone_number", "website",
      "rating", "user_ratings_total", "business_status", "types",
      "opening_hours", "reviews", "price_level", "url",
    ].join(",");

    const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailUrl.searchParams.set("place_id", placeId);
    detailUrl.searchParams.set("fields", detailFields);
    detailUrl.searchParams.set("key", apiKey);

    const detailRes = await fetch(detailUrl.toString(), { signal: AbortSignal.timeout(8000) });
    const detailData = await detailRes.json() as {
      result: {
        name?: string;
        formatted_address?: string;
        formatted_phone_number?: string;
        website?: string;
        rating?: number;
        user_ratings_total?: number;
        business_status?: string;
        types?: string[];
        opening_hours?: {
          open_now?: boolean;
          weekday_text?: string[];
        };
        reviews?: Array<{
          rating: number;
          text: string;
          relative_time_description: string;
          author_name: string;
        }>;
        price_level?: number;
        url?: string;
      };
      status: string;
    };

    if (detailData.status !== "OK" || !detailData.result) return null;
    const r = detailData.result;

    return {
      placeId,
      rating: r.rating,
      reviewCount: r.user_ratings_total,
      address: r.formatted_address,
      phone: r.formatted_phone_number,
      hours: r.opening_hours?.weekday_text,
      isOpenNow: r.opening_hours?.open_now,
      businessStatus: r.business_status,
      types: r.types?.filter(t => t !== "establishment" && t !== "point_of_interest").slice(0, 5),
      googleMapsUrl: r.url || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      recentReviews: r.reviews?.slice(0, 3).map(rv => ({
        rating: rv.rating,
        text: rv.text.slice(0, 300),
        timeAgo: rv.relative_time_description,
      })),
      priceLevel: r.price_level,
    };
  } catch (err) {
    console.warn("[researcher] Google Places lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Main research function ────────────────────────────────────────────────────

export async function researchBusiness(url: string, businessName: string): Promise<ResearchData> {
  let html = "";
  let fetchError: string | undefined;
  let hasSSL = url.startsWith("https://") || url.startsWith("http://");

  // Fetch homepage
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    hasSSL = res.url.startsWith("https://");
    html = await res.text();

    // Also try to fetch /contact page for more contact info
    if (html.length > 0) {
      try {
        const base = res.url.endsWith("/") ? res.url.slice(0, -1) : res.url.replace(/\/[^/]*$/, "");
        const contactRes = await fetch(`${base}/contact`, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BusinessBot/1.0)" },
        });
        if (contactRes.ok) {
          const contactHtml = await contactRes.text();
          // Append contact page content to main HTML for better extraction
          html += " " + contactHtml.slice(0, 10000);
        }
      } catch { /* contact page may not exist */ }
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to fetch website";
    // Try without https
    if (normalizedUrl.startsWith("https://")) {
      try {
        const fallback = await fetch(normalizedUrl.replace("https://", "http://"), {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BusinessBot/1.0)" },
        });
        html = await fallback.text();
        hasSSL = false;
        fetchError = undefined;
      } catch { /* ignore fallback failure */ }
    }
  }

  // Run Google Places lookup in parallel with website processing
  const googlePlacesPromise = lookupGooglePlaces(businessName, url);

  // Extract metadata from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const websiteTitle = titleMatch?.[1]?.trim() || businessName;

  const metaPatterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,300})["']/i,
    /<meta[^>]+content=["']([^"']{10,300})["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,300})["']/i,
  ];
  let metaDescription = "";
  for (const re of metaPatterns) {
    const m = html.match(re);
    if (m?.[1]) { metaDescription = m[1].trim(); break; }
  }

  const hasMobileViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const socialLinks = extractSocialLinks(html);
  const contactInfo = extractContact(html);
  const { techStack, hasAnalytics, hasChatWidget, hasBookingSystem, hasEmailCapture, hasEcommerce } = detectTechStack(html);

  // Clean HTML to plain text for AI analysis
  const plainText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  // Wait for Google Places
  const googlePlaces = await googlePlacesPromise;

  // Build rich context for AI
  const googleContext = googlePlaces ? `
GOOGLE BUSINESS PROFILE:
- Google Rating: ${googlePlaces.rating ?? "N/A"} ⭐ (${googlePlaces.reviewCount ?? 0} reviews)
- Business Status: ${googlePlaces.businessStatus || "Unknown"}
- Google Address: ${googlePlaces.address || "N/A"}
- Google Phone: ${googlePlaces.phone || "N/A"}
- Price Level: ${googlePlaces.priceLevel !== undefined ? "$".repeat(googlePlaces.priceLevel + 1) : "N/A"}
- Business Types: ${googlePlaces.types?.join(", ") || "N/A"}
- Currently Open: ${googlePlaces.isOpenNow !== undefined ? (googlePlaces.isOpenNow ? "Yes" : "No") : "Unknown"}
${googlePlaces.hours ? `- Hours:\n${googlePlaces.hours.map(h => "  " + h).join("\n")}` : ""}
${googlePlaces.recentReviews?.length ? `
RECENT CUSTOMER REVIEWS:
${googlePlaces.recentReviews.map(rv => `  [${rv.rating}⭐] "${rv.text}" — ${rv.timeAgo}`).join("\n")}` : "- No reviews available"}
` : "GOOGLE BUSINESS PROFILE: Not found in Google Maps (this is itself a significant issue)";

  const analysisContext = `
Business Name: ${businessName}
Website URL: ${url}
Page Title: ${websiteTitle}
Meta Description: ${metaDescription || "None"}

WEBSITE TECHNICAL SCAN:
- SSL/HTTPS: ${hasSSL ? "Yes" : "NO — unencrypted (serious trust issue)"}
- Mobile Viewport: ${hasMobileViewport ? "Yes" : "NO — not mobile optimized"}
- Analytics Tracking: ${hasAnalytics ? `Yes (${techStack.filter(t => t.includes("Analytics") || t.includes("Tag Manager")).join(", ")})` : "NO — no tracking installed"}
- Live Chat: ${hasChatWidget ? `Yes (${techStack.find(t => t.includes("Chat") || ["Intercom", "Tawk.to", "Crisp", "Tidio", "Zendesk"].some(c => t.includes(c))) || "live chat widget"})` : "NO — no chat widget found"}
- Booking System: ${hasBookingSystem ? `Yes (${techStack.find(t => ["Calendly", "Acuity", "Mindbody", "OpenTable", "SimplyBook", "Square", "Setmore"].some(c => t.includes(c))) || "booking system"})` : "NO — no online booking found"}
- Email Capture: ${hasEmailCapture ? "Yes — email capture form detected" : "NO — no email capture form found"}
- E-commerce: ${hasEcommerce ? "Yes" : "No"}
- Tech Stack: ${techStack.join(", ") || "Unknown"}
- Social Media: ${socialLinks.length > 0 ? socialLinks.join(", ") : "None detected"}
- Contact Email: ${contactInfo.email || "Not found"}
- Contact Phone: ${contactInfo.phone || "Not found"}
- Contact Address: ${contactInfo.address || "Not found"}

${googleContext}

WEBSITE TEXT CONTENT:
${plainText}
${fetchError ? `\nNOTE: Website could not be fully fetched (${fetchError}). Base analysis on business name, URL pattern, and any Google data available.` : ""}
`;

  // AI analysis — use all available data
  const ai = ClaudeAI.getInstance();

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
    `You are analyzing a real business to identify pain points and growth opportunities for a FlowSmartly sales pitch. Be SPECIFIC and ACCURATE based only on what the data actually shows — do NOT invent problems that aren't evident.

Return a JSON object with these fields:
- summary: 2-3 sentences describing what this business does, who they serve, and a quick assessment of their digital presence
- industry: single specific category (e.g. "Dental Clinic", "Mexican Restaurant", "Personal Injury Law Firm", "CrossFit Gym", "Hair Salon", "Plumbing Company")
- services: array of 3-6 ACTUAL services/products this business offers (based on their content, not generic)
- painPoints: array of 4-8 SPECIFIC weaknesses found in their digital presence. Only list what is ACTUALLY missing/weak based on the data provided. Reference actual data (e.g. "Only 12 Google reviews — well below industry average for local trust", "No SSL certificate — Google Chrome shows 'Not Secure' warning to visitors", "No email capture form — missing opportunity to build a marketing list", "No live chat — potential customers can't get instant answers"). For low Google ratings, cite the actual rating.
- opportunities: array of 4-6 specific growth opportunities for THIS business using FlowSmartly tools. Reference their industry and actual gaps (e.g. "SMS appointment reminders would reduce no-shows — critical for dental practices", "Automated review request campaigns to increase their ${googlePlaces?.rating ?? "low"} rating and ${googlePlaces?.reviewCount ?? 0} reviews", "Email marketing to existing patients/clients for repeat business and referrals").
- contactEmail: the primary business contact email from the content (not noreply@ or automated addresses), or null
- contactPhone: the primary business phone number, formatted cleanly, or null. Prefer Google Places phone over website if both present.
- contactAddress: the complete physical address, or null. Prefer Google Places address.

IMPORTANT:
- If Google rating exists, ALWAYS mention it in painPoints if below 4.5, or in opportunities if they have few reviews
- If no Google listing found, that IS a pain point
- If they have reviews with complaints, reference those specific issues
- Be factual, specific, and reference actual data points

Data:
${analysisContext}`,
    { model: "claude-opus-4-6", maxTokens: 2048 }
  );

  // Merge contact info: Google Places > AI extraction > regex
  const finalContactInfo = {
    email: aiResult?.contactEmail || contactInfo.email,
    phone: googlePlaces?.phone || aiResult?.contactPhone || contactInfo.phone,
    address: googlePlaces?.address || aiResult?.contactAddress || contactInfo.address,
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
    googlePlaces: googlePlaces || undefined,
    fetchError,
  };
}
