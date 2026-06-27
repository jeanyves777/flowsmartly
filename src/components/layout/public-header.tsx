"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeMenu } from "@/components/shared/theme-menu";
import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  ChevronDown,
  FileCheck,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

type MegaMenuKey = "platform" | "solutions" | "resources";

type MenuLink = {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type MenuSection = {
  title: string;
  links: MenuLink[];
};

type MegaMenu = {
  sections: MenuSection[];
  rail?: ReactNode;
};

const megaMenus: Record<MegaMenuKey, MegaMenu> = {
  platform: {
    sections: [
      {
        title: "Core platform",
        links: [
          {
            href: "/#features",
            label: "AI Content Studio",
            description: "Create posts, captions, ads, and campaign ideas.",
            icon: Sparkles,
          },
          {
            href: "/#features",
            label: "Automation Hub",
            description: "Plan, publish, and reuse content across channels.",
            icon: Bot,
          },
          {
            href: "/#features",
            label: "Analytics",
            description: "Track performance, credits, reach, and outcomes.",
            icon: BarChart3,
          },
        ],
      },
      {
        title: "Premium solutions",
        links: [
          {
            href: "/flowshop",
            label: "FlowShop",
            description: "Launch an AI-powered storefront in minutes.",
            icon: ShoppingBag,
          },
          {
            href: "/listsmartly-details",
            label: "ListSmartly",
            description: "Sync local listings and reviews across directories.",
            icon: MapPin,
          },
          {
            href: "/view-to-earn",
            label: "View-to-Earn",
            description: "Turn engagement into reusable growth credits.",
            icon: WalletCards,
          },
        ],
      },
      {
        title: "Additional products",
        links: [
          {
            href: "/marketplace",
            label: "Agent Marketplace",
            description: "Hire vetted marketing agents or become one.",
            icon: Briefcase,
          },
          {
            href: "/marketing-compliance",
            label: "Compliance Center",
            description: "TCPA, email, consent, and policy guidance.",
            icon: ShieldCheck,
          },
          {
            href: "/pricing",
            label: "Credits and plans",
            description: "Choose the plan and credits that match your usage.",
            icon: Zap,
          },
        ],
      },
    ],
    rail: (
      <div className="h-full rounded-lg bg-zinc-100 p-5 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-muted-foreground">Platform</p>
        <div className="mt-6 space-y-5">
          <Link href="/#features" className="block font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300">
            AI and automation
          </Link>
          <Link href="/marketing-compliance" className="block font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300">
            Data and compliance
          </Link>
          <Link href="/marketplace" className="block font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300">
            Managed growth services
          </Link>
        </div>
      </div>
    ),
  },
  solutions: {
    sections: [
      {
        title: "By use case",
        links: [
          {
            href: "/#features",
            label: "Manage social media",
            description: "Create, schedule, and repurpose campaign content.",
            icon: MessageSquare,
          },
          {
            href: "/flowshop",
            label: "Drive more sales",
            description: "Connect storefronts, ads, and customer journeys.",
            icon: ShoppingBag,
          },
          {
            href: "/listsmartly-details",
            label: "Own local search",
            description: "Keep listings, reviews, and map data consistent.",
            icon: Globe2,
          },
        ],
      },
      {
        title: "By business",
        links: [
          {
            href: "/marketplace",
            label: "Agencies",
            description: "Manage client growth with AI-supported workflows.",
            icon: Users,
          },
          {
            href: "/flowshop",
            label: "E-commerce brands",
            description: "Sell products and promote them from one account.",
            icon: Building2,
          },
          {
            href: "/view-to-earn",
            label: "Creators",
            description: "Earn credits and turn attention into promotion.",
            icon: Rocket,
          },
        ],
      },
    ],
    rail: (
      <Link
        href="/marketplace"
        className="block h-full rounded-lg bg-foreground p-5 text-background transition-transform hover:-translate-y-0.5"
      >
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-background/10">
          <Image
            src={illustrationImages.growthDashboard}
            alt=""
            fill
            sizes="260px"
            unoptimized
            className="object-cover"
          />
        </div>
        <p className="mt-5 text-lg font-bold leading-snug">
          Your competitors are not smarter. They are just faster.
        </p>
        <p className="mt-3 text-sm leading-6 text-background/70">
          See how FlowSmartly connects content, commerce, listings, and agents.
        </p>
        <span className="mt-5 inline-block border-b border-background pb-1 text-sm font-semibold">
          Explore solutions
        </span>
      </Link>
    ),
  },
  resources: {
    sections: [
      {
        title: "Learn",
        links: [
          {
            href: "/help",
            label: "Help center",
            description: "Get walkthroughs and platform guidance.",
            icon: HelpCircle,
          },
          {
            href: "/marketing-compliance",
            label: "Compliance guide",
            description: "Understand consent, messaging, and policy rules.",
            icon: FileCheck,
          },
          {
            href: "/pricing",
            label: "Plan guide",
            description: "Compare credits, plans, and growth stages.",
            icon: LayoutDashboard,
          },
        ],
      },
      {
        title: "Company",
        links: [
          {
            href: "/privacy",
            label: "Privacy",
            description: "How FlowSmartly handles personal data.",
            icon: ShieldCheck,
          },
          {
            href: "/terms",
            label: "Terms",
            description: "Platform usage terms and account rules.",
            icon: FileCheck,
          },
          {
            href: "/gdpr",
            label: "GDPR",
            description: "Data rights and privacy commitments.",
            icon: Globe2,
          },
        ],
      },
    ],
    rail: (
      <div className="flex h-full flex-col justify-between rounded-lg bg-zinc-100 p-5 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Need help choosing?</p>
          <p className="mt-4 text-lg font-bold leading-snug text-foreground">
            Start with the workflow you need to fix first.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            FlowSmartly can start with content, commerce, listings, credits, or a managed agent.
          </p>
        </div>
        <div className="mt-6 rounded-lg bg-white p-4 text-sm dark:bg-zinc-950">
          <Link href="mailto:info@flowsmartly.com" className="flex items-center gap-2 font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300">
            <Mail className="h-4 w-4" />
            info@flowsmartly.com
          </Link>
        </div>
      </div>
    ),
  },
};

const mobileGroups = [
  { title: "Platform", links: megaMenus.platform.sections.flatMap((section) => section.links) },
  { title: "Solutions", links: megaMenus.solutions.sections.flatMap((section) => section.links) },
  { title: "Resources", links: megaMenus.resources.sections.flatMap((section) => section.links) },
];

function MegaMenuPanel({ menu }: { menu: MegaMenu }) {
  return (
    <div className="absolute left-0 right-0 top-full pt-3">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-950 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_1fr_1fr_280px]">
          {menu.sections.map((section) => (
            <div key={section.title}>
              <p className="mb-5 text-sm font-semibold text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-6">
                {section.links.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={`${section.title}-${item.label}`}
                      href={item.href}
                      className="group flex gap-3"
                    >
                      {Icon && (
                        <Icon className="mt-1 h-5 w-5 shrink-0 text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300" />
                      )}
                      <span>
                        <span className="block font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300">
                          {item.label}
                        </span>
                        {item.description && (
                          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {menu.rail}
        </div>
      </div>
    </div>
  );
}

export function PublicHeader() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MegaMenuKey | null>(null);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-2 pt-2">
      <div
        className="relative mx-auto max-w-7xl rounded-lg border border-zinc-200 bg-white/95 text-zinc-950 shadow-lg backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-50 dark:shadow-black/40"
        onMouseLeave={() => setActiveMenu(null)}
      >
        <div className="flex h-[76px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="FlowSmartly"
              width={170}
              height={40}
              className="h-8 w-auto"
              priority
              unoptimized
            />
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {(["platform", "solutions", "resources"] as MegaMenuKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveMenu(activeMenu === key ? null : key)}
                onFocus={() => setActiveMenu(key)}
                onMouseEnter={() => setActiveMenu(key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  activeMenu === key
                    ? "text-brand-700 dark:text-brand-300"
                    : "text-zinc-950 hover:text-brand-700 dark:text-zinc-50 dark:hover:text-brand-300"
                )}
              >
                {key[0].toUpperCase() + key.slice(1)}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    activeMenu === key && "rotate-180"
                  )}
                />
              </button>
            ))}
            <Link
              href="/pricing"
              onMouseEnter={() => setActiveMenu(null)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:text-brand-700 dark:text-zinc-50 dark:hover:text-brand-300"
            >
              Pricing
            </Link>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              onMouseEnter={() => setActiveMenu(null)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:text-brand-700 dark:text-zinc-50 dark:hover:text-brand-300"
            >
              Log in
            </Link>
            <Button
              variant="outline"
              className="h-12 border-zinc-950 bg-white px-5 font-semibold text-zinc-950 hover:bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
              asChild
              onMouseEnter={() => setActiveMenu(null)}
            >
              <Link href="/book-demo">Book a demo</Link>
            </Button>
            <Button className="h-12 bg-zinc-950 px-5 font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" asChild>
              <Link href="/register">Try for free</Link>
            </Button>
            <ThemeMenu />
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeMenu />
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 overflow-y-auto bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <nav className="mt-8 flex flex-col gap-6">
                  <Link href="/" className="flex items-center">
                    <Image
                      src="/logo.png"
                      alt="FlowSmartly"
                      width={150}
                      height={35}
                      className="h-8 w-auto"
                      unoptimized
                    />
                  </Link>
                  {mobileGroups.map((group) => (
                    <div key={group.title}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </p>
                      <div className="grid gap-1">
                        {group.links.map((link) => (
                          <Link
                            key={`${group.title}-${link.label}`}
                            href={link.href}
                            onClick={() => setSheetOpen(false)}
                            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Link
                    href="/pricing"
                    onClick={() => setSheetOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setSheetOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted"
                  >
                    Log in
                  </Link>
                  <Button variant="outline" asChild>
                    <Link href="/book-demo" onClick={() => setSheetOpen(false)}>
                      Book a demo
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register" onClick={() => setSheetOpen(false)}>
                      Try for free
                    </Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {activeMenu && <MegaMenuPanel menu={megaMenus[activeMenu]} />}
      </div>
    </header>
  );
}
