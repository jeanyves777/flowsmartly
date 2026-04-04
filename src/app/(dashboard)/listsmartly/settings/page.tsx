"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  Save,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Trash2,
  CreditCard,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface ProfileData {
  businessName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  industry: string;
  description: string;
  hoursMonFri: string;
  hoursSat: string;
  hoursSun: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialLinkedin: string;
}

interface SubscriptionData {
  plan: "basic" | "pro";
  status: "trialing" | "active" | "canceled" | "past_due";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

const INDUSTRIES = [
  "Tax & Accounting",
  "Dental",
  "Legal",
  "Restaurant",
  "Real Estate",
  "Health & Wellness",
  "Auto Services",
  "Home Services",
  "Retail",
  "Technology",
  "Education",
  "Other",
];

// ── Component ──

export default function ListSmartlySettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    businessName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    industry: "",
    description: "",
    hoursMonFri: "",
    hoursSat: "",
    hoursSun: "",
    socialFacebook: "",
    socialInstagram: "",
    socialTwitter: "",
    socialLinkedin: "",
  });

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  // ── Data Fetching ──

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/listsmartly/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile({
        businessName: data.businessName || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
        country: data.country || "US",
        industry: data.industry || "",
        description: data.description || "",
        hoursMonFri: data.hoursMonFri || "",
        hoursSat: data.hoursSat || "",
        hoursSun: data.hoursSun || "",
        socialFacebook: data.socialFacebook || "",
        socialInstagram: data.socialInstagram || "",
        socialTwitter: data.socialTwitter || "",
        socialLinkedin: data.socialLinkedin || "",
      });
    } catch {
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    }
  }, [toast]);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/listsmartly/subscription");
      if (!res.ok) return;
      const data = await res.json();
      setSubscription(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchSubscription()]);
      setLoading(false);
    }
    init();
  }, [fetchProfile, fetchSubscription]);

  // ── Handlers ──

  function updateField(field: keyof ProfileData, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/listsmartly/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      toast({ title: "Saved", description: "Profile updated successfully." });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncBrand() {
    setSyncing(true);
    try {
      const res = await fetch("/api/brand");
      if (!res.ok) throw new Error("Failed to fetch brand kit");
      const data = await res.json();
      setProfile((prev) => ({
        ...prev,
        businessName: data.businessName || data.name || prev.businessName,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
        website: data.website || prev.website,
        address: data.address || prev.address,
        city: data.city || prev.city,
        state: data.state || prev.state,
        zip: data.zip || prev.zip,
        country: data.country || prev.country,
      }));
      toast({ title: "Synced", description: "Profile updated from Brand Kit. Remember to save." });
    } catch {
      toast({ title: "Error", description: "Failed to sync from Brand Kit", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handlePlanChange(newPlan: "basic" | "pro") {
    try {
      const res = await fetch("/api/listsmartly/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to change plan");
      }
      const data = await res.json();
      setSubscription(data);
      toast({ title: "Plan updated", description: `Switched to ${newPlan === "pro" ? "Pro" : "Basic"} plan.` });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to change plan",
        variant: "destructive",
      });
    }
  }

  async function handleCancel() {
    try {
      const res = await fetch("/api/listsmartly/subscription", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel");
      setSubscription((prev) => prev ? { ...prev, status: "canceled" } : null);
      toast({ title: "Canceled", description: "Your subscription has been canceled." });
    } catch {
      toast({ title: "Error", description: "Failed to cancel subscription", variant: "destructive" });
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/listsmartly/profile", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted", description: "Your ListSmartly profile has been removed." });
      router.push("/listsmartly");
    } catch {
      toast({ title: "Error", description: "Failed to delete profile", variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // ── Loading ──

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/listsmartly/dashboard")}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">ListSmartly Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, subscription, and preferences.</p>
      </div>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Business Profile</CardTitle>
            <Button variant="outline" size="sm" onClick={handleSyncBrand} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Sync from Brand Kit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* NAP Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="businessName">Business Name</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="businessName"
                  value={profile.businessName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("businessName", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("phone", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("email", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <div className="relative mt-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="website"
                  value={profile.website}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("website", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="address">Street Address</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  value={profile.address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("address", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("city", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={profile.state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("state", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={profile.zip}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("zip", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={profile.country}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("country", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Industry */}
          <div>
            <Label htmlFor="industry">Industry</Label>
            <select
              id="industry"
              value={profile.industry}
              onChange={(e) => updateField("industry", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select an industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Business Description</Label>
            <textarea
              id="description"
              value={profile.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Describe your business for directory listings..."
            />
          </div>

          {/* Hours */}
          <div>
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Business Hours
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <Label htmlFor="hoursMonFri" className="text-xs text-muted-foreground">Mon-Fri</Label>
                <Input
                  id="hoursMonFri"
                  value={profile.hoursMonFri}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("hoursMonFri", e.target.value)}
                  placeholder="9:00 AM - 5:00 PM"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="hoursSat" className="text-xs text-muted-foreground">Saturday</Label>
                <Input
                  id="hoursSat"
                  value={profile.hoursSat}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("hoursSat", e.target.value)}
                  placeholder="10:00 AM - 2:00 PM"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="hoursSun" className="text-xs text-muted-foreground">Sunday</Label>
                <Input
                  id="hoursSun"
                  value={profile.hoursSun}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("hoursSun", e.target.value)}
                  placeholder="Closed"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div>
            <Label>Social Media Links</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="relative">
                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.socialFacebook}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("socialFacebook", e.target.value)}
                  placeholder="Facebook URL"
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.socialInstagram}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("socialInstagram", e.target.value)}
                  placeholder="Instagram URL"
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.socialTwitter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("socialTwitter", e.target.value)}
                  placeholder="Twitter / X URL"
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.socialLinkedin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("socialLinkedin", e.target.value)}
                  placeholder="LinkedIn URL"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {subscription.plan === "pro" ? "Pro" : "Basic"} Plan
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={
                        subscription.status === "active" || subscription.status === "trialing"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : subscription.status === "canceled"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }
                    >
                      {subscription.status === "trialing" ? "Trial" : subscription.status}
                    </Badge>
                    {subscription.trialEndsAt && subscription.status === "trialing" && (
                      <span className="text-xs text-muted-foreground">
                        Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    ${subscription.plan === "pro" ? "15" : "7"}
                  </p>
                  <p className="text-xs text-muted-foreground">/month</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {subscription.plan === "basic" && subscription.status !== "canceled" && (
                  <Button size="sm" onClick={() => handlePlanChange("pro")}>
                    <ArrowUp className="h-4 w-4 mr-1" />
                    Upgrade to Pro
                  </Button>
                )}
                {subscription.plan === "pro" && subscription.status !== "canceled" && (
                  <Button size="sm" variant="outline" onClick={() => handlePlanChange("basic")}>
                    <ArrowDown className="h-4 w-4 mr-1" />
                    Downgrade to Basic
                  </Button>
                )}
                {subscription.status !== "canceled" && (
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active subscription</p>
              <Button size="sm" className="mt-3" onClick={() => router.push("/listsmartly/onboarding")}>
                Choose a Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-base text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20">
            <div>
              <p className="text-sm font-medium text-foreground">Delete ListSmartly Profile</p>
              <p className="text-xs text-muted-foreground">
                Permanently remove your profile, listings, and all associated data. This cannot be undone.
              </p>
            </div>
            {showDeleteConfirm ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
