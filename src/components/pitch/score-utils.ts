import { BarChart3, Globe, Link2, Star, Target } from "lucide-react";
import { createElement } from "react";
import { scoreHexColor } from "@/lib/pitch/scorer";
import type { ResearchData, ScoreCategory } from "@/lib/pitch/pitch-detail-types";

export function computeDigitalScore(r: ResearchData): { overall: number; categories: ScoreCategory[] } {
  const gp = r.googlePlaces;

  const websiteItems = [
    { label: "SSL Certificate", ok: !!r.hasSSL, detail: r.hasSSL ? "Secure HTTPS" : "No SSL - browsers show 'Not Secure'" },
    { label: "Mobile Optimized", ok: !!r.hasMobileViewport, detail: r.hasMobileViewport ? "Mobile viewport set" : "Not mobile-friendly" },
    { label: "Website Found", ok: !r.fetchError, detail: r.fetchError ? "Website unreachable" : "Site accessible" },
  ];
  const websiteScore = Math.round(websiteItems.filter(i => i.ok).length / websiteItems.length * 100);

  const analyticsItems = [
    { label: "Analytics Tracking", ok: !!r.hasAnalytics, detail: r.hasAnalytics ? (r.techStack?.find(t => t.includes("Analytics") || t.includes("Tag Manager")) || "Analytics active") : "No analytics installed" },
    { label: "E-commerce Tracking", ok: !!r.hasEcommerce, detail: r.hasEcommerce ? "E-commerce detected" : "No e-commerce" },
    { label: "Marketing Pixels", ok: !!(r.techStack?.some(t => t.includes("Pixel") || t.includes("Hotjar") || t.includes("Klaviyo"))), detail: "Retargeting pixels" },
  ];
  const analyticsScore = Math.round(analyticsItems.filter(i => i.ok).length / analyticsItems.length * 100);

  const leadItems = [
    { label: "Email Capture Form", ok: !!r.hasEmailCapture, detail: r.hasEmailCapture ? "Email list building active" : "No email capture - losing leads" },
    { label: "Live Chat Widget", ok: !!r.hasChatWidget, detail: r.hasChatWidget ? (r.techStack?.find(t => t.includes("Chat") || ["Intercom", "Tawk", "Crisp", "Tidio"].some(c => t.includes(c))) || "Live chat active") : "No chat - visitors can't ask questions instantly" },
    { label: "Online Booking", ok: !!r.hasBookingSystem, detail: r.hasBookingSystem ? (r.techStack?.find(t => ["Calendly", "Acuity", "Mindbody", "OpenTable", "Square", "Setmore", "SimplyBook"].some(c => t.includes(c))) || "Booking system active") : "No online booking found" },
  ];
  const leadScore = Math.round(leadItems.filter(i => i.ok).length / leadItems.length * 100);

  const ratingScore = gp?.rating !== undefined ? Math.round((gp.rating / 5) * 100) : 0;
  const reviewScore = gp?.reviewCount !== undefined ? Math.min(100, Math.round((gp.reviewCount / 100) * 100)) : 0;
  const hasGoogleListing = !!gp;
  const reputationItems = [
    { label: "Google Business Listing", ok: hasGoogleListing, detail: hasGoogleListing ? `Found: ${gp?.rating ?? "no"} ★ (${gp?.reviewCount ?? 0} reviews)` : "Not found on Google Maps" },
    { label: "Rating ≥ 4.5 stars", ok: (gp?.rating ?? 0) >= 4.5, detail: gp?.rating !== undefined ? `Current: ${gp.rating}/5.0` : "No rating data" },
    { label: "50+ Reviews", ok: (gp?.reviewCount ?? 0) >= 50, detail: gp?.reviewCount !== undefined ? `${gp.reviewCount} reviews` : "No review data" },
  ];
  const reputationScore = hasGoogleListing
    ? Math.round((ratingScore * 0.5 + reviewScore * 0.3 + (hasGoogleListing ? 20 : 0)))
    : 0;

  const socialCount = r.socialLinks?.length ?? 0;
  const socialItems = [
    { label: "Active on Social Media", ok: socialCount > 0, detail: socialCount > 0 ? `${socialCount} platform${socialCount > 1 ? "s" : ""} linked` : "No social links found on site" },
    { label: "Multiple Platforms", ok: socialCount >= 2, detail: socialCount >= 2 ? `${socialCount} channels` : "Only 1 or fewer" },
    { label: "Has Video Presence", ok: !!(r.socialLinks?.some(l => l.includes("youtube") || l.includes("tiktok"))), detail: "Video content present" },
  ];
  const socialScore = Math.round(socialItems.filter(i => i.ok).length / socialItems.length * 100);

  const categories: ScoreCategory[] = [
    { name: "Website Health", score: websiteScore, weight: 20, icon: createElement(Globe, { className: "w-4 h-4" }), items: websiteItems },
    { name: "Analytics & Tracking", score: analyticsScore, weight: 15, icon: createElement(BarChart3, { className: "w-4 h-4" }), items: analyticsItems },
    { name: "Lead Generation", score: leadScore, weight: 25, icon: createElement(Target, { className: "w-4 h-4" }), items: leadItems },
    { name: "Online Reputation", score: reputationScore, weight: 25, icon: createElement(Star, { className: "w-4 h-4" }), items: reputationItems },
    { name: "Social Presence", score: socialScore, weight: 15, icon: createElement(Link2, { className: "w-4 h-4" }), items: socialItems },
  ];

  const overall = Math.round(categories.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0));
  return { overall, categories };
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function scoreBg(score: number): string {
  const hex = scoreHexColor(score);
  if (hex === "#22c55e") return "bg-green-500";
  if (hex === "#f59e0b") return "bg-amber-500";
  if (hex === "#f97316") return "bg-orange-500";
  return "bg-red-500";
}
