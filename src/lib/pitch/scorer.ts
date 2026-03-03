import type { ResearchData } from "./researcher";

export interface ScoreCategory {
  name: string;
  score: number; // 0-100
  weight: number;
  hexColor: string;
}

export interface DigitalScore {
  overall: number;
  label: string;
  hexColor: string;
  categories: ScoreCategory[];
}

export function scoreHexColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Weak";
  return "Critical";
}

export function computeDigitalScore(r: ResearchData): DigitalScore {
  const gp = r.googlePlaces;

  // 1. Website Health (20%)
  const websiteScore = Math.round(
    ([!!r.hasSSL, !!r.hasMobileViewport, !r.fetchError].filter(Boolean).length / 3) * 100
  );

  // 2. Analytics & Tracking (15%)
  const analyticsScore = Math.round(
    ([
      !!r.hasAnalytics,
      !!(r.techStack?.some(t => t.includes("Pixel") || t.includes("Hotjar") || t.includes("Tag Manager"))),
      !!r.hasEcommerce,
    ].filter(Boolean).length / 3) * 100
  );

  // 3. Lead Generation (25%)
  const leadScore = Math.round(
    ([!!r.hasEmailCapture, !!r.hasChatWidget, !!r.hasBookingSystem].filter(Boolean).length / 3) * 100
  );

  // 4. Online Reputation (25%)
  const reputationScore = gp
    ? Math.min(100, Math.round(
        ((gp.rating ?? 0) / 5) * 50 +
        Math.min(30, ((gp.reviewCount ?? 0) / 100) * 30) +
        20 // bonus for having a listing
      ))
    : 0;

  // 5. Social Presence (15%)
  const socialScore = Math.min(100, Math.round((r.socialLinks?.length ?? 0) * 33));

  const categories: ScoreCategory[] = [
    { name: "Website Health",    score: websiteScore,    weight: 20, hexColor: scoreHexColor(websiteScore) },
    { name: "Analytics",         score: analyticsScore,  weight: 15, hexColor: scoreHexColor(analyticsScore) },
    { name: "Lead Generation",   score: leadScore,       weight: 25, hexColor: scoreHexColor(leadScore) },
    { name: "Online Reputation", score: reputationScore, weight: 25, hexColor: scoreHexColor(reputationScore) },
    { name: "Social Presence",   score: socialScore,     weight: 15, hexColor: scoreHexColor(socialScore) },
  ];

  const overall = Math.round(
    categories.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0)
  );

  return { overall, label: scoreLabel(overall), hexColor: scoreHexColor(overall), categories };
}
