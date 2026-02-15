import type { Metadata } from "next";
import { MarketplaceContent } from "@/components/marketplace/marketplace-content";

export const metadata: Metadata = {
  title: "Agent Marketplace",
  description:
    "Find expert marketing agents or become one. The FlowSmartly Agent Marketplace connects businesses with vetted marketing professionals.",
  openGraph: {
    title: "FlowSmartly Agent Marketplace - Expert Marketing on Demand",
    description:
      "Hire vetted marketing agents to grow your business, or offer your services as a FlowSmartly agent and earn recurring revenue.",
  },
};

export default function MarketplacePage() {
  return <MarketplaceContent />;
}
