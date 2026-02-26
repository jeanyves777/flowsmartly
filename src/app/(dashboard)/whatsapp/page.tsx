"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Zap,
  FileText,
  Image,
  Phone,
  Check,
  AlertCircle,
  Clock,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppInbox } from "@/components/whatsapp/whatsapp-inbox";
import { WhatsAppAutomations } from "@/components/whatsapp/whatsapp-automations";
import { WhatsAppTemplates } from "@/components/whatsapp/whatsapp-templates";
import { WhatsAppStatus } from "@/components/whatsapp/whatsapp-status";
import type { WhatsAppAccount } from "@/components/whatsapp/types";

export default function WhatsAppPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading WhatsApp...</p>
        </div>
      </div>
    }>
      <WhatsAppPageContent />
    </Suspense>
  );
}

function WhatsAppPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "automations" | "templates" | "status">("inbox");
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  useEffect(() => {
    loadWhatsAppAccounts();
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "whatsapp_connected") {
      toast({ title: "WhatsApp Connected!", description: "Your WhatsApp Business account has been connected successfully." });
      loadWhatsAppAccounts();
      router.replace("/whatsapp");
    } else if (success === "whatsapp_reconnected") {
      toast({ title: "Account Updated!", description: "Your WhatsApp Business account token has been refreshed." });
      loadWhatsAppAccounts();
      router.replace("/whatsapp");
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        whatsapp_auth_failed: "WhatsApp authorization was denied. Please try again.",
        no_phone_numbers: "No WhatsApp Business phone numbers found on your account.",
        connect_failed: "Something went wrong connecting WhatsApp. Please try again.",
        missing_params: "Connection was interrupted. Please try again.",
      };
      toast({
        title: "Connection Issue",
        description: errorMessages[error] || "An unexpected error occurred.",
        variant: "destructive",
      });
      router.replace("/whatsapp");
    }
  }, [searchParams, toast, router]);

  async function loadWhatsAppAccounts() {
    try {
      const response = await fetch("/api/social-accounts?platform=whatsapp");
      const data = await response.json();

      if (data.success) {
        setWhatsappAccounts(data.accounts || []);
        if (data.accounts?.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0]);
        }
      }
    } catch (error) {
      console.error("Error loading WhatsApp accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  function goToSocialAccounts() {
    router.push("/social-accounts");
  }

  function getTokenStatus(account: WhatsAppAccount) {
    if (!account.tokenExpiresAt) {
      return { label: "Active", color: "text-green-500", variant: "default" as const };
    }
    const daysLeft = Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", color: "text-red-500", variant: "destructive" as const };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft}d`, color: "text-yellow-500", variant: "secondary" as const };
    return { label: `Expires in ${daysLeft}d`, color: "text-green-500", variant: "default" as const };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading WhatsApp...</p>
        </div>
      </div>
    );
  }

  // No accounts connected
  if (whatsappAccounts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <MessageSquare size={64} />
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">WhatsApp Business</h1>
            <p className="text-center text-green-100">
              Connect your WhatsApp Business account to manage conversations, automations, and more
            </p>
          </div>

          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-6">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-start">
                <MessageSquare className="text-green-500 mr-3 mt-1 shrink-0" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Inbox Management</h3>
                  <p className="text-sm text-muted-foreground">Manage all your customer conversations in one place</p>
                </div>
              </div>
              <div className="flex items-start">
                <Zap className="text-green-500 mr-3 mt-1 shrink-0" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Automations</h3>
                  <p className="text-sm text-muted-foreground">Auto-reply to keywords and new conversations</p>
                </div>
              </div>
              <div className="flex items-start">
                <FileText className="text-green-500 mr-3 mt-1 shrink-0" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Templates</h3>
                  <p className="text-sm text-muted-foreground">Create and manage message templates</p>
                </div>
              </div>
              <div className="flex items-start">
                <Image className="text-green-500 mr-3 mt-1 shrink-0" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">WhatsApp Status</h3>
                  <p className="text-sm text-muted-foreground">Post images and videos to your WhatsApp Status</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button size="lg" onClick={goToSocialAccounts}>
                <Plus className="w-4 h-4 mr-2" />
                Connect WhatsApp Business
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                You&apos;ll be taken to Social Accounts to connect your WhatsApp Business account
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accounts connected - show dashboard
  const tabs = [
    { id: "inbox" as const, label: "Inbox", icon: MessageSquare },
    { id: "automations" as const, label: "Automations", icon: Zap },
    { id: "templates" as const, label: "Templates", icon: FileText },
    { id: "status" as const, label: "Status", icon: Image },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">WhatsApp Business</h1>
            <p className="text-sm text-muted-foreground">
              {whatsappAccounts.length} account{whatsappAccounts.length > 1 ? "s" : ""} connected
            </p>
          </div>
        </div>
        <Button variant="outline" size="default" onClick={goToSocialAccounts}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {whatsappAccounts.map((account) => {
          const tokenStatus = getTokenStatus(account);
          const isSelected = selectedAccount?.id === account.id;

          return (
            <Card
              key={account.id}
              className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-green-500 border-green-500" : "hover:border-green-500/50"}`}
              onClick={() => setSelectedAccount(account)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{account.platformDisplayName}</p>
                      <p className="text-xs text-muted-foreground">{account.platformUsername}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge className="bg-green-500 text-white">Active</Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span>Connected {formatDate(account.connectedAt)}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${tokenStatus.color}`}>
                    {tokenStatus.label === "Expired" ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>Token: {tokenStatus.label}</span>
                  </div>
                </div>

                {tokenStatus.label === "Expired" && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-green-600 border-green-500/50 hover:bg-green-500/10"
                      onClick={goToSocialAccounts}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reconnect to Refresh Token
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Account Selector (if multiple) */}
      {whatsappAccounts.length > 1 && selectedAccount && (
        <p className="text-sm text-muted-foreground">
          Viewing: <span className="font-medium text-foreground">{selectedAccount.platformDisplayName}</span>
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-green-500 text-green-600 bg-green-500/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {selectedAccount && (
          <>
            {activeTab === "inbox" && <WhatsAppInbox account={selectedAccount} />}
            {activeTab === "automations" && <WhatsAppAutomations account={selectedAccount} />}
            {activeTab === "templates" && <WhatsAppTemplates account={selectedAccount} />}
            {activeTab === "status" && <WhatsAppStatus account={selectedAccount} />}
          </>
        )}
      </div>

      {/* Reconnect Modal */}
      {showReconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-md w-full mx-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  Add WhatsApp Account
                </CardTitle>
                <button
                  onClick={() => setShowReconnectModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You already have {whatsappAccounts.length} WhatsApp account{whatsappAccounts.length > 1 ? "s" : ""} connected.
              </p>
              <div className="rounded-lg border p-3 bg-muted/30">
                {whatsappAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-2 py-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{acc.platformDisplayName}</span>
                    <span className="text-xs text-muted-foreground">({acc.platformUsername})</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Connecting again will update your existing account&apos;s token or add any new phone numbers found on your WhatsApp Business account.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowReconnectModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={goToSocialAccounts}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

