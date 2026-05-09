"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BarChart3,
  Heart,
  Search,
  Moon,
  Sun,
  Plus,
  Command,
  Sparkles,
  User,
  Settings,
  LogOut,
  Check,
  CheckCheck,
  Trash2,
  Menu,
  LayoutDashboard,
  CreditCard,
  CalendarDays,
  HelpCircle,
  X,
  Building2,
  Video,
  Palette,
  Target,
  Rss,
  PenSquare,
  Briefcase,
  MessageSquare,
  Clapperboard,
  FolderOpen,
  Users,
  Globe,
  Megaphone,
  FileText,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { openCreateModal } from "@/components/shared/create-modal";
import {
  isExternalNotificationActionUrl,
  normalizeNotificationActionUrl,
} from "@/lib/navigation/notification-url";

interface HeaderProps {
  user?: {
    id?: string;
    name: string;
    email: string;
    username?: string;
    avatarUrl?: string | null;
    aiCredits?: number;
    plan?: string;
  };
  sidebarCollapsed: boolean;
  onMenuToggle?: () => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

interface SearchResult {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
  icon?: LucideIcon;
}

const GLOBAL_SEARCH_ITEMS: SearchResult[] = [
  { id: "dashboard", kind: "page", title: "Dashboard", subtitle: "Overview and quick status", href: "/dashboard", icon: LayoutDashboard },
  { id: "feed", kind: "page", title: "Feed", subtitle: "FlowSmartly internal social feed", href: "/feed", icon: Rss },
  { id: "posts", kind: "page", title: "Posts", subtitle: "Create, draft, publish, and schedule posts", href: "/content/posts", icon: PenSquare },
  { id: "schedule", kind: "page", title: "Schedule", subtitle: "Calendar and upcoming content", href: "/content/schedule", icon: CalendarDays },
  { id: "strategy", kind: "page", title: "Strategy & Automation", subtitle: "Strategy board, AI automation, reports", href: "/content/strategy", icon: Target },
  { id: "analytics", kind: "page", title: "Analytics", subtitle: "Connected platform and feed performance", href: "/analytics", icon: BarChart3 },
  { id: "studio", kind: "page", title: "Image Studio", subtitle: "AI design and editable creative workspace", href: "/studio", icon: Palette },
  { id: "media", kind: "page", title: "Media Library", subtitle: "Images, videos, uploads, generated assets", href: "/media", icon: FolderOpen },
  { id: "designs", kind: "page", title: "My Designs", subtitle: "Saved design projects", href: "/designs", icon: Clapperboard },
  { id: "contacts", kind: "page", title: "Contacts", subtitle: "Audience, email, SMS, and customer records", href: "/contacts", icon: Users },
  { id: "campaigns", kind: "page", title: "Campaigns", subtitle: "Marketing campaigns", href: "/campaigns", icon: Megaphone },
  { id: "email", kind: "page", title: "Email Marketing", subtitle: "Email campaigns and automations", href: "/email-marketing", icon: MessageSquare },
  { id: "ads", kind: "page", title: "Ads", subtitle: "Boosted posts and paid campaigns", href: "/ads", icon: Megaphone },
  { id: "landing", kind: "page", title: "Landing Pages", subtitle: "Lead pages and campaign pages", href: "/landing-pages", icon: Globe },
  { id: "websites", kind: "page", title: "Website Builder", subtitle: "Sites and pages", href: "/websites", icon: Globe },
  { id: "business-plan", kind: "page", title: "Business Plan", subtitle: "Plans, pitch, and strategy docs", href: "/tools/business-plan", icon: FileText },
  { id: "social-accounts", kind: "page", title: "Social Accounts", subtitle: "Connect Facebook, Instagram, X, LinkedIn, TikTok", href: "/social-accounts", icon: Link2 },
  { id: "settings", kind: "page", title: "Settings", subtitle: "Account, billing, notifications, integrations", href: "/settings", icon: Settings },
];

function getSearchIcon(kind: string, fallback?: LucideIcon) {
  if (fallback) return fallback;
  if (kind === "profile") return User;
  if (kind === "feed_post") return Rss;
  if (kind === "campaign") return Megaphone;
  if (kind === "contact") return Users;
  if (kind === "strategy" || kind === "task") return Target;
  return Search;
}

export function Header({ user, sidebarCollapsed, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Global search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // User menu
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Create menu (now uses global modal)

  // Strategy score
  const [strategyScore, setStrategyScore] = useState<number | null>(null);

  // Unread messages
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    setMounted(true);
    fetchNotificationCount();
    fetchStrategyScore();
    fetchUnreadMessages();

    // Poll for new notifications + score + messages every 30 seconds
    const interval = setInterval(() => {
      fetchNotificationCount();
      fetchStrategyScore();
      fetchUnreadMessages();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        setShowSearch(false);
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!showSearch || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (active && data.success) {
          setSearchResults(data.data.results || []);
        }
      } catch (error) {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, showSearch]);

  const fetchNotificationCount = async () => {
    try {
      const res = await fetch("/api/notifications?countOnly=true");
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch("/api/messages/unread-count");
      const data = await res.json();
      if (data.success) {
        setUnreadMessages(data.data.unreadCount);
      }
    } catch (error) {
      // Silently fail - messages may not be relevant for all users
    }
  };

  const fetchStrategyScore = async () => {
    try {
      const res = await fetch("/api/content/strategy/score");
      const data = await res.json();
      if (data.success && data.data.hasStrategy) {
        setStrategyScore(data.data.score);
      } else {
        setStrategyScore(null);
      }
    } catch {
      // Silently ignore score fetch errors
    }
  };

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: [notification.id] }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    // Navigate to action URL if present
    if (notification.actionUrl) {
      const targetUrl = normalizeNotificationActionUrl(notification.actionUrl);
      if (isExternalNotificationActionUrl(targetUrl)) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(targetUrl);
      }
      setShowNotifications(false);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const staticSearchResults = query
    ? GLOBAL_SEARCH_ITEMS.filter((item) =>
        `${item.title} ${item.subtitle}`.toLowerCase().includes(query)
      )
    : GLOBAL_SEARCH_ITEMS.slice(0, 7);
  const combinedSearchResults = [...staticSearchResults, ...searchResults]
    .filter((item, index, array) => array.findIndex((other) => other.href === item.href) === index)
    .slice(0, 10);

  const navigateSearchResult = (href: string) => {
    const targetUrl = normalizeNotificationActionUrl(href);
    if (isExternalNotificationActionUrl(targetUrl)) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } else {
      router.push(targetUrl);
    }
    setShowSearch(false);
    setSearchQuery("");
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const firstResult = combinedSearchResults[0];
    if (firstResult) {
      navigateSearchResult(firstResult.href);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?ids=${id}`, { method: "DELETE" });
      const wasUnread = notifications.find((n) => n.id === id)?.read === false;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

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

  const getNotificationIcon = (type: string): LucideIcon => {
    switch (type) {
      case "NEW_FOLLOWER":
        return User;
      case "POST_LIKED":
        return Heart;
      case "POST_COMMENTED":
      case "COMMENT_REPLY":
        return MessageSquare;
      case "CREDITS_PURCHASED":
        return CreditCard;
      case "CREDITS_LOW":
        return Bell;
      case "CAMPAIGN_SENT":
        return Megaphone;
      case "SMS_NUMBER_ACTIVATED":
        return MessageSquare;
      case "ENGAGEMENT_MILESTONE":
        return Sparkles;
      case "WELCOME":
        return Sparkles;
      default:
        return Bell;
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200",
        sidebarCollapsed ? "left-0 md:left-20" : "left-0 md:left-[280px]"
      )}
    >
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div ref={searchRef} className="relative flex items-center">
          <button
            type="button"
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </button>

          {showSearch && (
            <div className="fixed left-1/2 top-20 z-50 w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-2xl">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 border-b px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                  <Search className="h-5 w-5" />
                </span>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search pages, posts, campaigns, contacts..."
                  className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
                  <Command className="h-3 w-3" />K
                </kbd>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>
              <div className="max-h-[min(620px,calc(100vh-9rem))] overflow-y-auto p-3">
                {searchLoading && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                )}
                {!searchLoading && combinedSearchResults.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No matching pages or workspace records.
                  </div>
                )}
                {combinedSearchResults.map((result) => {
                  const Icon = getSearchIcon(result.kind, result.icon);
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => navigateSearchResult(result.href)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">{result.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">{result.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          {/* AI Credits Display */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/credits/history" className="hidden sm:flex">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 hover:border-violet-500/40 transition-colors">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-medium">
                    {user?.aiCredits !== undefined ? user.aiCredits.toLocaleString() : "---"}
                  </span>
                  <span className="text-xs text-muted-foreground hidden lg:inline">credits</span>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Credit History</TooltipContent>
          </Tooltip>

          {/* Strategy Score Badge */}
          {strategyScore !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/content/strategy/reports" className="hidden sm:flex">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors",
                    strategyScore >= 80
                      ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40"
                      : strategyScore >= 50
                      ? "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20 hover:border-yellow-500/40"
                      : "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/20 hover:border-red-500/40"
                  )}>
                    <Target className={cn("h-4 w-4",
                      strategyScore >= 80 ? "text-green-500" :
                      strategyScore >= 50 ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-sm font-medium">{strategyScore}<span className="text-muted-foreground font-normal">/100</span></span>
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Strategy Score</TooltipContent>
            </Tooltip>
          )}

          {/* Create Button — opens global XL creation modal */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="hidden sm:flex"
                onClick={() => openCreateModal()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open FlowCreative</TooltipContent>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {mounted && resolvedTheme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>

          {/* Messages */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => router.push("/messages")}
              >
                <MessageSquare className="h-5 w-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Messages</TooltipContent>
          </Tooltip>

          {/* Notifications */}
          <div ref={notificationRef} className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (!showNotifications) {
                      fetchNotifications();
                    }
                  }}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border bg-card shadow-lg z-50 max-h-[70vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {loadingNotifications ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-2" />
                      Loading...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => {
                        const NotificationIcon = getNotificationIcon(notification.type);
                        return (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors group",
                              !notification.read && "bg-brand-500/5"
                            )}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                              <NotificationIcon className="h-4 w-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-sm",
                                  !notification.read && "font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                <button
                                  onClick={(e) => handleDeleteNotification(notification.id, e)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-2" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t px-4 py-2">
                  <Link
                    href="/notifications"
                    className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                    onClick={() => setShowNotifications(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              className="flex items-center gap-2 sm:gap-3 p-1.5 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
                <AvatarFallback className="bg-brand-500 text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.plan || "Free"} Plan</p>
              </div>
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg py-1 z-50">
                <div className="px-4 py-3 border-b">
                  <p className="font-medium text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  {user?.username && (
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  )}
                </div>

                <div className="py-1">
                  <Link
                    href={`/profile/${user?.username || ""}`}
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="h-4 w-4" />
                    View Profile
                  </Link>
                  <Link
                    href="/brand"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Building2 className="h-4 w-4" />
                    Brand Identity
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <Link
                    href="/settings?tab=billing"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </Link>
                  <Link
                    href="/help"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Help & Support
                  </Link>
                  {user?.plan !== "AGENT" && (
                    <Link
                      href="/agent/apply"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Briefcase className="h-4 w-4" />
                      Become an Agent
                    </Link>
                  )}
                </div>

                <div className="border-t py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </TooltipProvider>
      </div>
    </header>
  );
}
