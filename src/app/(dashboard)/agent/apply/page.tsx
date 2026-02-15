"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  X,
  DollarSign,
  Globe,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SPECIALTY_OPTIONS = [
  "Social Media Management",
  "Content Creation",
  "SEO & SEM",
  "Email Marketing",
  "SMS Marketing",
  "Brand Strategy",
  "Paid Advertising",
  "Analytics & Reporting",
  "Influencer Marketing",
  "Video Marketing",
  "Community Management",
  "Graphic Design",
];

const INDUSTRY_OPTIONS = [
  "E-commerce",
  "SaaS",
  "Healthcare",
  "Real Estate",
  "Restaurant & Food",
  "Fitness & Wellness",
  "Education",
  "Fashion & Beauty",
  "Finance",
  "Travel & Tourism",
  "Entertainment",
  "Non-Profit",
  "Local Business",
  "B2B Services",
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AgentApplyPage() {
  const router = useRouter();
  const [existingProfile, setExistingProfile] = useState<{
    status: string;
    rejectedReason?: string;
  } | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([""]);
  const [minPrice, setMinPrice] = useState("100");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const res = await fetch("/api/agent/profile");
        const data = await res.json();
        if (data.success && data.data?.profile) {
          setExistingProfile({
            status: data.data.profile.status,
            rejectedReason: data.data.profile.rejectedReason,
          });
        }
      } catch {}
      setIsCheckingProfile(false);
    };
    checkProfile();
  }, []);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleIndustry = (i: string) => {
    setIndustries((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const addPortfolioUrl = () => {
    if (portfolioUrls.length < 5) {
      setPortfolioUrls([...portfolioUrls, ""]);
    }
  };

  const updatePortfolioUrl = (index: number, value: string) => {
    const updated = [...portfolioUrls];
    updated[index] = value;
    setPortfolioUrls(updated);
  };

  const removePortfolioUrl = (index: number) => {
    setPortfolioUrls(portfolioUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }
    if (specialties.length === 0) {
      setError("Please select at least one specialty");
      return;
    }
    if (industries.length === 0) {
      setError("Please select at least one industry");
      return;
    }

    const priceInCents = Math.round(parseFloat(minPrice) * 100);
    if (isNaN(priceInCents) || priceInCents < 10000) {
      setError("Minimum price must be at least $100/month");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/agent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          specialties,
          industries,
          portfolioUrls: portfolioUrls.filter((u) => u.trim()),
          minPricePerMonth: priceInCents,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setExistingProfile({ status: "PENDING" });
      } else {
        setError(data.error?.message || "Failed to submit application");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already has a profile — show status
  if (existingProfile) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardContent className="p-8 text-center">
              {existingProfile.status === "PENDING" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Application Under Review</h2>
                  <p className="text-muted-foreground mb-6">
                    Your agent application has been submitted and is being reviewed by our team.
                    You will be notified once a decision has been made.
                  </p>
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </>
              )}
              {existingProfile.status === "APPROVED" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">You&apos;re an Approved Agent!</h2>
                  <p className="text-muted-foreground mb-6">
                    Your agent profile is active. Head to your client dashboard to manage your clients.
                  </p>
                  <Button onClick={() => router.push("/agent/clients")}>
                    Go to My Clients
                  </Button>
                </>
              )}
              {existingProfile.status === "REJECTED" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <X className="h-8 w-8 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Application Not Approved</h2>
                  <p className="text-muted-foreground mb-4">
                    Unfortunately, your agent application was not approved at this time.
                  </p>
                  {existingProfile.rejectedReason && (
                    <div className="bg-red-500/5 border border-red-200 rounded-lg p-4 mb-6 text-left">
                      <p className="text-sm font-medium text-red-600 mb-1">Reason:</p>
                      <p className="text-sm">{existingProfile.rejectedReason}</p>
                    </div>
                  )}
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </>
              )}
              {existingProfile.status === "SUSPENDED" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <X className="h-8 w-8 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Agent Profile Suspended</h2>
                  <p className="text-muted-foreground mb-6">
                    Your agent profile has been suspended. Please contact support for more information.
                  </p>
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // No profile — show application form
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Become an Agent</h1>
            <p className="text-sm text-muted-foreground">
              Apply to offer your marketing services on FlowSmartly
            </p>
          </div>
        </div>
      </motion.div>

      {/* Benefits */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Card className="border-violet-200 bg-violet-500/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-2">
                <DollarSign className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recurring Revenue</p>
                  <p className="text-xs text-muted-foreground">Earn monthly from each client</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Marketplace Exposure</p>
                  <p className="text-xs text-muted-foreground">Get discovered by businesses</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Built-in Tools</p>
                  <p className="text-xs text-muted-foreground">Manage clients with FlowSmartly</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Agent Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Sarah's Digital Marketing"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  This is how clients will see you in the marketplace
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Description</Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell potential clients about your experience, approach, and what makes you stand out..."
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/1000
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Specialties */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Specialties *</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the services you offer (at least one)
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {SPECIALTY_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      specialties.includes(s)
                        ? "bg-violet-500 text-white border-violet-500"
                        : "bg-background text-muted-foreground border-border hover:border-violet-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Industries */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Industries *</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the industries you have experience in (at least one)
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {INDUSTRY_OPTIONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleIndustry(i)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      industries.includes(i)
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-background text-muted-foreground border-border hover:border-brand-300"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pricing */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Minimum Monthly Rate (USD) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="minPrice"
                    type="number"
                    min="100"
                    step="1"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum $100/month. You can negotiate higher rates with individual clients.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Portfolio Links */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio / Website Links</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optional — share links to your work or website
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {portfolioUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => updatePortfolioUrl(index, e.target.value)}
                    placeholder="https://yourwebsite.com"
                    type="url"
                  />
                  {portfolioUrls.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePortfolioUrl(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {portfolioUrls.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPortfolioUrl}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Link
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground max-w-sm">
              By applying, you agree to FlowSmartly&apos;s agent terms. Applications
              are typically reviewed within 1-2 business days.
            </p>
            <Button
              type="submit"
              size="lg"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </form>
    </div>
  );
}
