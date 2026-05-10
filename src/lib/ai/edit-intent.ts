export type EditIntentPlan = {
  summary: string;
  bullets: string[];
  refinedPrompt: string;
  needsConfirmation: boolean;
  confirmReason: string;
};

type EditIntentOptions = {
  source: "studio" | "flowcreative";
  hasReferenceImages?: boolean;
  referenceCount?: number;
  hasRegion?: boolean;
  qualityCheckEnabled?: boolean;
  brandName?: string | null;
};

const ACTION_PATTERNS = {
  replace: /\b(replace|swap|change|turn\s+into|make\s+it|use\s+my|using\s+my)\b/i,
  remove: /\b(remove|erase|delete|take\s+out|clean\s+up)\b/i,
  face: /\b(face|person|people|woman|man|child|model|presenter|headshot|portrait|identity)\b/i,
  logo: /\b(logo|brand|wordmark|icon|emblem)\b/i,
  text: /\b(text|copy|headline|caption|word|letter|font|spelling)\b/i,
  background: /\b(background|backdrop|scene|room|environment)\b/i,
  style: /\b(style|match|premium|cleaner|modern|luxury|realistic|cinematic)\b/i,
};

const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function buildEditIntentPlan(prompt: string, options: EditIntentOptions): EditIntentPlan {
  const cleanPrompt = prompt.trim().replace(/\s+/g, " ");
  const wordCount = cleanPrompt.split(/\s+/).filter(Boolean).length;
  const bullets: string[] = [];
  const warnings: string[] = [];

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
    bullets.push("Use the real brand logo only; do not invent, redraw, or replace it.");
  }
  if (ACTION_PATTERNS.face.test(cleanPrompt) || options.hasReferenceImages) {
    bullets.push("Preserve the referenced person, product, or logo identity instead of generating a substitute.");
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

  const refinedPrompt = [
    cleanPrompt,
    "",
    "Confirmed edit interpretation:",
    ...bullets.map((item) => `- ${item}`),
    options.hasReferenceImages
      ? `- Treat the ${options.referenceCount || 1} uploaded reference image${(options.referenceCount || 1) === 1 ? "" : "s"} as exact visual anchors. Do not change the referenced face, product shape, logo, color, material, or important details.`
      : null,
    "- Preserve all unchanged areas, existing composition, image quality, resolution, sharp edges, and readable text.",
    "- If an exact face, product, or logo cannot be preserved, leave that part unchanged instead of inventing a new one.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: sentence(bullets[0].replace(/\.$/, "")),
    bullets,
    refinedPrompt,
    needsConfirmation,
    confirmReason: warnings.join(" ") || "Ready to apply.",
  };
}
