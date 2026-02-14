import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your FlowSmartly account. Access AI-powered content creation, social media management, and marketing tools.",
  openGraph: {
    title: "Sign In to FlowSmartly",
    description:
      "Access your AI-powered content creation and marketing dashboard.",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
