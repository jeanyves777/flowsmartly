"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  Eye,
  Bell,
  ChevronLeft,
  ChevronRight,
  Search,
  Megaphone,
  DollarSign,
  Server,
  MousePointerClick,
  FolderOpen,
  Sun,
  Moon,
  User,
  Sparkles,
  Rss,
  Mail,
  MessageSquare,
  ShieldCheck,
  Coins,
  Menu,
  X,
  Phone,
  Briefcase,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
}

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/credits", icon: Coins, label: "Credits" },
  { href: "/admin/credit-pricing", icon: DollarSign, label: "Credit Pricing" },
  { href: "/admin/content", icon: FileText, label: "Content" },
  { href: "/admin/media", icon: FolderOpen, label: "Media" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/admin/visitors", icon: MousePointerClick, label: "Visitors" },
  { href: "/admin/audit", icon: Activity, label: "Audit Logs" },
  { href: "/admin/earnings", icon: DollarSign, label: "Earnings" },
  { href: "/admin/agents", icon: Briefcase, label: "Agents" },
  { href: "/admin/referrals", icon: Gift, label: "Referrals" },
  { href: "/admin/system", icon: Server, label: "System" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

// Marketing section
const marketingItems = [
  { href: "/admin/campaigns", icon: Megaphone, label: "Campaigns" },
  { href: "/admin/ads", icon: Megaphone, label: "Ad Review" },
  { href: "/admin/email-marketing", icon: Mail, label: "Email Marketing" },
  { href: "/admin/sms-marketing", icon: MessageSquare, label: "SMS Marketing" },
  { href: "/admin/sms-marketing/compliance", icon: ShieldCheck, label: "SMS Compliance" },
  { href: "/admin/sms-marketing/numbers", icon: Phone, label: "Number Status" },
];

// User experience menu - allows admins to test user interface
const userExperienceItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "User Dashboard" },
  { href: "/studio", icon: Sparkles, label: "AI Studio" },
  { href: "/feed", icon: Rss, label: "Feed" },
  { href: "/campaigns", icon: Megaphone, label: "User Campaigns" },
  { href: "/email-marketing", icon: Mail, label: "Email Marketing" },
  { href: "/sms-marketing", icon: MessageSquare, label: "SMS Marketing" },
  { href: "/ads", icon: Megaphone, label: "User Ads" },
  { href: "/analytics", icon: BarChart3, label: "User Analytics" },
  { href: "/earnings", icon: DollarSign, label: "User Earnings" },
  { href: "/referrals", icon: Gift, label: "User Referrals" },
  { href: "/settings", icon: Settings, label: "User Settings" },
];

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/auth/me");
        if (!response.ok) {
          router.push("/admin/login");
          return;
        }
        const data = await response.json();
        setAdmin(data.data.admin);
      } catch {
        router.push("/admin/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const renderNavItems = (items: typeof navItems, onItemClick?: () => void) => {
    return items.map((item) => {
      const isActive = pathname === item.href ||
        (item.href !== "/admin" && pathname.startsWith(item.href));
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onItemClick}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
            isActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          }`}
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      );
    });
  };

  const renderUserExperienceItems = (onItemClick?: () => void) => {
    return userExperienceItems.map((item) => {
      const isActive = pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href));
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onItemClick}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
            isActive
              ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-500 border border-purple-500/20"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          }`}
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      );
    });
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full hidden md:flex flex-col backdrop-blur-xl border-r border-border z-40 transition-all duration-300 bg-card/80 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo - Fixed at top */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          {!sidebarCollapsed && (
            <Link href="/admin" className="flex items-center gap-3">
              <Image
                src="/icon.png"
                alt="FlowSmartly"
                width={40}
                height={40}
                className="w-10 h-10 rounded-xl"
              />
              <div>
                <span className="font-bold text-lg">Admin</span>
                <p className="text-xs text-muted-foreground">Control Panel</p>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/admin">
              <Image
                src="/icon.png"
                alt="FlowSmartly"
                width={40}
                height={40}
                className="w-10 h-10 rounded-xl mx-auto"
              />
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-2 rounded-lg shrink-0 text-muted-foreground hover:bg-accent ${sidebarCollapsed ? "absolute right-2" : ""}`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Admin Section Header */}
          {!sidebarCollapsed && (
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Admin Panel
            </div>
          )}

          {sidebarCollapsed && (
            <div className="flex justify-center py-2">
              <Shield className="w-4 h-4 text-muted-foreground/70" />
            </div>
          )}

          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}

          {/* Marketing Section */}
          <div className="my-3 border-t border-border" />

          {!sidebarCollapsed && (
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Marketing
            </div>
          )}

          {sidebarCollapsed && (
            <div className="flex justify-center py-2">
              <Mail className="w-4 h-4 text-muted-foreground/70" />
            </div>
          )}

          {marketingItems.map((item) => {
            const isActive = pathname === item.href ||
              (pathname.startsWith(item.href + "/") && !marketingItems.some((other) => other.href !== item.href && pathname.startsWith(other.href)));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}

          {/* User Experience Section */}
          <div className="my-3 border-t border-border" />

          {!sidebarCollapsed && (
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              User Experience
            </div>
          )}

          {sidebarCollapsed && (
            <div className="flex justify-center py-2">
              <Eye className="w-4 h-4 text-muted-foreground/70" />
            </div>
          )}

          {userExperienceItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-500 border border-purple-500/20"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer - Fixed at bottom */}
        <div className="shrink-0 p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Mobile Panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[85%] max-w-[320px] flex flex-col bg-card md:hidden overflow-hidden"
            >
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
                <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                  <Image
                    src="/icon.png"
                    alt="FlowSmartly"
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-xl"
                  />
                  <div>
                    <span className="font-bold text-lg">Admin</span>
                    <p className="text-xs text-muted-foreground">Control Panel</p>
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Admin Info */}
              {admin && (
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500 text-white">
                        {admin.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{admin.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                      <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 font-medium">
                        {admin.isSuperAdmin ? "Super Admin" : admin.role}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Scrollable Navigation */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Admin Panel
                </div>
                {renderNavItems(navItems, () => setMobileMenuOpen(false))}

                <div className="my-3 border-t border-border" />
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Marketing
                </div>
                {renderNavItems(marketingItems, () => setMobileMenuOpen(false))}

                <div className="my-3 border-t border-border" />
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  User Experience
                </div>
                {renderUserExperienceItems(() => setMobileMenuOpen(false))}
              </nav>

              {/* Footer */}
              <div className="shrink-0 p-3 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 md:px-6 bg-card/80">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users, content, logs..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg text-sm bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {mounted && resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <Bell className="w-5 h-5" />
            </Button>

            {/* View site */}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hidden sm:flex"
              asChild
            >
              <Link href="/" target="_blank">
                <Eye className="w-4 h-4 mr-2" />
                View Site
              </Link>
            </Button>

            {/* User Dropdown */}
            {admin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500 text-white text-sm">
                        {admin.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{admin.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {admin.email}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {admin.isSuperAdmin ? "Super Admin" : admin.role}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link href="/admin/settings" className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link href="/admin/settings" className="flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
