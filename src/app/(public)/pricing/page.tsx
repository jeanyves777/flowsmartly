import type { Metadata } from "next";
import { PricingPageContent } from "@/components/pricing/pricing-page-content";

export const metadata: Metadata = {
  title: "Pricing Plans",
  description:
    "Choose the perfect FlowSmartly plan for your content creation needs. Start free, upgrade anytime.",
  openGraph: {
    title: "FlowSmartly Pricing - AI Content Creation Plans",
    description:
      "Transparent pricing for AI-powered content creation, social media marketing, and view-to-earn monetization.",
  },
};

export default function PricingPage() {
  return <PricingPageContent />;
}
