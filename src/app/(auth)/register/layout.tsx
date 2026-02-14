import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your free FlowSmartly account. Start with AI content creation, social media management, email & SMS marketing, and more.",
  openGraph: {
    title: "Join FlowSmartly - Free AI Content Creation Platform",
    description:
      "Create, share, and grow with AI-powered tools. Start your free trial today.",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
