import Link from "next/link";
import Image from "next/image";

const productLinks = [
  { href: "/#features", label: "Features" },
  { href: "/marketplace", label: "Agent Marketplace" },
  { href: "/view-to-earn", label: "Earn Credits" },
  { href: "/pricing", label: "Pricing" },
  { href: "/dashboard", label: "Dashboard" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/sms-terms", label: "SMS Terms" },
  { href: "/marketing-compliance", label: "Marketing Compliance" },
];

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <Image
                src="/logo.png"
                alt="FlowSmartly"
                width={140}
                height={35}
                className="h-7 w-auto"
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI-powered content creation, social media management, and marketing tools — all in one platform.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Product</h3>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Legal</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:info@flowsmartly.com"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  info@flowsmartly.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} FlowSmartly. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
