import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login",
  description: "FlowSmartly Admin Portal - Restricted access for administrators.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
