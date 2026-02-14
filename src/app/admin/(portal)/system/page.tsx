"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Globe,
  Mail,
  Shield,
  Key,
  Code,
  Save,
  RefreshCw,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Lock,
  Zap,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types
interface SystemSettings {
  general: {
    siteName: string;
    siteUrl: string;
    supportEmail: string;
    timezone: string;
    maintenanceMode: boolean;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    fromEmail: string;
    fromName: string;
  };
  security: {
    maxLoginAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
    requireMfa: boolean;
    passwordMinLength: number;
    allowedDomains: string[];
  };
  api: {
    rateLimit: number;
    rateLimitWindow: number;
    enablePublicApi: boolean;
    apiKeys: { id: string; name: string; key: string; createdAt: string; lastUsed: string }[];
  };
  features: {
    enableRegistration: boolean;
    enableSocialAuth: boolean;
    enableAiStudio: boolean;
    enableCampaigns: boolean;
    enableAnalytics: boolean;
    enableBilling: boolean;
  };
  tracking: {
    enableTracking: boolean;
    trackingId: string;
    enableFingerprinting: boolean;
    enableGeoLocation: boolean;
    retentionDays: number;
  };
}

const defaultSettings: SystemSettings = {
  general: {
    siteName: "FlowSmartly",
    siteUrl: "https://flowsmartly.com",
    supportEmail: "info@flowsmartly.com",
    timezone: "America/New_York",
    maintenanceMode: false,
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpSecure: true,
    fromEmail: "",
    fromName: "FlowSmartly",
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    sessionTimeout: 1440,
    requireMfa: false,
    passwordMinLength: 8,
    allowedDomains: [],
  },
  api: {
    rateLimit: 100,
    rateLimitWindow: 60,
    enablePublicApi: true,
    apiKeys: [],
  },
  features: {
    enableRegistration: true,
    enableSocialAuth: true,
    enableAiStudio: true,
    enableCampaigns: true,
    enableAnalytics: true,
    enableBilling: true,
  },
  tracking: {
    enableTracking: true,
    trackingId: "",
    enableFingerprinting: true,
    enableGeoLocation: true,
    retentionDays: 365,
  },
};

const timezones = [
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch settings");
      }

      // Merge API response with default settings to ensure all properties exist
      const apiData = data.data || {};
      setSettings({
        general: { ...defaultSettings.general, ...apiData.general },
        email: { ...defaultSettings.email, ...apiData.email },
        security: { ...defaultSettings.security, ...apiData.security },
        api: { ...defaultSettings.api, ...apiData.api, apiKeys: apiData.api?.apiKeys || [] },
        features: { ...defaultSettings.features, ...apiData.features },
        tracking: { ...defaultSettings.tracking, ...apiData.tracking },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
      // Keep default settings on error so UI doesn't break
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeTab, settings: settings[activeTab as keyof SystemSettings] }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to save settings");
      }

      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const generateApiKey = async () => {
    setIsGeneratingKey(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_api_key", name: `API Key ${settings.api.apiKeys.length + 1}` }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate API key");
      }

      // Refresh settings to get new key
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_api_key", keyId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete API key");
      }

      // Refresh settings
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    }
  };

  const updateSetting = <T extends keyof SystemSettings>(
    category: T,
    key: keyof SystemSettings[T],
    value: SystemSettings[T][keyof SystemSettings[T]]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const Toggle = ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? "bg-orange-500" : "bg-gray-600"
      }`}
    >
      <motion.div
        initial={false}
        animate={{ x: enabled ? 20 : 2 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white"
      />
    </button>
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4 text-foreground">{error}</p>
          <Button onClick={() => fetchSettings()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Configure system-wide settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Saved successfully
            </Badge>
          )}
          {hasChanges && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              Unsaved changes
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-red-300">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="p-1 bg-muted border border-border">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Globe className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="api"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Key className="w-4 h-4 mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger
            value="features"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Zap className="w-4 h-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger
            value="tracking"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Code className="w-4 h-4 mr-2" />
            Tracking
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-500" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure basic site information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Site Name</Label>
                  <Input
                    value={settings.general.siteName}
                    onChange={(e) => updateSetting("general", "siteName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site URL</Label>
                  <Input
                    value={settings.general.siteUrl}
                    onChange={(e) => updateSetting("general", "siteUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={settings.general.supportEmail}
                    onChange={(e) => updateSetting("general", "supportEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <select
                    value={settings.general.timezone}
                    onChange={(e) => updateSetting("general", "timezone", e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 bg-background text-foreground"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">Maintenance Mode</h4>
                    <p className="text-sm text-muted-foreground">
                      When enabled, only admins can access the site
                    </p>
                  </div>
                  <Toggle
                    enabled={settings.general.maintenanceMode}
                    onChange={(value) => updateSetting("general", "maintenanceMode", value)}
                  />
                </div>
                {settings.general.maintenanceMode && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-300">
                      Maintenance mode is currently enabled. Regular users cannot access the
                      application.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-orange-500" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure SMTP settings for outbound emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={settings.email.smtpHost}
                    onChange={(e) => updateSetting("email", "smtpHost", e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    value={settings.email.smtpPort}
                    onChange={(e) => updateSetting("email", "smtpPort", parseInt(e.target.value) || 587)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Username</Label>
                  <Input
                    value={settings.email.smtpUser}
                    onChange={(e) => updateSetting("email", "smtpUser", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={settings.email.smtpPassword}
                      onChange={(e) => updateSetting("email", "smtpPassword", e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={settings.email.fromEmail}
                    onChange={(e) => updateSetting("email", "fromEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={settings.email.fromName}
                    onChange={(e) => updateSetting("email", "fromName", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <h4 className="font-medium text-foreground">Use TLS/SSL</h4>
                  <p className="text-sm text-muted-foreground">Enable secure connection</p>
                </div>
                <Toggle
                  enabled={settings.email.smtpSecure}
                  onChange={(value) => updateSetting("email", "smtpSecure", value)}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure authentication and security policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Max Login Attempts</Label>
                  <Input
                    type="number"
                    value={settings.security.maxLoginAttempts}
                    onChange={(e) =>
                      updateSetting("security", "maxLoginAttempts", parseInt(e.target.value) || 5)
                    }
                  />
                  <p className="text-xs text-muted-foreground">Before account lockout</p>
                </div>
                <div className="space-y-2">
                  <Label>Lockout Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.security.lockoutDuration}
                    onChange={(e) =>
                      updateSetting("security", "lockoutDuration", parseInt(e.target.value) || 30)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      updateSetting("security", "sessionTimeout", parseInt(e.target.value) || 1440)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Password Length</Label>
                  <Input
                    type="number"
                    value={settings.security.passwordMinLength}
                    onChange={(e) =>
                      updateSetting("security", "passwordMinLength", parseInt(e.target.value) || 8)
                    }
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">Require MFA for Admins</h4>
                    <p className="text-sm text-muted-foreground">
                      Force two-factor authentication for admin accounts
                    </p>
                  </div>
                  <Toggle
                    enabled={settings.security.requireMfa}
                    onChange={(value) => updateSetting("security", "requireMfa", value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-500" />
                API Configuration
              </CardTitle>
              <CardDescription>
                Manage API access and rate limiting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Rate Limit (requests)</Label>
                  <Input
                    type="number"
                    value={settings.api.rateLimit}
                    onChange={(e) => updateSetting("api", "rateLimit", parseInt(e.target.value) || 100)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit Window (seconds)</Label>
                  <Input
                    type="number"
                    value={settings.api.rateLimitWindow}
                    onChange={(e) =>
                      updateSetting("api", "rateLimitWindow", parseInt(e.target.value) || 60)
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <h4 className="font-medium text-foreground">Enable Public API</h4>
                  <p className="text-sm text-muted-foreground">Allow external API access</p>
                </div>
                <Toggle
                  enabled={settings.api.enablePublicApi}
                  onChange={(value) => updateSetting("api", "enablePublicApi", value)}
                />
              </div>

              {/* API Keys */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-foreground">API Keys</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateApiKey}
                    disabled={isGeneratingKey}
                  >
                    {isGeneratingKey ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Generate Key
                  </Button>
                </div>
                {settings.api.apiKeys.length === 0 ? (
                  <div className="p-8 text-center rounded-lg text-muted-foreground bg-muted">
                    No API keys generated yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settings.api.apiKeys.map((apiKey) => (
                      <div
                        key={apiKey.id}
                        className="flex items-center gap-4 p-4 rounded-lg bg-muted"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{apiKey.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-sm font-mono text-muted-foreground">
                              {showApiKeys[apiKey.id]
                                ? apiKey.key
                                : apiKey.key.replace(/./g, "\u2022").slice(0, 24) + "..."}
                            </code>
                            <button
                              onClick={() =>
                                setShowApiKeys((prev) => ({
                                  ...prev,
                                  [apiKey.id]: !prev[apiKey.id],
                                }))
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showApiKeys[apiKey.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(apiKey.key)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs mt-1 text-muted-foreground">
                            Created {apiKey.createdAt} {apiKey.lastUsed && `\u2022 Last used ${apiKey.lastUsed}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => deleteApiKey(apiKey.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                Feature Flags
              </CardTitle>
              <CardDescription>
                Enable or disable application features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "enableRegistration",
                  title: "User Registration",
                  description: "Allow new users to sign up",
                },
                {
                  key: "enableSocialAuth",
                  title: "Social Authentication",
                  description: "Allow login via Google, GitHub, etc.",
                },
                {
                  key: "enableAiStudio",
                  title: "AI Studio",
                  description: "AI-powered content generation features",
                },
                {
                  key: "enableCampaigns",
                  title: "Campaigns",
                  description: "Campaign management and scheduling",
                },
                {
                  key: "enableAnalytics",
                  title: "Analytics Dashboard",
                  description: "User analytics and reporting",
                },
                {
                  key: "enableBilling",
                  title: "Billing & Subscriptions",
                  description: "Payment processing and plans",
                },
              ].map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted"
                >
                  <div>
                    <h4 className="font-medium text-foreground">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  <Toggle
                    enabled={settings.features[feature.key as keyof typeof settings.features]}
                    onChange={(value) =>
                      updateSetting("features", feature.key as keyof typeof settings.features, value)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Settings */}
        <TabsContent value="tracking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-orange-500" />
                Tracking & Analytics
              </CardTitle>
              <CardDescription>
                Configure visitor tracking and data collection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">Enable Tracking</h4>
                  <p className="text-sm text-muted-foreground">Collect visitor analytics data</p>
                </div>
                <Toggle
                  enabled={settings.tracking.enableTracking}
                  onChange={(value) => updateSetting("tracking", "enableTracking", value)}
                />
              </div>

              {settings.tracking.enableTracking && (
                <>
                  <div className="p-4 rounded-lg bg-muted">
                    <Label className="mb-2 block">Tracking ID</Label>
                    <div className="flex gap-2">
                      <Input
                        value={settings.tracking.trackingId}
                        readOnly
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(settings.tracking.trackingId)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Tracking Script */}
                  <div className="p-4 rounded-lg bg-muted">
                    <Label className="mb-2 block">Tracking Script</Label>
                    <p className="text-sm mb-3 text-muted-foreground">
                      Add this script to your website to enable tracking:
                    </p>
                    <div className="relative">
                      <pre className="p-4 rounded-lg text-sm overflow-x-auto bg-gray-950 text-green-400">
                        {`<script src="${settings.general.siteUrl}/fs-analytics.js" data-id="${settings.tracking.trackingId}"></script>`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          copyToClipboard(
                            `<script src="${settings.general.siteUrl}/fs-analytics.js" data-id="${settings.tracking.trackingId}"></script>`
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                      <div>
                        <h4 className="font-medium text-foreground">Fingerprinting</h4>
                        <p className="text-sm text-muted-foreground">Browser fingerprint collection</p>
                      </div>
                      <Toggle
                        enabled={settings.tracking.enableFingerprinting}
                        onChange={(value) =>
                          updateSetting("tracking", "enableFingerprinting", value)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                      <div>
                        <h4 className="font-medium text-foreground">Geo Location</h4>
                        <p className="text-sm text-muted-foreground">IP-based location tracking</p>
                      </div>
                      <Toggle
                        enabled={settings.tracking.enableGeoLocation}
                        onChange={(value) =>
                          updateSetting("tracking", "enableGeoLocation", value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Retention (days)</Label>
                    <Input
                      type="number"
                      value={settings.tracking.retentionDays}
                      onChange={(e) =>
                        updateSetting("tracking", "retentionDays", parseInt(e.target.value) || 365)
                      }
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tracking data older than this will be automatically deleted
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Privacy Notice */}
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-300">Privacy Compliance</h3>
                  <p className="text-sm text-blue-300/80 mt-1">
                    Ensure your tracking configuration complies with GDPR, CCPA, and other privacy
                    regulations. Consider implementing cookie consent banners and providing opt-out
                    mechanisms for users.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
