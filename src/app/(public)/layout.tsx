import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, Shield, FileText, ScrollText, ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: {
    default: "FlowSmartly",
    template: "%s | FlowSmartly",
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">FlowSmartly</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden sm:flex items-center gap-6">
              <Link
                href="/terms"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ScrollText className="w-4 h-4" />
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="w-4 h-4" />
                Privacy Policy
              </Link>
              <Link
                href="/sms-terms"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="w-4 h-4" />
                SMS Terms
              </Link>
              <Link
                href="/marketing-compliance"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Compliance
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to App
              </Link>
            </nav>

            {/* Mobile nav */}
            <div className="flex sm:hidden items-center gap-4">
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/sms-terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                SMS
              </Link>
              <Link
                href="/marketing-compliance"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Compliance
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                App
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-6 h-6 rounded-lg bg-brand-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span>
                &copy; {new Date().getFullYear()} FlowSmartly. All rights
                reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="/terms"
                className="hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/sms-terms"
                className="hover:text-foreground transition-colors"
              >
                SMS Terms
              </Link>
              <Link
                href="/marketing-compliance"
                className="hover:text-foreground transition-colors"
              >
                Compliance
              </Link>
              <a
                href="mailto:support@flowsmartly.com"
                className="hover:text-foreground transition-colors"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
