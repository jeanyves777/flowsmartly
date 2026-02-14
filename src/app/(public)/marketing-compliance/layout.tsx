import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketing Compliance",
  description:
    "FlowSmartly Marketing Compliance - Our policies and practices for TCPA, CAN-SPAM, GDPR, and responsible marketing communications.",
};

export default function MarketingComplianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
