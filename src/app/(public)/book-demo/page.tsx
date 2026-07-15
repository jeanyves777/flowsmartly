import type { Metadata } from "next";
import { BookDemoContent } from "@/components/book-demo/book-demo-content";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "See the FlowSmartly agent run your marketing — designs, posts, ads, store, and outreach — in a walkthrough tailored to your team.",
  openGraph: {
    title: "Book a FlowSmartly Demo",
    description:
      "Watch one AI agent operate every marketing surface. Tell us your goals and we will tailor the walkthrough.",
  },
};

export default function BookDemoPage() {
  return <BookDemoContent />;
}
