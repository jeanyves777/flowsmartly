"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Check,
  AlertTriangle,
  RefreshCw,
  Phone,
  Send,
  Settings,
  BarChart3,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketingStatus {
  email: {
    configured: boolean;
    verified: boolean;
    provider: string;
    sentThisMonth: number;
    monthlyLimit: number;
  };
  sms: {
    configured: boolean;
    phoneNumber: string | null;
    verified: boolean;
    sentThisMonth: number;
  };
}

export default function MarketingHubPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<MarketingStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch both email and SMS status
      const [emailRes, smsRes] = await Promise.all([
        fetch("/api/marketing-config"),
        fetch("/api/sms/numbers?action=current"),
      ]);

      const emailData = await emailRes.json();
      const smsData = await smsRes.json();

      const emailConfig = emailData.success ? emailData.data.config : null;
      const smsConfig = smsData.success ? smsData.data : null;

      setStatus({
        email: {
          configured: emailConfig?.emailProvider && emailConfig.emailProvider !== "NONE",
          verified: emailConfig?.emailVerified || false,
          provider: emailConfig?.emailProvider || "NONE",
          sentThisMonth: emailConfig?.emailSentThisMonth || 0,
          monthlyLimit: emailConfig?.emailMonthlyLimit || 0,
        },
        sms: {
          configured: smsConfig?.hasNumber || false,
          phoneNumber: smsConfig?.phoneNumber || null,
          verified: smsConfig?.verified || false,
          sentThisMonth: 0, // Would need to track
        },
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (error && !status) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchStatus} variant="outline">
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            Marketing Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your email and SMS marketing channels
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Channel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Marketing Card */}
            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>Email Marketing</CardTitle>
                      <CardDescription>Send email campaigns</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={status?.email.configured && status?.email.verified ? "default" : "secondary"}
                  >
                    {status?.email.configured && status?.email.verified ? (
                      <><Check className="w-3 h-3 mr-1" /> Active</>
                    ) : status?.email.configured ? (
                      "Needs Verification"
                    ) : (
                      "Not Configured"
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.email.configured ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-muted-foreground">Provider</p>
                        <p className="font-semibold">{status.email.provider}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-muted-foreground">Sent This Month</p>
                        <p className="font-semibold">{status.email.sentThisMonth.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min((status.email.sentThisMonth / status.email.monthlyLimit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {status.email.sentThisMonth.toLocaleString()} / {status.email.monthlyLimit.toLocaleString()} emails
                    </p>
                  </>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-muted-foreground mb-2">
                      Set up your email provider to start sending campaigns
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link href="/settings/email-marketing">
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Link>
                  </Button>
                  {status?.email.configured && (
                    <Button variant="outline" asChild>
                      <Link href="/email-marketing">
                        <Send className="w-4 h-4 mr-2" />
                        Campaigns
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SMS Marketing Card */}
            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>SMS Marketing</CardTitle>
                      <CardDescription>Send text campaigns</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={status?.sms.configured ? "default" : "secondary"}
                  >
                    {status?.sms.configured ? (
                      <><Check className="w-3 h-3 mr-1" /> Active</>
                    ) : (
                      "Not Configured"
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.sms.configured && status?.sms.phoneNumber ? (
                  <>
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Your Number</p>
                          <p className="font-mono font-semibold">{status.sms.phoneNumber}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-muted-foreground">SMS Cost</p>
                        <p className="font-semibold">$0.05/msg</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-muted-foreground">MMS Cost</p>
                        <p className="font-semibold">$0.10/msg</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center">
                    <Phone className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-2">
                      Rent a phone number to start sending SMS campaigns
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Starting at $5.00/month
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link href="/settings/sms-marketing">
                      {status?.sms.configured ? (
                        <><Settings className="w-4 h-4 mr-2" /> Manage</>
                      ) : (
                        <><Phone className="w-4 h-4 mr-2" /> Get Number</>
                      )}
                    </Link>
                  </Button>
                  {status?.sms.configured && (
                    <Button variant="outline" asChild>
                      <Link href="/sms-marketing">
                        <Send className="w-4 h-4 mr-2" />
                        Campaigns
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  href="/campaigns/create?type=email"
                  className="p-4 rounded-lg border hover:border-brand-500 hover:bg-brand-500/5 transition-all text-center group"
                >
                  <Mail className="w-6 h-6 mx-auto mb-2 text-blue-500 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium">New Email Campaign</p>
                </Link>
                <Link
                  href="/campaigns/create?type=sms"
                  className="p-4 rounded-lg border hover:border-brand-500 hover:bg-brand-500/5 transition-all text-center group"
                >
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 text-green-500 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium">New SMS Campaign</p>
                </Link>
                <Link
                  href="/campaigns"
                  className="p-4 rounded-lg border hover:border-brand-500 hover:bg-brand-500/5 transition-all text-center group"
                >
                  <BarChart3 className="w-6 h-6 mx-auto mb-2 text-purple-500 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium">View All Campaigns</p>
                </Link>
                <Link
                  href="/contact-lists"
                  className="p-4 rounded-lg border hover:border-brand-500 hover:bg-brand-500/5 transition-all text-center group"
                >
                  <Send className="w-6 h-6 mx-auto mb-2 text-orange-500 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium">Contact Lists</p>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
