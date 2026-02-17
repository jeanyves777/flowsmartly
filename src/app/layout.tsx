import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { CreditPurchaseModal } from "@/components/payments/credit-purchase-modal";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://flowsmartly.com"),
  title: {
    default: "FlowSmartly - AI-Powered Content Creation & Marketing Platform",
    template: "%s | FlowSmartly",
  },
  description:
    "Create, share, and grow with AI-powered tools. FlowSmartly combines AI content creation, social media management, email & SMS marketing, ad campaigns, and smart analytics — all in one platform.",
  keywords: [
    "AI content creation",
    "social media management",
    "email marketing",
    "SMS marketing",
    "ad campaigns",
    "content marketing",
    "AI writing assistant",
    "social media scheduling",
    "marketing automation",
    "FlowSmartly",
  ],
  authors: [{ name: "FlowSmartly" }],
  creator: "FlowSmartly",
  publisher: "FlowSmartly",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flowsmartly.com",
    title: "FlowSmartly - AI-Powered Content Creation & Marketing Platform",
    description:
      "Create, share, and grow with AI-powered tools. AI content creation, social media management, email & SMS marketing, and ad campaigns — all in one platform.",
    siteName: "FlowSmartly",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "FlowSmartly Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowSmartly - AI-Powered Content Creation & Marketing Platform",
    description:
      "Create, share, and grow with AI-powered tools. AI content creation, social media management, email & SMS marketing, and ad campaigns.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://flowsmartly.com/#organization",
        name: "FlowSmartly",
        url: "https://flowsmartly.com",
        logo: {
          "@type": "ImageObject",
          url: "https://flowsmartly.com/icon-512.png",
          width: 512,
          height: 512,
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: "info@flowsmartly.com",
          contactType: "customer support",
        },
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": "https://flowsmartly.com/#website",
        url: "https://flowsmartly.com",
        name: "FlowSmartly",
        publisher: { "@id": "https://flowsmartly.com/#organization" },
        description:
          "AI-powered content creation, social media management, and marketing tools — all in one platform.",
      },
      {
        "@type": "SoftwareApplication",
        name: "FlowSmartly",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free starter plan available",
        },
        description:
          "AI-powered content creation, social media management, email & SMS marketing, and ad campaign tools.",
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <CreditPurchaseModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
