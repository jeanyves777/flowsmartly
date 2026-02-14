"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Server,
  Key,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Save,
  TestTube2,
  Send,
  BarChart3,
  Settings,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type EmailProvider = "NONE" | "GMAIL" | "SMTP" | "SENDGRID" | "MAILGUN" | "AMAZON_SES" | "RESEND";

interface MarketingConfig {
  id: string;
  emailProvider: EmailProvider;
  emailConfig: Record<string, unknown>;
  emailVerified: boolean;
  emailEnabled: boolean;
  emailPricePerSend: number;
  emailMonthlyLimit: number;
  emailSentThisMonth: number;
  defaultFromName: string | null;
  defaultFromEmail: string | null;
  defaultReplyTo: string | null;
  usageResetDate: string;
}

const EMAIL_PROVIDERS = [
  { id: "NONE", name: "Not configured", description: "Select an email provider", icon: "?" },
  { id: "GMAIL", name: "Gmail", description: "Google Gmail SMTP", icon: "G" },
  { id: "SMTP", name: "SMTP", description: "Custom SMTP server", icon: "S" },
  { id: "SENDGRID", name: "SendGrid", description: "SendGrid email API", icon: "SG" },
  { id: "MAILGUN", name: "Mailgun", description: "Mailgun email API", icon: "MG" },
  { id: "AMAZON_SES", name: "Amazon SES", description: "AWS Simple Email Service", icon: "AWS" },
  { id: "RESEND", name: "Resend", description: "Resend email API", icon: "R" },
];

export default function EmailMarketingSettingsPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MarketingConfig | null>(null);

  // Email form state
  const [emailProvider, setEmailProvider] = useState<EmailProvider>("NONE");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [domain, setDomain] = useState("");
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testEmail, setTestEmail] = useState("");

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/marketing-config");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch config");
      }

      const cfg = data.data.config;
      setConfig(cfg);

      // Set form state from config
      setEmailProvider(cfg.emailProvider);
      setFromName(cfg.defaultFromName || "");
      setFromEmail(cfg.defaultFromEmail || "");
      setReplyTo(cfg.defaultReplyTo || "");

      // Set provider-specific config
      if (cfg.emailConfig) {
        if (cfg.emailProvider === "SMTP" && (cfg.emailConfig.gmail || String(cfg.emailConfig.host || "").includes("gmail"))) {
          // Detect Gmail SMTP and show as Gmail provider
          setEmailProvider("GMAIL");
          setSmtpUser(cfg.emailConfig.user || "");
          setSmtpPassword(cfg.emailConfig.password || "");
        } else if (cfg.emailProvider === "SMTP") {
          setSmtpHost(cfg.emailConfig.host || "");
          setSmtpPort(cfg.emailConfig.port?.toString() || "587");
          setSmtpUser(cfg.emailConfig.user || "");
          setSmtpPassword(cfg.emailConfig.password || "");
          setSmtpSecure(cfg.emailConfig.secure !== false);
        } else if (["SENDGRID", "MAILGUN", "RESEND"].includes(cfg.emailProvider)) {
          setApiKey(cfg.emailConfig.apiKey || "");
          if (cfg.emailProvider === "MAILGUN") {
            setDomain(cfg.emailConfig.domain || "");
          }
        } else if (cfg.emailProvider === "AMAZON_SES") {
          setAwsAccessKey(cfg.emailConfig.accessKeyId || "");
          setAwsSecretKey(cfg.emailConfig.secretAccessKey || "");
          setAwsRegion(cfg.emailConfig.region || "us-east-1");
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save email config
  const handleSaveEmail = async () => {
    setIsSaving(true);
    try {
      let emailConfig: Record<string, unknown> = {};

      switch (emailProvider) {
        case "GMAIL":
          emailConfig = {
            host: "smtp.gmail.com",
            port: 587,
            user: smtpUser,
            password: smtpPassword,
            secure: false,
          };
          break;
        case "SMTP":
          emailConfig = {
            host: smtpHost,
            port: parseInt(smtpPort),
            user: smtpUser,
            password: smtpPassword,
            secure: smtpSecure,
          };
          break;
        case "SENDGRID":
        case "RESEND":
          emailConfig = { apiKey };
          break;
        case "MAILGUN":
          emailConfig = { apiKey, domain };
          break;
        case "AMAZON_SES":
          emailConfig = {
            accessKeyId: awsAccessKey,
            secretAccessKey: awsSecretKey,
            region: awsRegion,
          };
          break;
      }

      // Gmail is stored as SMTP on the backend
      const providerToSave = emailProvider === "GMAIL" ? "SMTP" : emailProvider;

      const response = await fetch("/api/marketing-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailProvider: providerToSave,
          emailConfig: emailProvider === "GMAIL" ? { ...emailConfig, gmail: true } : emailConfig,
          emailEnabled: emailProvider !== "NONE",
          defaultFromName: fromName,
          defaultFromEmail: fromEmail || (emailProvider === "GMAIL" ? smtpUser : ""),
          defaultReplyTo: replyTo,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to save config");
      }

      toast({ title: "Email settings saved successfully!" });
      fetchConfig();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test email
  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({ title: "Please enter a test email address", variant: "destructive" });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch("/api/marketing-config/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to send test email");
      }

      toast({ title: "Test email sent successfully!" });
      fetchConfig();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (error && !config) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchConfig} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              Email Marketing Settings
            </h1>
            <p className="text-muted-foreground">
              Configure your email service provider for campaigns
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/email-marketing">
            <Send className="w-4 h-4 mr-2" />
            View Campaigns
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      {!isLoading && config && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={config.emailVerified ? "default" : "secondary"} className="mt-1">
                    {config.emailVerified ? "Verified" : "Not Verified"}
                  </Badge>
                </div>
                <div className={`w-10 h-10 rounded-lg ${config.emailVerified ? "bg-green-500/10" : "bg-yellow-500/10"} flex items-center justify-center`}>
                  {config.emailVerified ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="text-lg font-semibold mt-1">
                    {EMAIL_PROVIDERS.find(p => p.id === config.emailProvider)?.name || "None"}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Emails Sent</p>
                  <p className="text-lg font-semibold mt-1">
                    {config.emailSentThisMonth.toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Limit</p>
                  <p className="text-lg font-semibold mt-1">
                    {config.emailMonthlyLimit.toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Email Provider
              </CardTitle>
              <CardDescription>
                Select and configure your email service provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {EMAIL_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setEmailProvider(provider.id as EmailProvider)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      emailProvider === provider.id
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border hover:border-brand-500/50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2 text-xs font-bold">
                      {provider.icon}
                    </div>
                    <div className="font-semibold text-sm">{provider.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {provider.description}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Provider Configuration */}
          {emailProvider !== "NONE" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  {EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.name} Configuration
                </CardTitle>
                <CardDescription>
                  Enter your {EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.name} credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailProvider === "GMAIL" && (
                  <>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 mb-4">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Gmail requires an App Password (not your regular password)
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Go to{" "}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium"
                        >
                          Google App Passwords
                        </a>
                        {" "}to generate one. You must have 2-Step Verification enabled.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Gmail Address</Label>
                        <Input
                          type="email"
                          placeholder="you@gmail.com"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>App Password</Label>
                        <Input
                          type="password"
                          placeholder="xxxx xxxx xxxx xxxx"
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {emailProvider === "SMTP" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Host</Label>
                        <Input
                          placeholder="smtp.example.com"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Port</Label>
                        <Select value={smtpPort} onValueChange={setSmtpPort}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25 (Plain)</SelectItem>
                            <SelectItem value="465">465 (SSL)</SelectItem>
                            <SelectItem value="587">587 (TLS - Recommended)</SelectItem>
                            <SelectItem value="2525">2525 (Alternative)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          placeholder="your-username"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtpSecure"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="smtpSecure" className="text-sm cursor-pointer">
                        Use secure connection (TLS/SSL)
                      </Label>
                    </div>
                  </>
                )}

                {(emailProvider === "SENDGRID" || emailProvider === "RESEND") && (
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder="Enter your API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {emailProvider === "SENDGRID" ? (
                        <>Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">SendGrid Dashboard</a></>
                      ) : (
                        <>Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">Resend Dashboard</a></>
                      )}
                    </p>
                  </div>
                )}

                {emailProvider === "MAILGUN" && (
                  <>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Domain</Label>
                      <Input
                        placeholder="mg.yourdomain.com"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your verified Mailgun sending domain
                      </p>
                    </div>
                  </>
                )}

                {emailProvider === "AMAZON_SES" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Access Key ID</Label>
                        <Input
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          value={awsAccessKey}
                          onChange={(e) => setAwsAccessKey(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Secret Access Key</Label>
                        <Input
                          type="password"
                          placeholder="Enter secret key"
                          value={awsSecretKey}
                          onChange={(e) => setAwsSecretKey(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Select value={awsRegion} onValueChange={setAwsRegion}>
                        <SelectTrigger className="max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                          <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                          <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                          <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                          <SelectItem value="eu-central-1">Europe (Frankfurt)</SelectItem>
                          <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                          <SelectItem value="ap-northeast-1">Asia Pacific (Tokyo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sender Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Sender Defaults
              </CardTitle>
              <CardDescription>
                Default values for your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    placeholder="Your Business Name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    placeholder="hello@yourdomain.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reply-To Email</Label>
                <Input
                  type="email"
                  placeholder="support@yourdomain.com"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Where replies to your campaigns will be sent
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Test & Save */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube2 className="w-5 h-5" />
                Test Configuration
              </CardTitle>
              <CardDescription>
                Send a test email to verify your settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                  <Input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestEmail}
                    disabled={isTesting || emailProvider === "NONE"}
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><TestTube2 className="w-4 h-4 mr-2" /> Send Test</>
                    )}
                  </Button>
                </div>
                <Button onClick={handleSaveEmail} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Links */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Need help setting up?</h3>
                  <p className="text-sm text-muted-foreground">
                    Check out our guides for configuring email providers
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://docs.flowsmartly.com/email-setup" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Docs
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
