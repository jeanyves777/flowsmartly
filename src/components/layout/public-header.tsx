"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeMenu } from "@/components/shared/theme-menu";
import { ChevronDown, Menu, Sparkles, ArrowRight, HelpCircle, ShieldCheck, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import { SURFACES } from "@/components/marketing/surfaces";

const resourceLinks = [
  { href: "/help", label: "Help center", description: "Guides & walkthroughs.", icon: HelpCircle },
  { href: "/marketing-compliance", label: "Compliance", description: "Consent, TCPA & policy.", icon: ShieldCheck },
  { href: "/terms", label: "Terms & privacy", description: "How the platform works.", icon: FileCheck },
];

type MenuKey = "product" | "resources";

function ProductMega() {
  return (
    <div className="grid gap-1.5 p-4 md:grid-cols-3">
      <div className="md:col-span-3 mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-brand-500" /> One agent · every surface
      </div>
      {SURFACES.map((s) => {
        const Icon = s.icon;
        return (
          <Link key={s.key} href={`/#surfaces`} className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white", s.accent)}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{s.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{s.tagline}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function ResourcesMega() {
  return (
    <div className="grid gap-1 p-3 md:w-[360px]">
      {resourceLinks.map((r) => {
        const Icon = r.icon;
        return (
          <Link key={r.href} href={r.href} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-brand-500" />
            <span>
              <span className="block text-sm font-semibold text-foreground">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.description}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function PublicHeader() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menu, setMenu] = useState<MenuKey | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 px-2 transition-all duration-300", scrolled ? "pt-1" : "pt-2 sm:pt-3")}>
      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-border bg-background/80 px-4 shadow-lg backdrop-blur-xl transition-all duration-300 sm:px-6",
          scrolled ? "h-[62px]" : "h-[72px]",
        )}
        onMouseLeave={() => setMenu(null)}
      >
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="FlowSmartly" width={170} height={40} className="h-8 w-auto" priority unoptimized />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {(["product"] as MenuKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setMenu(key)}
              onClick={() => setMenu(menu === key ? null : key)}
              className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", menu === key ? "text-brand-600 dark:text-brand-300" : "text-muted-foreground hover:text-foreground")}
            >
              Product <ChevronDown className={cn("h-4 w-4 transition-transform", menu === key && "rotate-180")} />
            </button>
          ))}
          <Link href="/#work" onMouseEnter={() => setMenu(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">How it works</Link>
          <Link href="/#surfaces" onMouseEnter={() => setMenu(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">Surfaces</Link>
          <Link href="/pricing" onMouseEnter={() => setMenu(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
          <button
            type="button"
            onMouseEnter={() => setMenu("resources")}
            onClick={() => setMenu(menu === "resources" ? null : "resources")}
            className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", menu === "resources" ? "text-brand-600 dark:text-brand-300" : "text-muted-foreground hover:text-foreground")}
          >
            Resources <ChevronDown className={cn("h-4 w-4 transition-transform", menu === "resources" && "rotate-180")} />
          </button>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" onMouseEnter={() => setMenu(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">Log in</Link>
          <Button asChild className="h-11 gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-purple px-5 font-bold text-white shadow-lg hover:opacity-90" onMouseEnter={() => setMenu(null)}>
            <Link href="/register">Start free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <ThemeMenu />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeMenu />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="mt-8 flex flex-col gap-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surfaces</p>
                <div className="grid grid-cols-1 gap-1">
                  {SURFACES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Link key={s.key} href="/#surfaces" onClick={() => setSheetOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted">
                        <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white", s.accent)}><Icon className="h-4 w-4" /></span>
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
                <Link href="/#work" onClick={() => setSheetOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted">How it works</Link>
                <Link href="/pricing" onClick={() => setSheetOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted">Pricing</Link>
                <Link href="/login" onClick={() => setSheetOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted">Log in</Link>
                <Button asChild className="bg-gradient-to-r from-brand-500 to-accent-purple text-white">
                  <Link href="/register" onClick={() => setSheetOpen(false)}>Start free</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {menu && (
          <div className="absolute left-0 right-0 top-full pt-2" onMouseEnter={() => setMenu(menu)}>
            <div className="mx-auto overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
              {menu === "product" ? <ProductMega /> : <ResourcesMega />}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
