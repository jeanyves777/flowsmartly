export type EditIntentPlan = {
  summary: string;
  bullets: string[];
  refinedPrompt: string;
  needsConfirmation: boolean;
  confirmReason: string;
  brandAssetsUsed: {
    logo: boolean;
    colors: boolean;
    contact: boolean;
    name: boolean;
    tagline: boolean;
    handles: boolean;
  };
};

export type EditIntentBrandKit = {
  name?: string | null;
  tagline?: string | null;
  logo?: string | null;
  iconLogo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  colors?: { primary?: string; secondary?: string; accent?: string } | null;
  handles?: {
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  } | null;
} | null | undefined;

type EditIntentOptions = {
  source: "studio" | "flowcreative";
  hasReferenceImages?: boolean;
  referenceCount?: number;
  hasRegion?: boolean;
  qualityCheckEnabled?: boolean;
  brandName?: string | null;
  brandKit?: EditIntentBrandKit;
};

const ACTION_PATTERNS = {
  replace: /\b(replace|swap|change|turn\s+into|make\s+it|use\s+my|using\s+my)\b/i,
  remove: /\b(remove|erase|delete|take\s+out|clean\s+up)\b/i,
  face: /\b(face|person|people|woman|man|child|model|presenter|headshot|portrait|identity)\b/i,
  logo: /\b(logo|brand\s*mark|wordmark|icon|emblem|monogram|seal|badge)\b/i,
  text: /\b(text|copy|headline|caption|word|letter|font|spelling)\b/i,
  background: /\b(background|backdrop|scene|room|environment)\b/i,
  style: /\b(style|match|premium|cleaner|modern|luxury|realistic|cinematic)\b/i,
  // Brand-asset triggers — when the user references their own brand data
  brandColors: /\b(brand\s*color|brand\s*colour|brand\s*palette|my\s*color|my\s*colour|our\s*color|our\s*colour|color\s*palette|brand\s*hex)s?\b/i,
  brandName: /\b(brand\s*name|business\s*name|company\s*name|my\s*brand|our\s*brand)\b/i,
  tagline: /\b(tagline|slogan|motto)\b/i,
  contact: /\b(contact|reach\s*us|get\s*in\s*touch|contact\s*info|contact\s*details)\b/i,
  phone: /\b(phone|number|tel|telephone|call\s*us|mobile|cell)\b/i,
  email: /\b(e[-\s]?mail|email\s*us|mailto)\b/i,
  website: /\b(website|site|url|web\s*address|domain|homepage|landing\s*page)\b/i,
  address: /\b(address|location|street|office|store\s*address|come\s*to|visit\s*us)\b/i,
  socials: /\b(social|socials|handle|handles|instagram|insta|ig\b|facebook|fb\b|tiktok|twitter|x\.com|linkedin|youtube|@)\b/i,
};

const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function compactValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function joinAddress(brand: NonNullable<EditIntentBrandKit>): string | null {
  const parts = [brand.address, brand.city, brand.state, brand.zip, brand.country]
    .map(compactValue)
    .filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildEditIntentPlan(prompt: string, options: EditIntentOptions): EditIntentPlan {
  const cleanPrompt = prompt.trim().replace(/\s+/g, " ");
  const wordCount = cleanPrompt.split(/\s+/).filter(Boolean).length;
  const bullets: string[] = [];
  const warnings: string[] = [];
  const brand = options.brandKit ?? null;

  if (ACTION_PATTERNS.replace.test(cleanPrompt)) {
    bullets.push("Change only the requested subject or area, not the whole design.");
  }
  if (ACTION_PATTERNS.remove.test(cleanPrompt)) {
    bullets.push("Remove the requested item and blend the surrounding background naturally.");
  }
  if (ACTION_PATTERNS.background.test(cleanPrompt)) {
    bullets.push("Update the background while keeping the main subject and layout stable.");
  }
  if (ACTION_PATTERNS.text.test(cleanPrompt)) {
    bullets.push("Keep text readable and preserve existing wording unless the prompt asks to change it.");
  }
  if (ACTION_PATTERNS.logo.test(cleanPrompt) || options.brandName) {
    bullets.push("Use the real brand logo only; do not invent, redraw, repaint, or replace it.");
  }
  if (ACTION_PATTERNS.face.test(cleanPrompt) || options.hasReferenceImages) {
    bullets.push("Preserve the referenced person, product, or logo identity instead of generating a substitute or lookalike.");
  }
  if (ACTION_PATTERNS.style.test(cleanPrompt)) {
    bullets.push("Apply the requested style without degrading sharpness or repainting unchanged areas.");
  }
  if (options.hasRegion) {
    bullets.push("Focus the edit on the selected region and keep the rest of the canvas unchanged.");
  }
  if (bullets.length === 0) {
    bullets.push("Apply the requested improvement while preserving the original design structure.");
  }

  // ── Detect which brand assets the prompt references ──
  const wantsLogo = ACTION_PATTERNS.logo.test(cleanPrompt);
  const wantsColors = ACTION_PATTERNS.brandColors.test(cleanPrompt);
  const wantsName = ACTION_PATTERNS.brandName.test(cleanPrompt);
  const wantsTagline = ACTION_PATTERNS.tagline.test(cleanPrompt);
  const wantsContact = ACTION_PATTERNS.contact.test(cleanPrompt);
  const wantsPhone = wantsContact || ACTION_PATTERNS.phone.test(cleanPrompt);
  const wantsEmail = wantsContact || ACTION_PATTERNS.email.test(cleanPrompt);
  const wantsWebsite = wantsContact || ACTION_PATTERNS.website.test(cleanPrompt);
  const wantsAddress = wantsContact || ACTION_PATTERNS.address.test(cleanPrompt);
  const wantsSocials = ACTION_PATTERNS.socials.test(cleanPrompt);

  // ── Build the "use these exact values" brand block ──
  const brandLines: string[] = [];
  const brandAssetsUsed = {
    logo: false,
    colors: false,
    contact: false,
    name: false,
    tagline: false,
    handles: false,
  };

  if (brand) {
    const logoUrl = compactValue(brand.logo) || compactValue(brand.iconLogo);
    if (wantsLogo && logoUrl) {
      brandLines.push(
        `- LOGO: The user's real brand logo will be supplied as an additional reference image. Use that exact image — do not redraw, restyle, recolor, or substitute it. Place it where the prompt asks; keep its original colors and proportions.`,
      );
      brandAssetsUsed.logo = true;
    }
    if (wantsName && compactValue(brand.name)) {
      brandLines.push(`- BRAND NAME: "${brand.name}" — render this exact text. Do not paraphrase, abbreviate, or invent an alternate name.`);
      brandAssetsUsed.name = true;
    }
    if (wantsTagline && compactValue(brand.tagline)) {
      brandLines.push(`- TAGLINE: "${brand.tagline}" — render exactly as written.`);
      brandAssetsUsed.tagline = true;
    }
    if (wantsColors && brand.colors) {
      const { primary, secondary, accent } = brand.colors;
      const palette = [
        primary ? `primary ${primary}` : null,
        secondary ? `secondary ${secondary}` : null,
        accent ? `accent ${accent}` : null,
      ].filter(Boolean);
      if (palette.length > 0) {
        brandLines.push(`- BRAND COLORS: ${palette.join(", ")}. Use ONLY these hex values for any color the prompt asks to change. Do not invent neighboring shades.`);
        brandAssetsUsed.colors = true;
      }
    }
    const contactBits: string[] = [];
    if (wantsPhone && compactValue(brand.phone)) contactBits.push(`phone "${brand.phone}"`);
    if (wantsEmail && compactValue(brand.email)) contactBits.push(`email "${brand.email}"`);
    if (wantsWebsite && compactValue(brand.website)) contactBits.push(`website "${brand.website}"`);
    if (wantsAddress) {
      const addr = joinAddress(brand);
      if (addr) contactBits.push(`address "${addr}"`);
    }
    if (contactBits.length > 0) {
      brandLines.push(`- CONTACT — render these values verbatim, character-for-character (no auto-correct, no fake numbers, no placeholder text): ${contactBits.join("; ")}.`);
      brandAssetsUsed.contact = true;
    }
    if (wantsSocials && brand.handles) {
      const handleBits = Object.entries(brand.handles)
        .filter(([, value]) => compactValue(value))
        .map(([platform, value]) => `${platform} ${value}`);
      if (handleBits.length > 0) {
        brandLines.push(`- SOCIAL HANDLES: ${handleBits.join(", ")} — render exactly as written.`);
        brandAssetsUsed.handles = true;
      }
    }
  }

  const identitySensitive =
    options.hasReferenceImages ||
    ACTION_PATTERNS.face.test(cleanPrompt) ||
    ACTION_PATTERNS.logo.test(cleanPrompt) ||
    /\b(reference|same|exact|preserve|keep)\b/i.test(cleanPrompt);
  const destructive = ACTION_PATTERNS.replace.test(cleanPrompt) || ACTION_PATTERNS.remove.test(cleanPrompt);
  const vague = cleanPrompt.length < 18 || wordCount < 4;
  const needsConfirmation = Boolean(identitySensitive || destructive || vague || options.hasRegion);

  if (identitySensitive) warnings.push("Identity or brand assets are involved.");
  if (destructive) warnings.push("This edit can replace or remove visual content.");
  if (vague) warnings.push("The instruction is short, so confirming avoids a wasted credit.");
  if (options.hasRegion) warnings.push("A selected edit area will be used.");

  const brandBlock = brandLines.length > 0
    ? ["", "REAL BRAND ASSETS — USE EXACTLY (these come from the user's verified BrandKit):", ...brandLines]
    : [];

  const refinedPrompt = [
    cleanPrompt,
    "",
    "Confirmed edit interpretation:",
    ...bullets.map((item) => `- ${item}`),
    options.hasReferenceImages
      ? `- Treat the ${options.referenceCount || 1} uploaded reference image${(options.referenceCount || 1) === 1 ? "" : "s"} as exact visual anchors. Do not change the referenced face, product shape, logo, color, material, or important details.`
      : null,
    "- Preserve all unchanged areas, existing composition, image quality, resolution, sharp edges, and readable text.",
    "- If an exact face, product, or logo cannot be preserved, leave that part unchanged instead of inventing a new one. Never create a close resemblance as a substitute for the real person.",
    ...brandBlock,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: sentence(bullets[0].replace(/\.$/, "")),
    bullets,
    refinedPrompt,
    needsConfirmation,
    confirmReason: warnings.join(" ") || "Ready to apply.",
    brandAssetsUsed,
  };
}
