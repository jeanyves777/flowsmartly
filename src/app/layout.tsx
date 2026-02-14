import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "FlowSmartly - AI-Powered Content Creation Platform",
    template: "%s | FlowSmartly",
  },
  description: "Create, share, and monetize content with AI-powered tools. FlowSmartly combines content creation, social networking, and innovative view-to-earn monetization.",
  keywords: ["content creation", "AI", "social media", "marketing", "monetization"],
  authors: [{ name: "FlowSmartly" }],
  creator: "FlowSmartly",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flowsmartly.com",
    title: "FlowSmartly - AI-Powered Content Creation Platform",
    description: "Create, share, and monetize content with AI-powered tools.",
    siteName: "FlowSmartly",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowSmartly - AI-Powered Content Creation Platform",
    description: "Create, share, and monetize content with AI-powered tools.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
