"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { cn } from "@/lib/utils/cn";
import { ChatWidget } from "@/components/ai-assistant/chat-widget";
import { ShieldCheck } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  plan: string;
  aiCredits: number;
  balanceCents: number;
  emailVerified: boolean;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgentImpersonating, setIsAgentImpersonating] = useState(false);
  const [hasAgentProfile, setHasAgentProfile] = useState(false);
  const [agentInfo, setAgentInfo] = useState<{ agentName: string; agentId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First, try to get regular user session
        const userResponse = await fetch("/api/auth/me");
        const userData = await userResponse.json();

        if (userData.success && userData.data?.user) {
          setUser(userData.data.user);
          if (userData.data.isImpersonating && userData.data.agentInfo) {
            setIsAgentImpersonating(true);
            setAgentInfo(userData.data.agentInfo);
          }
          // Check if user has an approved agent profile (for sidebar nav)
          try {
            const agentRes = await fetch("/api/agent/profile");
            const agentData = await agentRes.json();
            if (agentData.success && agentData.data?.profile?.status === "APPROVED") {
              setHasAgentProfile(true);
            }
          } catch {}
          setIsLoading(false);
          return;
        }

        // If no user session, check for admin session
        const adminResponse = await fetch("/api/admin/auth/me");
        const adminData = await adminResponse.json();

        if (adminData.data?.admin) {
          const admin: AdminUser = adminData.data.admin;
          // Create a user object from admin data for display purposes
          setUser({
            id: admin.id,
            name: admin.name,
            email: admin.email,
            username: admin.email.split("@")[0],
            avatarUrl: null,
            plan: "ADMIN",
            aiCredits: 9999,
            balanceCents: 0,
            emailVerified: true,
          });
          setIsAdmin(true);
          setIsLoading(false);
          return;
        }

        // No valid session found, redirect to login
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      } catch {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center animate-pulse">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const exitImpersonation = async () => {
    try {
      await fetch("/api/agent/impersonate", { method: "DELETE" });
      window.location.href = "/agent/clients";
    } catch {
      window.location.href = "/agent/clients";
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Admin Preview Banner */}
      {isAdmin && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white text-center py-2 text-sm font-medium">
          <span>Admin Preview Mode</span>
          <span className="mx-2">•</span>
          <a href="/admin" className="underline hover:no-underline">
            Return to Admin Panel
          </a>
        </div>
      )}

      {/* Agent Impersonation Banner */}
      {isAgentImpersonating && agentInfo && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-violet-600 to-brand-500 text-white text-center py-2 text-sm font-medium">
          <ShieldCheck className="inline w-4 h-4 mr-1 -mt-0.5" />
          <span>Agent Mode — Working as {user?.name}</span>
          <span className="mx-2">|</span>
          <span className="opacity-80">Agent: {agentInfo.agentName}</span>
          <span className="mx-2">|</span>
          <button onClick={exitImpersonation} className="underline hover:no-underline">
            Exit Agent Mode
          </button>
        </div>
      )}

      <div className={isAdmin || isAgentImpersonating ? "pt-10" : ""}>
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            userPlan={user.plan}
            isAgent={hasAgentProfile}
          />
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          userPlan={user.plan}
          user={user}
        />

        {/* Header */}
        <Header
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Main Content */}
        <main
          className={cn(
            "pt-16 min-h-screen transition-all duration-200",
            // Desktop: respect sidebar state
            "md:pl-20",
            !sidebarCollapsed && "md:pl-[280px]"
          )}
        >
          <div className="p-4 md:p-6">
            {user && !user.emailVerified && <EmailVerificationBanner />}
            {children}
          </div>
        </main>

        {/* FlowAI Chat Assistant */}
        <ChatWidget />
      </div>
    </div>
  );
}
