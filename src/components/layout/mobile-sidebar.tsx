"use client";

import { useEffect } from "react";
import Link from "next/link";
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
  Zap,
  Target,
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
const MARKETING_PLANS = ["PRO", "BUSINESS", "ENTERPRISE", "ADMIN"];

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Image Studio", href: "/studio", icon: Palette },
  { name: "Video Studio", href: "/video-studio", icon: Video },
  { name: "Logo Generator", href: "/logo-generator", icon: Crown },
  { name: "Media Library", href: "/media", icon: FolderOpen },
  { name: "Landing Pages", href: "/landing-pages", icon: Globe },
  { name: "Feed", href: "/feed", icon: Rss },
  { name: "Ads", href: "/ads", icon: Megaphone },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Earnings", href: "/earnings", icon: DollarSign },
];

// Content management features
const contentNavigation = [
  { name: "Posts", href: "/content/posts", icon: PenSquare },
  { name: "Schedule", href: "/content/schedule", icon: CalendarDays },
  { name: "Automation", href: "/content/automation", icon: Zap },
  { name: "Strategy", href: "/content/strategy", icon: Target },
];

// Marketing features
const marketingNavigation = [
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Email Marketing", href: "/email-marketing", icon: Mail },
  { name: "SMS Marketing", href: "/sms-marketing", icon: MessageSquare, premium: true },
];

const secondaryNavigation = [
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
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
        >
          <item.icon className="h-5 w-5 shrink-0" />
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
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-500 text-white"
            : "text-foreground hover:bg-accent"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
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
            className="fixed left-0 top-0 bottom-0 z-50 w-[85%] max-w-[320px] flex flex-col bg-card md:hidden"
          >
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4 border-b">
              <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
                <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-xl">FlowSmartly</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* User Info */}
            {user && (
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
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
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return renderNavItem(item, isActive);
              })}

              {/* Content Section */}
              <div className="pt-4">
                <div className="px-4 pb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Content
                  </span>
                </div>
                {contentNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return renderNavItem(item, isActive);
                })}
              </div>

              {/* Marketing Section */}
              <div className="pt-4">
                <div className="px-4 pb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Marketing
                  </span>
                </div>
                {marketingNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const isLocked = item.premium === true && !hasMarketingAccess;
                  return renderNavItem(item, isActive, isLocked);
                })}
              </div>
            </nav>

            {/* Secondary Navigation */}
            <div className="p-4 border-t space-y-1">
              {secondaryNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href.split("?")[0] + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <button
                className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Log out</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
