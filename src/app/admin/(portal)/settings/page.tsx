"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Key,
  Smartphone,
  Megaphone,
  ExternalLink,
  RefreshCw,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  mfaEnabled: boolean;
  lastLogin: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [profile, setProfile] = useState<AdminProfile>({
    id: "",
    name: "",
    email: "",
    role: "",
    isSuperAdmin: false,
    mfaEnabled: false,
    lastLogin: "",
    createdAt: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    securityAlerts: true,
    weeklyReport: true,
    newUserAlerts: false,
    systemUpdates: true,
  });

  // Google Ads state
  const [googleAdsStatus, setGoogleAdsStatus] = useState<{
    connected: boolean;
    configured: boolean;
    authUrl?: string;
    customerId?: string;
    connectedAt?: string;
    missingCredentials?: string[];
  } | null>(null);
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/auth/me");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch profile");
      }

      setProfile({
        ...data.data.admin,
        lastLogin: new Date().toLocaleDateString(),
        createdAt: "2025-01-01",
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Fetch Google Ads connection status
  const fetchGoogleAdsStatus = useCallback(async () => {
    setGoogleAdsLoading(true);
    try {
      const res = await fetch("/api/admin/google-ads/auth");
      const data = await res.json();
      if (data.success) {
        setGoogleAdsStatus(data.data);
      }
    } catch {
      // Non-critical
    } finally {
      setGoogleAdsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "integrations") {
      fetchGoogleAdsStatus();
    }
  }, [activeTab, fetchGoogleAdsStatus]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsSaving(false);
    }
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
        enabled ? "bg-orange-500" : "bg-muted"
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        {saveSuccess && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Changes saved successfully
          </Badge>
        )}
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
            value="profile"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Full Name</Label>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email Address</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-500/20">
                        <Shield className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Role</p>
                        <p className="text-sm text-muted-foreground">
                          {profile.isSuperAdmin ? "Super Admin" : profile.role}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                        <Key className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Last Login</p>
                        <p className="text-sm text-muted-foreground">
                          {profile.lastLogin}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
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
                <Lock className="w-5 h-5 text-orange-500" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="pr-10 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="pr-10 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-start">
                <Button
                  onClick={handleChangePassword}
                  disabled={isSaving || !passwordForm.currentPassword || !passwordForm.newPassword}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-500" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {profile.mfaEnabled ? "2FA is enabled" : "2FA is disabled"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile.mfaEnabled
                      ? "Your account is protected with two-factor authentication"
                      : "Enable 2FA to add an extra layer of security"}
                  </p>
                </div>
                <Button
                  variant={profile.mfaEnabled ? "outline" : "default"}
                  className={profile.mfaEnabled
                    ? ""
                    : "bg-orange-500 hover:bg-orange-600 text-white"
                  }
                >
                  {profile.mfaEnabled ? "Disable 2FA" : "Enable 2FA"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Configure which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "emailAlerts",
                  title: "Email Alerts",
                  description: "Receive alerts for important account activity",
                  icon: Mail,
                },
                {
                  key: "securityAlerts",
                  title: "Security Alerts",
                  description: "Get notified about suspicious activity",
                  icon: Shield,
                },
                {
                  key: "weeklyReport",
                  title: "Weekly Report",
                  description: "Receive a weekly summary of platform activity",
                  icon: Mail,
                },
                {
                  key: "newUserAlerts",
                  title: "New User Alerts",
                  description: "Get notified when new users sign up",
                  icon: User,
                },
                {
                  key: "systemUpdates",
                  title: "System Updates",
                  description: "Receive notifications about system updates and maintenance",
                  icon: Bell,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-500/20">
                      <item.icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={notifications[item.key as keyof typeof notifications]}
                    onChange={(value) =>
                      setNotifications({ ...notifications, [item.key]: value })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Google Ads */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-blue-500" />
                    Google Ads
                  </CardTitle>
                  <CardDescription>
                    Connect your Google Ads account to push campaigns to Google&apos;s ad network
                  </CardDescription>
                </div>
                {googleAdsStatus?.connected ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Connected</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {googleAdsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking connection status...
                </div>
              ) : googleAdsStatus?.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Google Ads is connected and active</span>
                  </div>
                  {googleAdsStatus.customerId && (
                    <div className="text-sm text-muted-foreground">
                      Customer ID: <span className="font-mono">{googleAdsStatus.customerId}</span>
                    </div>
                  )}
                  {googleAdsStatus.connectedAt && (
                    <div className="text-sm text-muted-foreground">
                      Connected: {new Date(googleAdsStatus.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Approved ad campaigns will automatically be pushed to Google Ads.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {googleAdsStatus?.missingCredentials && googleAdsStatus.missingCredentials.length > 0 && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-600">Missing Credentials</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add these to your <code className="bg-muted px-1 rounded">.env</code> file:
                          </p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-0.5">
                            {googleAdsStatus.missingCredentials.map((cred) => (
                              <li key={cred} className="font-mono text-xs">{cred}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border p-4 space-y-3">
                    <h4 className="text-sm font-medium">Setup Instructions</h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>
                        Get OAuth Client Secret from{" "}
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
                          Google Cloud Console <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                      <li>
                        Get Developer Token from{" "}
                        <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
                          Google Ads API Center <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                      <li>
                        Get Customer ID from{" "}
                        <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
                          Google Ads Dashboard <ExternalLink className="w-3 h-3" />
                        </a>{" "}
                        (top-right corner)
                      </li>
                      <li>
                        Enable{" "}
                        <a href="https://console.cloud.google.com/apis/library/googleads.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
                          Google Ads API <ExternalLink className="w-3 h-3" />
                        </a>{" "}
                        in Cloud Console
                      </li>
                      <li>Add all credentials to <code className="bg-muted px-1 rounded">.env</code> and restart the server</li>
                    </ol>
                  </div>

                  {googleAdsStatus?.authUrl ? (
                    <Button
                      onClick={() => window.open(googleAdsStatus.authUrl, "_self")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Megaphone className="w-4 h-4 mr-2" />
                      Connect Google Ads Account
                    </Button>
                  ) : (
                    <Button disabled variant="outline">
                      <Megaphone className="w-4 h-4 mr-2" />
                      Add credentials first to connect
                    </Button>
                  )}
                </div>
              )}

              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchGoogleAdsStatus}
                  disabled={googleAdsLoading}
                >
                  <RefreshCw className={`w-3 h-3 mr-1.5 ${googleAdsLoading ? "animate-spin" : ""}`} />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Meta Ads - Coming Soon */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    Meta Ads
                  </CardTitle>
                  <CardDescription>Facebook & Instagram ad network integration</CardDescription>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
