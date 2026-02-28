"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
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
  CreditCard,
  HelpCircle,
  X,
  Building2,
  Video,
  Palette,
  Target,
  Briefcase,
  MessageSquare,
  Clapperboard,
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

  // User menu
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Create menu
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

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
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      router.push(notification.actionUrl);
      setShowNotifications(false);
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "NEW_FOLLOWER":
        return "👤";
      case "POST_LIKED":
        return "❤️";
      case "POST_COMMENTED":
      case "COMMENT_REPLY":
        return "💬";
      case "CREDITS_PURCHASED":
        return "💳";
      case "CREDITS_LOW":
        return "⚠️";
      case "CAMPAIGN_SENT":
        return "📧";
      case "SMS_NUMBER_ACTIVATED":
        return "📱";
      case "ENGAGEMENT_MILESTONE":
        return "🔥";
      case "WELCOME":
        return "🎉";
      default:
        return "🔔";
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
        <div className="flex-1 max-w-xl hidden sm:block">
          <button className="flex items-center w-full gap-2 px-4 py-2 text-sm text-muted-foreground bg-muted/50 rounded-lg hover:bg-muted transition-colors">
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-background rounded border">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>
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

          {/* Create Button with Dropdown */}
          <div ref={createMenuRef} className="relative">
            <Button
              size="sm"
              className="hidden sm:flex"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>

            {showCreateMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg py-1 z-50">
                <Link
                  href="/studio"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => setShowCreateMenu(false)}
                >
                  <Palette className="h-4 w-4 text-violet-500" />
                  <div>
                    <div className="font-medium">Image Studio</div>
                    <div className="text-xs text-muted-foreground">AI image & design</div>
                  </div>
                </Link>
                <Link
                  href="/video-editor"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => setShowCreateMenu(false)}
                >
                  <Clapperboard className="h-4 w-4 text-rose-500" />
                  <div>
                    <div className="font-medium">Video Editor</div>
                    <div className="text-xs text-muted-foreground">AI video editor & captions</div>
                  </div>
                </Link>
                <Link
                  href="/feed?compose=true"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => setShowCreateMenu(false)}
                >
                  <Plus className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-medium">New Post</div>
                    <div className="text-xs text-muted-foreground">Share to feed</div>
                  </div>
                </Link>
                <Link
                  href="/ads/create"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => setShowCreateMenu(false)}
                >
                  <Plus className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="font-medium">Ad Campaign</div>
                    <div className="text-xs text-muted-foreground">Promote content</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

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
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors group",
                            !notification.read && "bg-brand-500/5"
                          )}
                        >
                          <span className="text-lg shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
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
                      ))}
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
