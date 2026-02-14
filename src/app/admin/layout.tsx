import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal",
    template: "%s | FlowSmartly Admin",
  },
  description: "FlowSmartly Admin Portal - Manage users, content, campaigns, and platform settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
