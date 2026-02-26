"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Send, Settings, Zap, FileText, Image } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [whatsappAccounts, setWhatsappAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "automations" | "templates" | "status">("inbox");

  useEffect(() => {
    loadWhatsAppAccounts();
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const accounts = searchParams.get("accounts");
    const error = searchParams.get("error");

    if (success === "connected" && accounts) {
      // Refresh accounts after successful connection
      loadWhatsAppAccounts();
    }

    if (error) {
      alert(`Error: ${error}`);
    }
  }, [searchParams]);

  async function loadWhatsAppAccounts() {
    try {
      const response = await fetch("/api/social-accounts?platform=whatsapp");
      const data = await response.json();

      if (data.success) {
        setWhatsappAccounts(data.accounts);
        if (data.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0]);
        }
      }
    } catch (error) {
      console.error("Error loading WhatsApp accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    window.location.href = "/api/social/whatsapp/connect";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading WhatsApp...</p>
        </div>
      </div>
    );
  }

  // No WhatsApp accounts connected - show activation flow
  if (whatsappAccounts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <MessageSquare size={64} />
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">
              WhatsApp Business
            </h1>
            <p className="text-center text-green-100">
              Connect your WhatsApp Business account to manage conversations, automations, and more
            </p>
          </div>

          {/* Features */}
          <div className="p-8">
            <h2 className="text-xl font-semibold mb-6">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-start">
                <MessageSquare className="text-green-500 mr-3 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Inbox Management</h3>
                  <p className="text-sm text-gray-600">
                    Manage all your customer conversations in one place
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Zap className="text-green-500 mr-3 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Automations</h3>
                  <p className="text-sm text-gray-600">
                    Auto-reply to keywords and new conversations
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <FileText className="text-green-500 mr-3 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Templates</h3>
                  <p className="text-sm text-gray-600">
                    Create and manage message templates
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Image className="text-green-500 mr-3 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">WhatsApp Status</h3>
                  <p className="text-sm text-gray-600">
                    Post images and videos to your WhatsApp Status
                  </p>
                </div>
              </div>
            </div>

            {/* Connect Button */}
            <div className="text-center">
              <button
                onClick={handleConnect}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-semibold transition"
              >
                Connect WhatsApp Business
              </button>
              <p className="text-sm text-gray-500 mt-4">
                You'll be redirected to Facebook to authorize your WhatsApp Business account
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // WhatsApp accounts connected - show dashboard
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <MessageSquare className="text-green-500" size={32} />
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Business</h1>
              {selectedAccount && (
                <p className="text-sm text-gray-600">
                  {selectedAccount.platformDisplayName}
                </p>
              )}
            </div>
          </div>

          {/* Account Selector */}
          {whatsappAccounts.length > 1 && (
            <select
              value={selectedAccount?.id || ""}
              onChange={(e) => {
                const account = whatsappAccounts.find(
                  (a) => a.id === e.target.value
                );
                setSelectedAccount(account);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              {whatsappAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.platformDisplayName}
                </option>
              ))}
            </select>
          )}

          {/* Add Account Button */}
          <button
            onClick={handleConnect}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
          >
            + Add Account
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-6 mt-4">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
              activeTab === "inbox"
                ? "bg-green-100 text-green-700 font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <MessageSquare size={20} />
            <span>Inbox</span>
          </button>
          <button
            onClick={() => setActiveTab("automations")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
              activeTab === "automations"
                ? "bg-green-100 text-green-700 font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Zap size={20} />
            <span>Automations</span>
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
              activeTab === "templates"
                ? "bg-green-100 text-green-700 font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FileText size={20} />
            <span>Templates</span>
          </button>
          <button
            onClick={() => setActiveTab("status")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
              activeTab === "status"
                ? "bg-green-100 text-green-700 font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Image size={20} />
            <span>Status</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "inbox" && selectedAccount && (
          <WhatsAppInbox accountId={selectedAccount.id} />
        )}
        {activeTab === "automations" && selectedAccount && (
          <WhatsAppAutomations accountId={selectedAccount.id} />
        )}
        {activeTab === "templates" && selectedAccount && (
          <WhatsAppTemplates accountId={selectedAccount.id} />
        )}
        {activeTab === "status" && selectedAccount && (
          <WhatsAppStatus accountId={selectedAccount.id} />
        )}
      </div>
    </div>
  );
}

// Placeholder components - will be implemented
function WhatsAppInbox({ accountId }: { accountId: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <MessageSquare size={48} className="mx-auto mb-4 text-gray-400" />
        <p>Inbox view - Coming soon</p>
        <p className="text-sm mt-2">Account ID: {accountId}</p>
      </div>
    </div>
  );
}

function WhatsAppAutomations({ accountId }: { accountId: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <Zap size={48} className="mx-auto mb-4 text-gray-400" />
        <p>Automations builder - Coming soon</p>
        <p className="text-sm mt-2">Account ID: {accountId}</p>
      </div>
    </div>
  );
}

function WhatsAppTemplates({ accountId }: { accountId: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <FileText size={48} className="mx-auto mb-4 text-gray-400" />
        <p>Templates manager - Coming soon</p>
        <p className="text-sm mt-2">Account ID: {accountId}</p>
      </div>
    </div>
  );
}

function WhatsAppStatus({ accountId }: { accountId: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <Image size={48} className="mx-auto mb-4 text-gray-400" />
        <p>WhatsApp Status poster - Coming soon</p>
        <p className="text-sm mt-2">Account ID: {accountId}</p>
      </div>
    </div>
  );
}
