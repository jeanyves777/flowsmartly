"use client";

import { useState } from "react";
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
  ChevronLeft,
  ChevronDown,
  Megaphone,
  Crown,
  Lock,
  Palette,
  FolderOpen,
  Users,
  Globe,
  Video,
  PenSquare,
  CalendarDays,
  Zap,
  Target,
  Briefcase,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userPlan?: string;
  isAgent?: boolean;
}

// Plans that have access to marketing features
const MARKETING_PLANS = ["PRO", "BUSINESS", "ENTERPRISE", "ADMIN", "AGENT"];

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "FlowAI", href: "/flow-ai", icon: Sparkles },
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
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Help", href: "/help", icon: HelpCircle },
];

export function Sidebar({ isCollapsed, onToggle, userPlan = "FREE", isAgent = false }: SidebarProps) {
  const pathname = usePathname();
  const hasMarketingAccess = MARKETING_PLANS.includes(userPlan.toUpperCase());
  const isContentActive = pathname.startsWith("/content");
  const [contentOpen, setContentOpen] = useState(isContentActive);

  const renderNavItem = (
    item: { name: string; href: string; icon: React.ElementType; premium?: boolean },
    isActive: boolean,
    isLocked: boolean = false
  ) => {
    const content = (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
          isLocked
            ? "text-muted-foreground/50 cursor-not-allowed"
            : isActive
            ? "bg-brand-500 text-white"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1"
          >
            {item.name}
          </motion.span>
        )}
        {!isCollapsed && isLocked && (
          <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
        {!isCollapsed && item.premium && !isLocked && (
          <Crown className="h-3.5 w-3.5 text-amber-500" />
        )}
      </div>
    );

    if (isLocked) {
      return (
        <TooltipProvider key={item.name}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>{content}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px]">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Premium Feature</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade to Pro or higher to access {item.name}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link key={item.name} href={item.href}>
        {content}
      </Link>
    );
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.2 }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r bg-card"
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-3">
          {isCollapsed ? (
            <Image
              src="/icon.png"
              alt="FlowSmartly"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl shrink-0"
            />
          ) : (
            <Image
              src="/logo.png"
              alt="FlowSmartly"
              width={160}
              height={40}
              className="h-8 w-auto"
            />
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="shrink-0"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              isCollapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return renderNavItem(item, isActive);
        })}

        {/* Content Section (Collapsible) */}
        <div className="pt-4">
          {!isCollapsed ? (
            <button
              onClick={() => setContentOpen(!contentOpen)}
              className="w-full px-3 pb-2 flex items-center gap-2 group"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Content
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform",
                  contentOpen && "rotate-180"
                )}
              />
            </button>
          ) : (
            <div className="flex justify-center py-2">
              <PenSquare className={cn("h-4 w-4", isContentActive ? "text-brand-500" : "text-muted-foreground")} />
            </div>
          )}
          <AnimatePresence initial={false}>
            {(contentOpen || isCollapsed) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1">
                  {contentNavigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return renderNavItem(item, isActive);
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Marketing Section */}
        <div className="pt-4">
          {!isCollapsed && (
            <div className="px-3 pb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Marketing
              </span>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center py-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {marketingNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isLocked = item.premium === true && !hasMarketingAccess;
            return renderNavItem(item, isActive, isLocked);
          })}
        </div>

        {/* Agent Section — only shown for users with agent profiles */}
        {isAgent && (
          <div className="pt-4">
            {!isCollapsed && (
              <div className="px-3 pb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Agent
                </span>
              </div>
            )}
            {isCollapsed && (
              <div className="flex justify-center py-2">
                <Briefcase className={cn("h-4 w-4", pathname.startsWith("/agent") ? "text-brand-500" : "text-muted-foreground")} />
              </div>
            )}
            {renderNavItem(
              { name: "My Clients", href: "/agent/clients", icon: Briefcase },
              pathname.startsWith("/agent")
            )}
          </div>
        )}
      </nav>

      {/* Secondary Navigation */}
      <div className="p-4 border-t space-y-1">
        {secondaryNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {item.name}
                </motion.span>
              )}
            </Link>
          );
        })}

        <button
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={() => {
            // Handle logout
            fetch("/api/auth/logout", { method: "POST" }).then(() => {
              window.location.href = "/login";
            });
          }}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Log out
            </motion.span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
