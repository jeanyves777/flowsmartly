import type { Metadata } from "next";
import { PricingPageContent } from "@/components/pricing/pricing-page-content";

export const metadata: Metadata = {
  title: "Pricing — Credits, not contracts",
  description:
    "Start free. Pay only for the work the agent delivers — designs, posts, ads, stores, and more. Credits, not per-seat fees.",
  openGraph: {
    title: "FlowSmartly Pricing — Credits, not contracts",
    description:
      "One AI agent across every marketing surface. Start free, top up credits when you need more work done.",
  },
};

export default function PricingPage() {
  return <PricingPageContent />;
}
