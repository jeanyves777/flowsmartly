"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Settings, User, Bell, Shield, Palette, CreditCard, Link2, Moon, Sun, Contrast, Smartphone, Camera, Save, Check, ExternalLink, Instagram, Twitter, Linkedin, Facebook, AlertTriangle, RefreshCw, Coins, Zap, Crown, Star, Package, ArrowUpRight, Plus, Trash2, MoreVertical, Upload, History, Receipt, ArrowRight, Copy, KeyRound, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import { FileDropZone } from "@/components/shared/file-drop-zone";
import { MediaUploader } from "@/components/shared/media-uploader";
import { REGIONS } from "@/lib/constants/regions";
import { StripeProvider } from "@/components/providers/stripe-provider";
import { AddCardForm } from "@/components/payments/add-card-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FlowLoader } from "@/components/shared/flow-loader";

type SettingsTab = "profile" | "notifications" | "security" | "billing" | "connections" | "appearance";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  country: string | null;
  plan: string;
  aiCredits: number;
  balance: number;
  timezone: string | null;
  language: string | null;
  theme: string | null;
  notificationPrefs: NotificationPrefs;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: string | null;
  hasPassword: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

interface NotificationPrefs {
  emailDigest?: boolean;
  newFollowers?: boolean;
  mentions?: boolean;
  comments?: boolean;
  marketing?: boolean;
  productUpdates?: boolean;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "connections", label: "Connections", icon: Link2 },
  { id: "appearance", label: "Appearance", icon: Palette },
];

// Platform icons from shared PLATFORM_META — covers all 8 social platforms
const platformIcons: Record<string, React.ElementType> = Object.fromEntries(
  Object.entries(PLATFORM_META)
    .filter(([k]) => k !== "feed")
    .map(([k, v]) => [k, v.icon])
);

const defaultNotificationPrefs: NotificationPrefs = {
  emailDigest: true,
  newFollowers: true,
  mentions: true,
  comments: true,
  marketing: false,
  productUpdates: true,
};

const MAX_COVER_IMAGE_SIZE = 25 * 1024 * 1024;

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [isDeletingPaymentMethod, setIsDeletingPaymentMethod] = useState<string | null>(null);
  const [confirmDeleteMethod, setConfirmDeleteMethod] = useState<PaymentMethod | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSyncingFromBrand, setIsSyncingFromBrand] = useState(false);
  const { platforms: socialPlatforms, isLoading: socialLoading } = useSocialPlatforms();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    username: "",
    bio: "",
    website: "",
    country: "",
    avatarUrl: "",
    coverImageUrl: "",
  });

  const [links, setLinks] = useState<Record<string, string>>({
    instagram: "",
    twitter: "",
    linkedin: "",
    facebook: "",
    tiktok: "",
    youtube: "",
    custom: "",
  });

  const [notifications, setNotifications] = useState<NotificationPrefs>(defaultNotificationPrefs);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState<"setup" | "disable">("setup");
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Delete account (GDPR self-service erasure)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch profile and brand identity in parallel
      const [profileRes, brandRes] = await Promise.all([
        fetch("/api/users/profile"),
        fetch("/api/brand"),
      ]);

      const profileData = await profileRes.json();
      const brandData = await brandRes.json();

      if (!profileData.success) {
        throw new Error(profileData.error?.message || "Failed to fetch profile");
      }

      const userData = profileData.data.user;
      const brandKit = brandData.success ? brandData.data?.brandKit : null;

      // Check if we need to sync brand identity data to profile
      // Brand field mappings: description -> bio, website -> website, logo -> avatarUrl
      const syncUpdates: { bio?: string; website?: string; avatarUrl?: string } = {};
      if (!userData.bio && brandKit?.description) {
        syncUpdates.bio = brandKit.description;
      }
      if (!userData.website && brandKit?.website) {
        syncUpdates.website = brandKit.website;
      }
      if (!userData.avatarUrl && (brandKit?.iconLogo || brandKit?.logo)) {
        syncUpdates.avatarUrl = brandKit.iconLogo || brandKit.logo;
      }

      // If there's data to sync from brand identity, save it to the database
      if (Object.keys(syncUpdates).length > 0) {
        try {
          const syncRes = await fetch("/api/users/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(syncUpdates),
          });
          const syncData = await syncRes.json();
          if (syncData.success) {
            // Merge synced data into userData for state
            Object.assign(userData, syncUpdates);
            toast({
              title: "Profile synced from Brand Identity",
              description: `Updated: ${Object.keys(syncUpdates).join(", ")}`,
            });
          }
        } catch {
          // If sync fails, just continue with the local fallback
        }
      }

      setUser(userData);

      // Set profile state with synced/merged data
      setProfile({
        name: userData.name || "",
        email: userData.email || "",
        username: userData.username || "",
        bio: userData.bio || brandKit?.description || "",
        website: userData.website || brandKit?.website || "",
        country: userData.country || "",
        avatarUrl: userData.avatarUrl || brandKit?.iconLogo || brandKit?.logo || "",
        coverImageUrl: userData.coverImageUrl || "",
      });
      // Merge social links: brand identity handles → user profile links
      // Brand handles are the source of truth; user links override if set
      const brandHandles = brandKit?.handles || {};
      const userLinks = userData.links || {};
      const mergedLinks: Record<string, string> = {
        instagram: "",
        twitter: "",
        linkedin: "",
        facebook: "",
        tiktok: "",
        youtube: "",
        custom: "",
      };
      // First apply brand handles, then overlay user links
      for (const key of Object.keys(mergedLinks)) {
        if (userLinks[key]) {
          mergedLinks[key] = userLinks[key];
        } else if (brandHandles[key]) {
          mergedLinks[key] = brandHandles[key];
        }
      }
      setLinks(mergedLinks);

      // Sync brand handles → user links if user links are empty but brand has them
      const linkSyncUpdates: Record<string, string> = {};
      for (const platform of ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"]) {
        if (!userLinks[platform] && brandHandles[platform]) {
          linkSyncUpdates[platform] = brandHandles[platform];
        }
      }
      if (Object.keys(linkSyncUpdates).length > 0) {
        fetch("/api/users/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links: { ...userLinks, ...linkSyncUpdates } }),
        }).catch(() => {});
      }
      setNotifications({
        ...defaultNotificationPrefs,
        ...userData.notificationPrefs,
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

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    try {
      setPaymentMethodsLoading(true);
      const response = await fetch("/api/payments/methods");
      const data = await response.json();
      if (data.success) {
        setPaymentMethods(data.data.paymentMethods || []);
      }
    } catch (err) {
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const paymentMethod = searchParams.get("payment_method");
    const tab = searchParams.get("tab");
    if (tab === "billing") setActiveTab("billing");
    const paymentType = searchParams.get("type");
    if (payment === "success") {
      if (paymentType === "subscription") {
        toast({ title: "Plan upgraded!", description: "Your subscription is now active." });
      } else {
        toast({ title: "Payment successful!", description: "Your credits have been added to your account." });
      }
      fetchProfile(); // Refresh to show updated plan/credits
    } else if (payment === "cancelled") {
      toast({ title: "Payment cancelled", description: "No charges were made.", variant: "destructive" });
    }
    if (paymentMethod === "added") {
      toast({ title: "Payment method added!", description: "Your card has been saved for future purchases." });
      fetchPaymentMethods(); // Refresh payment methods
    } else if (paymentMethod === "cancelled") {
      toast({ title: "Cancelled", description: "No payment method was added.", variant: "destructive" });
    }
  }, [searchParams, toast, fetchProfile, fetchPaymentMethods]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Filter out empty link values
      const cleanLinks: Record<string, string> = {};
      Object.entries(links).forEach(([key, val]) => {
        if (val.trim()) cleanLinks[key] = val.trim();
      });

      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          username: profile.username,
          bio: profile.bio,
          website: profile.website,
          country: profile.country,
          avatarUrl: profile.avatarUrl,
          coverImageUrl: profile.coverImageUrl,
          links: cleanLinks,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update profile");
      }

      // Sync social links to brand identity handles (fire-and-forget)
      const brandHandles: Record<string, string> = {};
      for (const p of ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"]) {
        if (cleanLinks[p]) brandHandles[p] = cleanLinks[p];
      }
      if (Object.keys(brandHandles).length > 0) {
        fetch("/api/brand").then(r => r.json()).then(brandData => {
          if (brandData.success && brandData.data?.brandKit) {
            const kit = brandData.data.brandKit;
            const mergedHandles = { ...(kit.handles || {}), ...brandHandles };
            fetch("/api/brand", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...kit, handles: mergedHandles }),
            });
          }
        }).catch(() => {});
      }

      toast({ title: "Profile updated successfully!" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const uploadCoverFile = useCallback(async (file: File) => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PNG, JPEG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_COVER_IMAGE_SIZE) {
      toast({ title: "File too large", description: "Please upload an image smaller than 25MB.", variant: "destructive" });
      return;
    }

    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "cover");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Upload failed");

      const url = data.data.url;

      // Save to profile immediately
      const saveRes = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImageUrl: url }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error?.message || "Failed to save");

      setProfile((prev) => ({ ...prev, coverImageUrl: url }));
      toast({ title: "Cover photo uploaded successfully!" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }, [toast]);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCoverFile(file);
  };

  const handleSyncFromBrand = async () => {
    setIsSyncingFromBrand(true);
    try {
      // Fetch brand identity
      const brandRes = await fetch("/api/brand");
      const brandData = await brandRes.json();

      if (!brandData.success || !brandData.data?.brandKit) {
        toast({
          title: "No Brand Identity Found",
          description: "Please set up your brand identity first at /brand",
          variant: "destructive",
        });
        return;
      }

      const brandKit = brandData.data.brandKit;

      const updates: { bio?: string; website?: string; avatarUrl?: string } = {};

      // Check what can be synced
      if (brandKit.description) {
        updates.bio = brandKit.description;
      }
      if (brandKit.website) {
        updates.website = brandKit.website;
      }
      // Prefer icon logo for avatar (social profile image), fallback to full logo
      if (brandKit.iconLogo || brandKit.logo) {
        updates.avatarUrl = brandKit.iconLogo || brandKit.logo;
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: "Nothing to Sync",
          description: `Brand has: description=${brandKit.description ? "yes" : "no"}, website=${brandKit.website ? "yes" : "no"}, logo=${brandKit.iconLogo || brandKit.logo ? "yes" : "no"}. Fill these in at /brand first.`,
          variant: "destructive",
        });
        return;
      }

      // Save to database
      const saveRes = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const saveData = await saveRes.json();

      if (!saveData.success) {
        throw new Error(saveData.error?.message || "Failed to save");
      }

      // Update local state
      setProfile((prev) => ({
        ...prev,
        bio: updates.bio || prev.bio,
        website: updates.website || prev.website,
        avatarUrl: updates.avatarUrl || prev.avatarUrl,
      }));

      toast({
        title: "Synced from Brand Identity!",
        description: `Updated: ${Object.keys(updates).join(", ")}`,
      });
    } catch (err) {
      toast({
        title: "Sync Failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSyncingFromBrand(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPrefs: notifications,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update notifications");
      }

      toast({ title: "Notification preferences saved!" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save notifications",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwords.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to change password");
      }

      toast({ title: "Password changed successfully!" });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setTwoFactorLoading(true);
    setTwoFactorCode("");
    setTwoFactorPassword("");
    setTwoFactorSetup(null);
    try {
      const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Could not start two-factor setup");
      }
      setTwoFactorSetup({
        secret: data.data.secret,
        qrCodeDataUrl: data.data.qrCodeDataUrl,
        recoveryCodes: [],
      });
      setTwoFactorMode("setup");
      setTwoFactorDialogOpen(true);
    } catch (err) {
      toast({
        title: "2FA setup failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const enableTwoFactor = async () => {
    setTwoFactorLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorCode }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Could not enable two-factor authentication");
      }
      setTwoFactorSetup((current) => ({
        secret: current?.secret || "",
        qrCodeDataUrl: current?.qrCodeDataUrl || "",
        recoveryCodes: data.data.recoveryCodes || [],
      }));
      setUser((current) =>
        current
          ? {
              ...current,
              twoFactorEnabled: true,
              twoFactorEnabledAt: new Date().toISOString(),
            }
          : current
      );
      toast({ title: "2FA enabled", description: "Your account now requires an authenticator code at sign in." });
    } catch (err) {
      toast({
        title: "2FA was not enabled",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const openDisableTwoFactor = () => {
    setTwoFactorMode("disable");
    setTwoFactorCode("");
    setTwoFactorPassword("");
    setTwoFactorSetup(null);
    setTwoFactorDialogOpen(true);
  };

  const disableTwoFactor = async () => {
    setTwoFactorLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: twoFactorCode,
          currentPassword: twoFactorPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Could not disable two-factor authentication");
      }
      setUser((current) =>
        current
          ? {
              ...current,
              twoFactorEnabled: false,
              twoFactorEnabledAt: null,
            }
          : current
      );
      setTwoFactorDialogOpen(false);
      toast({ title: "2FA disabled" });
    } catch (err) {
      toast({
        title: "2FA was not disabled",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const copyRecoveryCodes = async () => {
    if (!twoFactorSetup?.recoveryCodes.length) return;
    await navigator.clipboard.writeText(twoFactorSetup.recoveryCodes.join("\n"));
    toast({ title: "Recovery codes copied" });
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to delete account");
      }

      // Account is gone — clear local state and send the user to the homepage.
      toast({ title: "Account deleted", description: "Your account and personal data have been removed." });
      window.location.href = "/";
    } catch (err) {
      toast({
        title: "Could not delete account",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setIsDeletingAccount(false);
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    try {
      await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {
      // Theme will still work locally even if save fails
    }
  };

  const handleAddPaymentMethod = () => {
    setShowAddCardModal(true);
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    setConfirmDeleteMethod(null);
    setIsDeletingPaymentMethod(paymentMethodId);
    try {
      const response = await fetch(`/api/payments/methods?id=${paymentMethodId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Payment method removed", description: "You will receive a confirmation email shortly." });
        fetchPaymentMethods();
      } else {
        throw new Error(data.error?.message || "Failed to remove payment method");
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to remove payment method", variant: "destructive" });
    } finally {
      setIsDeletingPaymentMethod(null);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch("/api/payments/methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Default payment method updated" });
        fetchPaymentMethods();
      } else {
        throw new Error(data.error?.message || "Failed to update default");
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to set default", variant: "destructive" });
    }
  };

  const handleOpenBillingPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const response = await fetch("/api/payments/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      } else {
        throw new Error(data.error?.message || "Failed to open billing portal");
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to open billing portal", variant: "destructive" });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getPlanName = (plan: string) => {
    const plans: Record<string, string> = {
      FREE: "Free Plan",
      STARTER: "Starter Plan",
      PRO: "Pro Plan",
      BUSINESS: "Business Plan",
      ENTERPRISE: "Enterprise Plan",
    };
    return plans[plan] || plan;
  };

  if (error && !user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchProfile} variant="outline">
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
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <Settings className="w-4 h-4 text-brand-600" />
          </div>
          <span className="bg-gradient-to-r from-brand-500 via-purple-500 to-brand-600 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar Navigation */}
        <Card className="h-fit rounded-2xl">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-brand-500/10 text-brand-500"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="space-y-6">
          {/* Profile Settings */}
          {activeTab === "profile" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>
                        Update your profile details and public information
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncFromBrand}
                      disabled={isSyncingFromBrand || isLoading}
                    >
                      {isSyncingFromBrand ? (
                        <FlowLoader size={16} className="mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync from Brand
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-20 h-20 rounded-full" />
                        <Skeleton className="h-10 w-32" />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                      <Skeleton className="h-10" />
                      <Skeleton className="h-24" />
                    </div>
                  ) : (
                    <>
                      {/* Avatar */}
                      <MediaUploader
                        value={profile.avatarUrl ? [profile.avatarUrl] : []}
                        onChange={(urls) => setProfile({ ...profile, avatarUrl: urls[0] || "" })}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        maxSize={5 * 1024 * 1024}
                        filterTypes={["image"]}
                        label="Profile Photo"
                        placeholder="Upload"
                        variant="medium"
                        libraryTitle="Select Avatar from Library"
                      />

                      {/* Cover Photo */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Cover Photo</Label>
                        <FileDropZone
                          onFileDrop={uploadCoverFile}
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          maxSize={MAX_COVER_IMAGE_SIZE}
                          disabled={isUploadingCover}
                          dragLabel="Drop cover image here"
                        >
                          <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted border">
                            {profile.coverImageUrl ? (
                              <img
                                src={profile.coverImageUrl}
                                alt="Cover"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-brand-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                <Camera className="w-8 h-8 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="absolute bottom-2 right-2 flex gap-2">
                              <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="hidden"
                                onChange={handleCoverUpload}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => coverInputRef.current?.click()}
                                disabled={isUploadingCover}
                                className="bg-black/60 hover:bg-black/80 text-white border-0 shadow-lg"
                              >
                                {isUploadingCover ? (
                                  <FlowLoader size={16} tone="white" className="mr-1.5" />
                                ) : (
                                  <Upload className="w-4 h-4 mr-1.5" />
                                )}
                                {isUploadingCover ? "Uploading..." : profile.coverImageUrl ? "Change Cover" : "Upload Cover"}
                              </Button>
                              {profile.coverImageUrl && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={async () => {
                                    await fetch("/api/users/profile", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ coverImageUrl: "" }),
                                    });
                                    setProfile((prev) => ({ ...prev, coverImageUrl: "" }));
                                    toast({ title: "Cover photo removed" });
                                  }}
                                  className="bg-black/60 hover:bg-black/80 text-white border-0 shadow-lg"
                                >
                                  <Trash2 className="w-4 h-4 mr-1.5" />
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPG, PNG or WebP. Max 25MB. Recommended: 1500x500px. Or drag &amp; drop.
                          </p>
                        </FileDropZone>
                      </div>

                      {/* Form Fields */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            value={profile.name}
                            onChange={(e) =>
                              setProfile({ ...profile, name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              @
                            </span>
                            <Input
                              id="username"
                              value={profile.username}
                              onChange={(e) =>
                                setProfile({ ...profile, username: e.target.value })
                              }
                              className="pl-8"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <select
                          id="country"
                          value={profile.country}
                          onChange={(e) =>
                            setProfile({ ...profile, country: e.target.value })
                          }
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <option value="">Select your country</option>
                          {REGIONS.map(region => (
                            <optgroup key={region.id} label={region.name}>
                              {region.countries.map(c => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={profile.email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          Contact support to change your email address
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <textarea
                          id="bio"
                          value={profile.bio}
                          onChange={(e) =>
                            setProfile({ ...profile, bio: e.target.value })
                          }
                          className="w-full min-h-[100px] p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          type="url"
                          value={profile.website}
                          onChange={(e) =>
                            setProfile({ ...profile, website: e.target.value })
                          }
                          placeholder="https://"
                        />
                      </div>

                      {/* Social Links */}
                      <div className="space-y-3 pt-2">
                        <Label className="text-base">Social Links</Label>
                        <p className="text-xs text-muted-foreground -mt-1">
                          Add your social media profiles
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="link-instagram" className="text-xs flex items-center gap-1.5">
                              <Instagram className="w-3.5 h-3.5" /> Instagram
                            </Label>
                            <Input
                              id="link-instagram"
                              value={links.instagram}
                              onChange={(e) => setLinks({ ...links, instagram: e.target.value })}
                              placeholder="@username or URL"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="link-twitter" className="text-xs flex items-center gap-1.5">
                              <Twitter className="w-3.5 h-3.5" /> X / Twitter
                            </Label>
                            <Input
                              id="link-twitter"
                              value={links.twitter}
                              onChange={(e) => setLinks({ ...links, twitter: e.target.value })}
                              placeholder="@username or URL"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="link-linkedin" className="text-xs flex items-center gap-1.5">
                              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                            </Label>
                            <Input
                              id="link-linkedin"
                              value={links.linkedin}
                              onChange={(e) => setLinks({ ...links, linkedin: e.target.value })}
                              placeholder="URL or username"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="link-facebook" className="text-xs flex items-center gap-1.5">
                              <Facebook className="w-3.5 h-3.5" /> Facebook
                            </Label>
                            <Input
                              id="link-facebook"
                              value={links.facebook}
                              onChange={(e) => setLinks({ ...links, facebook: e.target.value })}
                              placeholder="URL or page name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="link-tiktok" className="text-xs flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.62a8.16 8.16 0 0 0 4.76 1.52v-3.4c0-.01-1-.05-1-1.05z"/></svg>
                              TikTok
                            </Label>
                            <Input
                              id="link-tiktok"
                              value={links.tiktok}
                              onChange={(e) => setLinks({ ...links, tiktok: e.target.value })}
                              placeholder="@username or URL"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="link-youtube" className="text-xs flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                              YouTube
                            </Label>
                            <Input
                              id="link-youtube"
                              value={links.youtube}
                              onChange={(e) => setLinks({ ...links, youtube: e.target.value })}
                              placeholder="Channel URL"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="link-custom" className="text-xs flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" /> Other Link
                          </Label>
                          <Input
                            id="link-custom"
                            value={links.custom}
                            onChange={(e) => setLinks({ ...links, custom: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving || isLoading}>
                  {isSaving ? (
                    <>
                      <FlowLoader size={16} tone="white" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Notifications Settings */}
          {activeTab === "notifications" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose what notifications you want to receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : (
                    [
                      { key: "emailDigest", label: "Email Digest", description: "Receive a weekly summary of your account activity" },
                      { key: "newFollowers", label: "New Followers", description: "Get notified when someone follows you" },
                      { key: "mentions", label: "Mentions", description: "Get notified when someone mentions you" },
                      { key: "comments", label: "Comments", description: "Get notified when someone comments on your posts" },
                      { key: "marketing", label: "Marketing Emails", description: "Receive tips, offers and updates from FlowSmartly" },
                      { key: "productUpdates", label: "Product Updates", description: "Get notified about new features and improvements" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof typeof notifications] || false}
                            onChange={(e) =>
                              setNotifications({
                                ...notifications,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={isSaving || isLoading}>
                  {isSaving ? (
                    <>
                      <FlowLoader size={16} tone="white" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(e) =>
                        setPasswords({ ...passwords, currentPassword: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) =>
                        setPasswords({ ...passwords, newPassword: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirmPassword: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isSaving || !passwords.currentPassword || !passwords.newPassword}
                  >
                    {isSaving ? (
                      <>
                        <FlowLoader size={16} tone="white" className="mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${user?.twoFactorEnabled ? "bg-emerald-500/10" : "bg-muted"}`}>
                        {user?.twoFactorEnabled ? (
                          <Shield className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Shield className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{user?.twoFactorEnabled ? "2FA is enabled" : "2FA is not enabled"}</p>
                        <p className="text-xs text-muted-foreground">
                          {user?.twoFactorEnabled
                            ? `Authenticator app required${user.twoFactorEnabledAt ? ` since ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(user.twoFactorEnabledAt))}` : ""}.`
                            : "Protect your account with an authenticator app."}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={user?.twoFactorEnabled ? "outline" : "default"}
                      onClick={user?.twoFactorEnabled ? openDisableTwoFactor : startTwoFactorSetup}
                      disabled={twoFactorLoading}
                      className={user?.twoFactorEnabled ? "" : "bg-brand-500 text-white hover:bg-brand-600"}
                    >
                      {twoFactorLoading ? (
                        <FlowLoader size={16} tone="white" className="mr-2" />
                      ) : user?.twoFactorEnabled ? (
                        <KeyRound className="mr-2 h-4 w-4" />
                      ) : (
                        <QrCode className="mr-2 h-4 w-4" />
                      )}
                      {user?.twoFactorEnabled ? "Manage 2FA" : "Enable 2FA"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage your active sessions across devices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Current Session</p>
                        <p className="text-xs text-muted-foreground">This device</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-500 border-green-500/50">Active</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone — Delete Account (GDPR self-service erasure) */}
              <Card className="border-red-500/40 rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    Delete Account
                  </CardTitle>
                  <CardDescription>
                    Permanently delete your account and erase your personal data. This cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">This will:</p>
                      <ul className="mt-1 list-disc pl-5 space-y-0.5">
                        <li>Cancel any active subscription</li>
                        <li>Erase your name, email, photos, and connected accounts</li>
                        <li>Sign you out of every device immediately</li>
                      </ul>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeletePassword("");
                        setDeleteConfirmation("");
                        setDeleteDialogOpen(true);
                      }}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete my account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Billing Settings */}
          {activeTab === "billing" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              {/* Current Plan */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-brand-500" />
                    Current Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-24" />
                  ) : (
                    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{getPlanName(user?.plan || "STARTER")}</h3>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {user?.plan === "STARTER" || !user?.plan ? "Free workspace access" : "Subscription managed by Stripe"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(user?.plan === "STARTER" || !user?.plan) ? (
                          <Button asChild>
                            <Link href="/settings/upgrade">
                              <Zap className="w-4 h-4 mr-2" />
                              Upgrade plan
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="outline" asChild>
                            <Link href="/settings/upgrade">
                              <ArrowUpRight className="w-4 h-4 mr-2" />
                              Change plan
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-brand-500" />
                        Payment Methods
                      </CardTitle>
                      <CardDescription>Manage your saved payment methods</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenBillingPortal}
                        disabled={isOpeningPortal}
                      >
                        {isOpeningPortal ? (
                          <FlowLoader size={16} className="mr-2" />
                        ) : (
                          <ExternalLink className="w-4 h-4 mr-2" />
                        )}
                        Billing portal
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddPaymentMethod}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add card
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {paymentMethodsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium">No payment methods</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add a card to make purchases easier
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleAddPaymentMethod}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Payment Method
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-brand-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm flex items-center gap-2">
                                <span className="capitalize">{method.brand}</span> ending in {method.last4}
                                {method.isDefault && (
                                  <Badge variant="secondary" className="text-xs">Default</Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Expires {method.expMonth}/{method.expYear}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!method.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetDefaultPaymentMethod(method.id)}
                              >
                                Set default
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => setConfirmDeleteMethod(method)}
                              disabled={isDeletingPaymentMethod === method.id}
                            >
                              {isDeletingPaymentMethod === method.id ? (
                                <FlowLoader size={16} />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-5 xl:grid-cols-2">
              {/* Buy Credits */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-brand-500" />
                        Buy Credits
                      </CardTitle>
                      <CardDescription>Purchase credits to power AI features, SMS, and more</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/buy-credits">
                        View All
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                          <Package className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                          <p className="font-medium">Credit packages have their own checkout page</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Compare packages, choose a saved card, and review the order without crowding billing settings.
                          </p>
                        </div>
                      </div>
                      <Button asChild>
                        <Link href="/buy-credits">
                          Open credit store
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Credits Balance */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-brand-500" />
                        Your Credits
                      </CardTitle>
                      <CardDescription>Your remaining credit balance</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/credits/history">
                        <History className="w-4 h-4 mr-2" />
                        View History
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-24" />
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-3xl font-bold">{user?.aiCredits?.toLocaleString() || 0}</p>
                          <p className="text-sm text-muted-foreground">credits remaining</p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${Math.min((user?.aiCredits || 0) / 50, 100)}%` }}
                        />
                      </div>
                      <div className="mt-4 flex gap-3">
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                          <Link href="/credits/history">
                            <History className="w-4 h-4 mr-1.5" />
                            Transaction History
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                          <Link href="/credits/history?tab=invoices">
                            <Receipt className="w-4 h-4 mr-1.5" />
                            Invoices
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                          <Link href="/buy-credits">
                            <Plus className="w-4 h-4 mr-1.5" />
                            Buy More
                          </Link>
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Account Balance */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Account Balance</CardTitle>
                  <CardDescription>Your current earnings balance</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-16" />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold">{formatCurrency(user?.balance || 0)}</p>
                        <p className="text-sm text-muted-foreground">available for withdrawal</p>
                      </div>
                      <Button variant="outline" disabled={(user?.balance || 0) < 10}>
                        Request Payout
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </motion.div>
          )}

          {/* Connections Settings */}
          {activeTab === "connections" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Social Media Accounts
                      </CardTitle>
                      <CardDescription>
                        Manage your connected social media accounts
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                      <Link2 className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Connect Your Social Accounts</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                      Connect Facebook, Instagram, WhatsApp, YouTube and more to share content across all your platforms
                    </p>
                    <Button
                      size="lg"
                      onClick={() => window.location.href = "/social-accounts"}
                      className="gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Manage Social Accounts
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Marketing Configuration */}
              <Card className="bg-gradient-to-r from-brand-500/10 to-purple-500/10 border-brand-500/20 rounded-2xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
                        <Bell className="w-6 h-6 text-brand-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Email & SMS Marketing</h3>
                        <p className="text-sm text-muted-foreground">
                          Configure your email provider and rent SMS phone numbers
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <a href="/settings/marketing">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Configure
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Appearance Settings */}
          {activeTab === "appearance" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Theme</CardTitle>
                  <CardDescription>
                    Choose your preferred color scheme
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { id: "light", label: "Light", icon: Sun },
                      { id: "grey", label: "Grey", icon: Contrast },
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "system", label: "System", icon: Smartphone },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleThemeChange(option.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          mounted && theme === option.id
                            ? "border-brand-500 bg-brand-500/5"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        }`}
                      >
                        <option.icon className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-sm font-medium">{option.label}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Add Card Modal */}
      <StripeProvider>
        <AddCardForm
          open={showAddCardModal}
          onClose={() => setShowAddCardModal(false)}
          onSuccess={() => {
            fetchPaymentMethods();
            toast({ title: "Card saved", description: "Your payment method has been added successfully." });
          }}
        />
      </StripeProvider>

      <Dialog open={twoFactorDialogOpen} onOpenChange={setTwoFactorDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {twoFactorMode === "setup" ? "Set Up Two-Factor Authentication" : "Disable Two-Factor Authentication"}
            </DialogTitle>
            <DialogDescription>
              {twoFactorMode === "setup"
                ? "Scan the QR code with an authenticator app, then enter the 6-digit code to activate 2FA."
                : "Confirm this change with an authenticator code, recovery code, or your current password."}
            </DialogDescription>
          </DialogHeader>

          {twoFactorMode === "setup" ? (
            <div className="space-y-5">
              {twoFactorSetup?.recoveryCodes.length ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300">Save these recovery codes</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Each code can be used once if the authenticator app is unavailable.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyRecoveryCodes}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {twoFactorSetup.recoveryCodes.map((code) => (
                      <code key={code} className="rounded-lg border bg-background px-3 py-2 text-sm">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="rounded-xl border bg-white p-3">
                      {twoFactorSetup?.qrCodeDataUrl ? (
                        <img src={twoFactorSetup.qrCodeDataUrl} alt="Authenticator QR code" className="h-52 w-52" />
                      ) : (
                        <div className="grid h-52 w-52 place-items-center text-muted-foreground">
                          <FlowLoader size={20} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-sm font-medium">Manual setup key</p>
                        <code className="mt-2 block break-all rounded-lg bg-background p-2 text-sm">
                          {twoFactorSetup?.secret || "Loading..."}
                        </code>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twoFactorCode">Authenticator code</Label>
                        <Input
                          id="twoFactorCode"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={twoFactorCode}
                          onChange={(event) => setTwoFactorCode(event.target.value)}
                          placeholder="123456"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disableTwoFactorCode">Authenticator or recovery code</Label>
                <Input
                  id="disableTwoFactorCode"
                  autoComplete="one-time-code"
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value)}
                  placeholder="123456 or recovery code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disableTwoFactorPassword">Current password</Label>
                <Input
                  id="disableTwoFactorPassword"
                  type="password"
                  value={twoFactorPassword}
                  onChange={(event) => setTwoFactorPassword(event.target.value)}
                  placeholder="Optional if you entered a valid code"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFactorDialogOpen(false)} disabled={twoFactorLoading}>
              {twoFactorSetup?.recoveryCodes.length ? "Done" : "Cancel"}
            </Button>
            {twoFactorMode === "setup" && !twoFactorSetup?.recoveryCodes.length && (
              <Button
                onClick={enableTwoFactor}
                disabled={twoFactorLoading || twoFactorCode.trim().length < 6}
                className="bg-brand-500 text-white hover:bg-brand-600"
              >
                {twoFactorLoading ? <FlowLoader size={16} tone="white" className="mr-2" /> : <Shield className="mr-2 h-4 w-4" />}
                Verify and enable
              </Button>
            )}
            {twoFactorMode === "disable" && (
              <Button
                onClick={disableTwoFactor}
                disabled={twoFactorLoading || (!twoFactorCode.trim() && !twoFactorPassword.trim())}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {twoFactorLoading ? <FlowLoader size={16} tone="white" className="mr-2" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Disable 2FA
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Method Confirmation */}
      <AlertDialog open={!!confirmDeleteMethod} onOpenChange={(open) => !open && setConfirmDeleteMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your{" "}
              <strong>{confirmDeleteMethod?.brand.toUpperCase()}</strong> card ending in{" "}
              <strong>{confirmDeleteMethod?.last4}</strong>? This action cannot be undone.
              You will receive an email confirmation for security purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => confirmDeleteMethod && handleDeletePaymentMethod(confirmDeleteMethod.id)}
            >
              Remove Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !isDeletingAccount && setDeleteDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete your account?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes your account and erases your personal data (name, email,
              photos, and connected social accounts). Any active subscription is cancelled. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {user?.hasPassword ? (
              <div className="space-y-2">
                <Label htmlFor="deletePassword">Enter your password to confirm</Label>
                <Input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="deleteConfirmation">
                  Type <span className="font-semibold text-red-600">DELETE</span> to confirm
                </Label>
                <Input
                  id="deleteConfirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeletingAccount}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={
                isDeletingAccount ||
                (user?.hasPassword
                  ? !deletePassword
                  : deleteConfirmation.trim().toUpperCase() !== "DELETE")
              }
            >
              {isDeletingAccount ? (
                <>
                  <FlowLoader size={16} tone="white" className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Permanently delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
