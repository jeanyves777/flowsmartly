"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Sparkles,
  Rss,
  Mail,
  MessageSquare,
  BarChart3,
  DollarSign,
  Settings,
  HelpCircle,
  LogOut,
  X,
  Megaphone,
  Crown,
  Lock,
  Palette,
  FolderOpen,
  CreditCard,
  Users,
  Globe,
  Video,
  PenSquare,
  CalendarDays,
  Target,
  Briefcase,
  Store,
  Gift,
  ClipboardList,
  FileQuestion,
  MessageCircle,
  UsersRound,
  Scissors,
  FolderKanban,
  FormInput,
  Clapperboard,
  FileText,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userPlan?: string;
  user?: {
    name: string;
    email: string;
    username?: string;
    avatarUrl?: string | null;
    aiCredits?: number;
    plan?: string;
  };
}

// Plans that have access to marketing features
const MARKETING_PLANS = ["PRO", "BUSINESS", "ENTERPRISE", "ADMIN", "AGENT"];

// Top-level (always visible)
const topNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Feed", href: "/feed", icon: Rss },
];

// Content management
const contentNavigation = [
  { name: "Posts", href: "/content/posts", icon: PenSquare },
  { name: "Schedule", href: "/content/schedule", icon: CalendarDays },
  { name: "Strategy & Automation", href: "/content/strategy", icon: Target },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

// AI Creatives
const aiCreativesNavigation = [
  { name: "Image Studio", href: "/studio", icon: Palette },
  { name: "Video Editor", href: "/video-editor", icon: Clapperboard },
  // { name: "Video Studio", href: "/video-studio", icon: Video },
  { name: "Logo Generator", href: "/logo-generator", icon: Crown },
  { name: "Media Library", href: "/media", icon: FolderOpen },
  { name: "My Designs", href: "/designs", icon: FolderKanban },
];

// Marketing features
const marketingNavigation = [
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Email Marketing", href: "/email-marketing", icon: Mail },
  { name: "SMS Marketing", href: "/sms-marketing", icon: MessageSquare, premium: true },
  { name: "Ads", href: "/ads", icon: Megaphone },
];

// Web presence
const webPresenceNavigation = [
  { name: "Landing Pages", href: "/landing-pages", icon: FileText },
  { name: "Website Builder", href: "/websites", icon: Globe },
  { name: "Domains", href: "/domains", icon: Globe },
];

// Business growth
const businessNavigation = [
  { name: "ListSmartly", href: "/listsmartly", icon: MapPin },
  { name: "Business Plan", href: "/tools/business-plan", icon: FileText },
  { name: "Pitch Board", href: "/pitch-board", icon: Briefcase },
];

// Tools & Insights
const toolsNavigation = [
  { name: "Follow-Ups", href: "/tools/follow-ups", icon: ClipboardList },
  { name: "Data Collection", href: "/tools/data-collection", icon: FormInput },
  { name: "Surveys", href: "/tools/surveys", icon: FileQuestion },
  { name: "BG Remover", href: "/tools/background-remover", icon: Scissors },
];

// Money
const moneyNavigation = [
  { name: "Earnings", href: "/earnings", icon: DollarSign },
  { name: "Referrals", href: "/referrals", icon: Gift },
];

const secondaryNavigation = [
  { name: "Teams", href: "/teams", icon: UsersRound },
  { name: "Messages", href: "/messages", icon: MessageCircle },
  { name: "Hire Agent", href: "/hire-agent", icon: Store },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Billing", href: "/settings?tab=billing", icon: CreditCard },
  { name: "Help", href: "/help", icon: HelpCircle },
];

export function MobileSidebar({ isOpen, onClose, userPlan = "FREE", user }: MobileSidebarProps) {
  const pathname = usePathname();
  const hasMarketingAccess = MARKETING_PLANS.includes(userPlan.toUpperCase());

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const renderNavItem = (
    item: { name: string; href: string; icon: React.ElementType; premium?: boolean },
    isActive: boolean,
    isLocked: boolean = false
  ) => {
    if (isLocked) {
      return (
        <div
          key={item.name}
          className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50"
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1">{item.name}</span>
          <Lock className="h-3.5 w-3.5" />
        </div>
      );
    }

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-500 text-white"
            : "text-foreground hover:bg-accent"
        )}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1">{item.name}</span>
        {item.premium && !isLocked && (
          <Crown className="h-3.5 w-3.5 text-amber-500" />
        )}
      </Link>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
          />

          {/* Sidebar Panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-0 left-0 top-0 z-50 flex w-[84%] max-w-[300px] flex-col bg-card md:hidden"
          >
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b px-3">
              <Link href="/dashboard" className="flex items-center" onClick={onClose}>
                <Image
                  src="/logo.png"
                  alt="FlowSmartly"
                  width={140}
                  height={35}
                  className="h-7 w-auto"
                  priority
                  unoptimized
                />
              </Link>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* User Info */}
            {user && (
              <div className="border-b p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                    <AvatarFallback className="bg-brand-500 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 font-medium">
                        {user.plan || "Free"} Plan
                      </span>
                      {user.aiCredits !== undefined && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-violet-500" />
                          {user.aiCredits.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {/* Dashboard + Feed */}
              {topNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return renderNavItem(item, isActive);
              })}

              {/* My Projects */}
              {renderNavItem(
                { name: "My Projects", href: "/projects", icon: FolderKanban },
                pathname === "/projects"
              )}

              {/* FlowAI — below My Projects */}
              {renderNavItem(
                { name: "FlowAI", href: "/flow-ai", icon: Sparkles },
                pathname.startsWith("/flow-ai")
              )}

              {/* Content Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Content
                  </span>
                </div>
                {contentNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/analytics" && pathname.startsWith("/analytics"));
                  return renderNavItem(item, isActive);
                })}
              </div>

              {/* AI Creatives Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    AI Creatives
                  </span>
                </div>
                {aiCreativesNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return renderNavItem(item, isActive);
                })}
              </div>

              {/* Marketing Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Marketing
                  </span>
                </div>
                {marketingNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const isLocked = item.premium === true && !hasMarketingAccess;
                  return renderNavItem(item, isActive, isLocked);
                })}
              </div>

              {/* Web Presence Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Web Presence
                  </span>
                </div>
                {webPresenceNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return renderNavItem(item, isActive);
                })}
              </div>

              {/* Business Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Business
                  </span>
                </div>
                {businessNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return renderNavItem(item, isActive);
                })}
              </div>

              {/* Tools & Insights Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Tools & Insights
                  </span>
                </div>
                {toolsNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return renderNavItem(item, isActive);
                })}
              </div>

              {/* Money Section */}
              <div className="pt-2.5">
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Money
                  </span>
                </div>
                {moneyNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return renderNavItem(item, isActive);
                })}
              </div>
            </nav>

            {/* Secondary Navigation */}
            <div className="space-y-1 border-t p-3">
              {secondaryNavigation
                .filter((item) => item.name !== "Teams" || hasMarketingAccess)
                .map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href.split("?")[0] + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                      onClick={onClose}
                      className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <button
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span>Log out</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
