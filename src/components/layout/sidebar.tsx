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
  Gift,
  Wrench,
  ClipboardList,
  FileQuestion,
  MessageCircle,
  UsersRound,
  Scissors,
  FolderKanban,
  FormInput,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DelegationMode {
  active: boolean;
  projectName: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  allowedRoutes: string[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userPlan?: string;
  isAgent?: boolean;
  delegationMode?: DelegationMode | null;
  onExitDelegation?: () => void;
}

// Plans that have access to marketing features
const MARKETING_PLANS = ["PRO", "BUSINESS", "ENTERPRISE", "ADMIN", "AGENT"];

// Top-level (always visible, not in a group)
const topNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Feed", href: "/feed", icon: Rss },
];

// Content management
const contentNavigation = [
  { name: "Posts", href: "/content/posts", icon: PenSquare },
  { name: "Schedule", href: "/content/schedule", icon: CalendarDays },
  { name: "Automation", href: "/content/automation", icon: Zap },
  { name: "Strategy", href: "/content/strategy", icon: Target },
];

// AI Creatives
const aiCreativesNavigation = [
  { name: "Image Studio", href: "/studio", icon: Palette },
  { name: "Video Studio", href: "/video-studio", icon: Video },
  { name: "Logo Generator", href: "/logo-generator", icon: Crown },
  { name: "FlowAI", href: "/flow-ai", icon: Sparkles },
];

// Marketing features
const marketingNavigation = [
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Email Marketing", href: "/email-marketing", icon: Mail },
  { name: "SMS Marketing", href: "/sms-marketing", icon: MessageSquare, premium: true },
  { name: "Ads", href: "/ads", icon: Megaphone },
  { name: "Landing Pages", href: "/landing-pages", icon: Globe },
];

// Tools & Insights
const toolsNavigation = [
  { name: "Follow-Ups", href: "/tools/follow-ups", icon: ClipboardList },
  { name: "Data Collection", href: "/tools/data-collection", icon: FormInput },
  { name: "Surveys", href: "/tools/surveys", icon: FileQuestion },
  { name: "BG Remover", href: "/tools/background-remover", icon: Scissors },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Media Library", href: "/media", icon: FolderOpen },
];

// Money
const moneyNavigation = [
  { name: "Earnings", href: "/earnings", icon: DollarSign },
  { name: "Referrals", href: "/referrals", icon: Gift },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Help", href: "/help", icon: HelpCircle },
];

export function Sidebar({ isCollapsed, onToggle, userPlan = "FREE", isAgent = false, delegationMode, onExitDelegation }: SidebarProps) {
  const pathname = usePathname();
  const hasMarketingAccess = MARKETING_PLANS.includes(userPlan.toUpperCase());
  const isDelegating = delegationMode?.active === true;

  // In delegation mode, filter navigation items to only show allowed routes
  const filterByAllowed = (items: { name: string; href: string; icon: React.ElementType; premium?: boolean }[]) => {
    if (!isDelegating || !delegationMode?.allowedRoutes) return items;
    return items.filter((item) =>
      delegationMode.allowedRoutes.some((r) => item.href === r || item.href.startsWith(r + "/") || r.startsWith(item.href + "/") || r === item.href)
    );
  };
  const [contentOpen, setContentOpen] = useState(true);
  const [aiCreativesOpen, setAiCreativesOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [moneyOpen, setMoneyOpen] = useState(true);

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

  const renderCollapsibleSection = (
    label: string,
    Icon: React.ElementType,
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    isActive: boolean,
    items: { name: string; href: string; icon: React.ElementType; premium?: boolean }[],
    checkLocked: boolean = false
  ) => (
    <div className="pt-3">
      {!isCollapsed ? (
        <button
          onClick={() => setOpen(!isOpen)}
          className="w-full px-3 pb-2 flex items-center gap-2"
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      ) : (
        <div className="flex justify-center py-2">
          <Icon className={cn("h-4 w-4", isActive ? "text-brand-500" : "text-muted-foreground")} />
        </div>
      )}
      <AnimatePresence initial={false}>
        {(isOpen || isCollapsed) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const locked = checkLocked && item.premium === true && !hasMarketingAccess;
                return renderNavItem(item, active, locked);
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

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
        {/* Delegation mode: only show allowed sections */}
        {isDelegating ? (
          <>
            {/* Delegation banner in sidebar */}
            {!isCollapsed && (
              <div className="mb-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                  Working for {delegationMode.ownerName}
                </p>
                <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70 mt-0.5">
                  {delegationMode.projectName}
                </p>
                <button
                  onClick={onExitDelegation}
                  className="text-[10px] text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-200 underline mt-1"
                >
                  Exit delegation mode
                </button>
              </div>
            )}

            {/* My Projects always visible */}
            {renderNavItem(
              { name: "My Projects", href: "/projects", icon: FolderKanban },
              pathname === "/projects"
            )}

            {/* Filtered Content Section */}
            {filterByAllowed(contentNavigation).length > 0 &&
              renderCollapsibleSection("Content", PenSquare, contentOpen, setContentOpen, pathname.startsWith("/content"), filterByAllowed(contentNavigation))}

            {/* Filtered AI Creatives */}
            {filterByAllowed(aiCreativesNavigation).length > 0 &&
              renderCollapsibleSection("AI Creatives", Palette, aiCreativesOpen, setAiCreativesOpen, ["/studio", "/video-studio", "/logo-generator", "/flow-ai"].some(p => pathname.startsWith(p)), filterByAllowed(aiCreativesNavigation))}

            {/* Filtered Marketing */}
            {filterByAllowed(marketingNavigation).length > 0 &&
              renderCollapsibleSection("Marketing", Mail, marketingOpen, setMarketingOpen, ["/contacts", "/campaigns", "/email-marketing", "/sms-marketing", "/ads", "/landing-pages"].some(p => pathname.startsWith(p)), filterByAllowed(marketingNavigation))}

            {/* Filtered Tools */}
            {filterByAllowed(toolsNavigation).length > 0 &&
              renderCollapsibleSection("Tools & Insights", Wrench, toolsOpen, setToolsOpen, ["/tools", "/analytics", "/media"].some(p => pathname.startsWith(p)), filterByAllowed(toolsNavigation))}
          </>
        ) : (
          <>
            {/* Normal mode: full navigation */}
            {/* Dashboard + Feed (always visible) */}
            {topNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return renderNavItem(item, isActive);
            })}

            {/* My Projects — always visible for users with delegations */}
            {renderNavItem(
              { name: "My Projects", href: "/projects", icon: FolderKanban },
              pathname === "/projects"
            )}

            {/* Content Section */}
            {renderCollapsibleSection("Content", PenSquare, contentOpen, setContentOpen, pathname.startsWith("/content"), contentNavigation)}

            {/* AI Creatives Section */}
            {renderCollapsibleSection("AI Creatives", Palette, aiCreativesOpen, setAiCreativesOpen, ["/studio", "/video-studio", "/logo-generator", "/flow-ai"].some(p => pathname.startsWith(p)), aiCreativesNavigation)}

            {/* Marketing Section */}
            {renderCollapsibleSection("Marketing", Mail, marketingOpen, setMarketingOpen, ["/contacts", "/campaigns", "/email-marketing", "/sms-marketing", "/ads", "/landing-pages"].some(p => pathname.startsWith(p)), marketingNavigation, true)}

            {/* Tools & Insights Section */}
            {renderCollapsibleSection("Tools & Insights", Wrench, toolsOpen, setToolsOpen, ["/tools", "/analytics", "/media"].some(p => pathname.startsWith(p)), toolsNavigation)}

            {/* Money Section */}
            {renderCollapsibleSection("Money", DollarSign, moneyOpen, setMoneyOpen, ["/earnings", "/referrals"].some(p => pathname.startsWith(p)), moneyNavigation)}

            {/* Teams Section */}
            <div className="pt-3">
              {!isCollapsed && (
                <div className="px-3 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Teams
                  </span>
                </div>
              )}
              {isCollapsed && (
                <div className="flex justify-center py-2">
                  <UsersRound className={cn("h-4 w-4", pathname.startsWith("/teams") ? "text-brand-500" : "text-muted-foreground")} />
                </div>
              )}
              {renderNavItem(
                { name: "My Teams", href: "/teams", icon: UsersRound },
                pathname.startsWith("/teams")
              )}
            </div>

            {/* Agent / Marketplace Section */}
            {isAgent ? (
              <div className="pt-3">
                {!isCollapsed && (
                  <div className="px-3 pb-2">
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
                  { name: "My Profile", href: "/agent/profile", icon: Users },
                  pathname === "/agent/profile"
                )}
                {renderNavItem(
                  { name: "My Clients", href: "/agent/clients", icon: Briefcase },
                  pathname.startsWith("/agent/clients")
                )}
                {renderNavItem(
                  { name: "Messages", href: "/messages", icon: MessageCircle },
                  pathname.startsWith("/messages")
                )}
                {renderNavItem(
                  { name: "Marketplace", href: "/hire-agent", icon: Store },
                  pathname.startsWith("/hire-agent")
                )}
              </div>
            ) : (
              <div className="pt-3">
                {renderNavItem(
                  { name: "Messages", href: "/messages", icon: MessageCircle },
                  pathname.startsWith("/messages")
                )}
                {renderNavItem(
                  { name: "Hire Agent", href: "/hire-agent", icon: Store },
                  pathname.startsWith("/hire-agent")
                )}
              </div>
            )}
          </>
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
