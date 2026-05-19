import type { ServiceProposalContent } from "./proposal-agent";

function clean(value: unknown, max = 160) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function compactNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function plural(value: number, singular: string, pluralLabel: string) {
  return Math.round(value) === 1 ? singular : pluralLabel;
}

function categoryLabel(value: unknown) {
  const raw = clean(value, 80).replace(/_/g, " ").toLowerCase();
  if (!raw) return "";
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function serviceOutcome(proposal: ServiceProposalContent) {
  const source = [
    proposal.preset,
    proposal.serviceTitle,
    proposal.title,
    proposal.subtitle,
    proposal.clientNeed,
  ].join(" ").toLowerCase();

  if (/dent|patient|clinic|health|medical/.test(source)) return "more calls, direction requests, and booked appointments";
  if (/restaurant|diner|food|bar|cafe/.test(source)) return "more calls, direction requests, and table-ready visitors";
  if (/law|legal|attorney|lawyer/.test(source)) return "more qualified calls and consultation requests";
  if (/tax|account|bookkeep|financial/.test(source)) return "more qualified inquiries and scheduled consultations";
  if (/church|ministry|faith|nonprofit/.test(source)) return "more local discovery, trust, and community engagement";
  if (/social|content|campaign/.test(source)) return "more consistent visibility, engagement, and qualified inquiries";
  if (/website|conversion|redesign/.test(source)) return "more trust, clearer conversion paths, and qualified inquiries";
  return "more calls, visits, and qualified inquiries";
}

export function clientProofHeadline(proposal: ServiceProposalContent) {
  const profile = proposal.clientProfile;
  if (profile?.rating !== undefined || profile?.reviewCount !== undefined) return "What Your Google Profile Shows";
  if (profile?.types?.length || profile?.businessStatus || profile?.address) return "Your Local Growth Opportunity";
  return "Expected Local Impact";
}

export function clientProofBody(proposal: ServiceProposalContent) {
  const profile = proposal.clientProfile;
  const outcome = serviceOutcome(proposal);
  const category = categoryLabel(profile?.types?.[0]);
  const status = clean(profile?.businessStatus, 40);
  const address = clean(profile?.address, 160);

  if (profile?.rating !== undefined && profile.reviewCount !== undefined) {
    const reviewWord = plural(profile.reviewCount, "review", "reviews");
    if (profile.reviewCount < 10) {
      return `Your Google profile shows a strong ${profile.rating.toFixed(1)}/5 rating, but only ${compactNumber(profile.reviewCount)} public ${reviewWord}. Fresh reviews and clearer service signals can make that trust easier to believe and turn nearby searches into ${outcome}.`;
    }
    if (profile.reviewCount < 50) {
      return `Your Google profile shows a ${profile.rating.toFixed(1)}/5 rating from ${compactNumber(profile.reviewCount)} public ${reviewWord}. More review depth, profile activity, and service clarity can help nearby prospects choose you faster.`;
    }
    return `Your Google profile already shows a ${profile.rating.toFixed(1)}/5 rating from ${compactNumber(profile.reviewCount)} public ${reviewWord}. The opportunity is to turn that trust into ${outcome} with a profile that stays active, complete, and conversion-focused.`;
  }

  if (profile?.rating !== undefined) {
    return `Your ${profile.rating.toFixed(1)}/5 Google rating is a trust signal prospects see before they ever reach your website. We will strengthen that first impression and turn more local searches into ${outcome}.`;
  }

  if (profile?.reviewCount !== undefined) {
    const reviewWord = plural(profile.reviewCount, "review", "reviews");
    return `Your ${compactNumber(profile.reviewCount)} public Google ${reviewWord} give prospects a visible reason to trust you. We will build on that proof and make the profile work harder for ${outcome}.`;
  }

  if (category || status || address) {
    const profileParts = [
      category ? `as a ${category}` : "",
      status === "OPERATIONAL" ? "with an active public listing" : status ? `with a ${status.toLowerCase()} listing` : "",
      address ? `at ${address}` : "",
    ].filter(Boolean).join(" ");
    return `Your local profile is already discoverable ${profileParts}. We will sharpen the categories, content, photos, reviews, and calls-to-action so nearby prospects have clearer reasons to choose you.`;
  }

  const point = proposal.proofPoints.find((item) => clean(item.metric) && clean(item.label));
  if (point) {
    return `We will focus on measurable local growth, including ${clean(point.metric, 40)} ${clean(point.label, 80).toLowerCase()}. You will have clearer signals for visibility, trust, and inquiry quality as the work compounds.`;
  }

  return "The goal is practical local growth you can evaluate through visibility, trust signals, calls, direction requests, and qualified inquiries.";
}

export function isInternalProofCopy(value: unknown) {
  return /public profile signals?|raw context|specific and measurable|this section|the client can see|proof points?/i.test(clean(value, 300));
}
