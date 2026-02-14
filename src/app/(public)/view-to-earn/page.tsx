import type { Metadata } from "next";
import { ViewToEarnContent } from "@/components/view-to-earn/view-to-earn-content";

export const metadata: Metadata = {
  title: "View-to-Earn Credits",
  description:
    "Earn credits by viewing content and use them to boost your business with ads, AI content generation, and promoted campaigns.",
  openGraph: {
    title: "FlowSmartly View-to-Earn - Earn Credits, Grow Your Business Free",
    description:
      "Watch content, earn credits, and use them to promote your business with ads and AI content — all without spending a dime.",
  },
};

export default function ViewToEarnPage() {
  return <ViewToEarnContent />;
}
