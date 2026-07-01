import Link from "next/link";
import Image from "next/image";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#surfaces", label: "Surfaces" },
      { href: "/#work", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/register", label: "Start free" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/help", label: "Help center" },
      { href: "/book-demo", label: "Book a demo" },
      { href: "/marketing-compliance", label: "Compliance" },
      { href: "mailto:info@flowsmartly.com", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/gdpr", label: "GDPR" },
      { href: "/sms-terms", label: "SMS terms" },
      { href: "/ecommerce-terms", label: "E-commerce terms" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="mb-4 flex items-center">
              <Image src="/logo.png" alt="FlowSmartly" width={150} height={38} className="h-7 w-auto" unoptimized />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              One AI agent that designs, publishes, advertises, sells and follows up — across every surface, credit by credit.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} FlowSmartly · One agent, every surface.</p>
          <a href="mailto:info@flowsmartly.com" className="text-sm text-muted-foreground transition-colors hover:text-foreground">info@flowsmartly.com</a>
        </div>
      </div>
    </footer>
  );
}
