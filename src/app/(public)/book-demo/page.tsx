import type { Metadata } from "next";
import { BookDemoContent } from "@/components/book-demo/book-demo-content";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "Book a FlowSmartly demo and see how content, commerce, local listings, compliance, and managed agents fit your growth workflow.",
  openGraph: {
    title: "Book a FlowSmartly Demo",
    description:
      "Tell us what you want to grow and we will tailor a FlowSmartly walkthrough around your team.",
  },
};

export default function BookDemoPage() {
  return <BookDemoContent />;
}
