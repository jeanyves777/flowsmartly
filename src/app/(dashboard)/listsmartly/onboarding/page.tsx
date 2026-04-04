"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Tag,
  Search,
  CreditCard,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Globe,
  Phone,
  Mail,
  MapPin,
  X,
  Sparkles,
  Shield,
  Zap,
  BarChart3,
  MessageSquare,
  FileText,
  Star,
  ChevronDown,
  ChevronUp,
  ExternalLink,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// ── Step Config ──

const STEP_CONFIG = [
  { label: "Business Info", icon: Building2 },
  { label: "Industry", icon: Tag },
  { label: "Scan", icon: Search },
  { label: "Plan", icon: CreditCard },
  { label: "Launch", icon: Rocket },
];

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

const CATEGORY_OPTIONS: Record<string, string[]> = {
  "Tax & Accounting": ["Tax Preparation", "Bookkeeping", "Payroll", "Auditing", "Financial Planning"],
  Dental: ["General Dentistry", "Orthodontics", "Cosmetic Dentistry", "Pediatric Dentistry", "Oral Surgery"],
  Legal: ["Family Law", "Criminal Defense", "Personal Injury", "Business Law", "Estate Planning"],
  Restaurant: ["Fine Dining", "Fast Casual", "Cafe", "Bar & Grill", "Food Truck", "Catering"],
  "Real Estate": ["Residential", "Commercial", "Property Management", "Mortgage", "Appraisal"],
  "Health & Wellness": ["Chiropractic", "Physical Therapy", "Massage", "Yoga Studio", "Gym"],
  "Auto Services": ["Auto Repair", "Oil Change", "Tires", "Body Shop", "Detailing"],
  "Home Services": ["Plumbing", "Electrical", "HVAC", "Roofing", "Landscaping", "Cleaning"],
  Retail: ["Clothing", "Electronics", "Grocery", "Pet Store", "Jewelry", "Furniture"],
  Technology: ["IT Services", "Web Development", "Software", "Cybersecurity", "Cloud Services"],
  Education: ["Tutoring", "Music Lessons", "Language School", "Test Prep", "Driving School"],
  Other: ["General Business", "Consulting", "Non-Profit", "Government", "Other"],
};

// ── Types ──

interface BusinessInfo {
  businessName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface ReviewSnippet {
  rating: number;
  text: string;
  timeAgo: string;
  author: string;
}

interface ListingFinding {
  directoryName: string;
  tier: number;
  status: string;
  listingUrl?: string;
  // Rich data from Google Places
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  website?: string;
  businessName?: string;
  recentReviews?: ReviewSnippet[];
  hours?: string[];
  isOpenNow?: boolean;
}

interface ScanResults {
  totalDirectories: number;
  relevant: number;
  alreadySubmitted: number;
  missing: number;
  findings: ListingFinding[];
}

// ── Address Parser ──

function parseAddress(fullAddress: string): { street: string; city: string; state: string; zip: string } {
  // Handle formats like:
  // "255 N. ALLEN STREET, Albany, NY"
  // "255 N. Allen St, Albany, NY 12206"
  // "123 Main St, Suite 4, Springfield, IL 62701"
  const parts = fullAddress.split(",").map((p) => p.trim());

  if (parts.length >= 2) {
    const street = parts[0];
    // Last part often has "State ZIP" or just "State"
    const lastPart = parts[parts.length - 1].trim();
    const cityPart = parts.length >= 3 ? parts[parts.length - 2].trim() : parts[1].trim();

    // Extract state and zip from last part: "NY 12206" or "NY"
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
    if (stateZipMatch) {
      return {
        street,
        city: cityPart,
        state: stateZipMatch[1].toUpperCase(),
        zip: stateZipMatch[2] || "",
      };
    }

    // If last part is a city+state like "Albany NY"
    const cityStateMatch = lastPart.match(/^(.+?)\s+([A-Z]{2})$/i);
    if (cityStateMatch) {
      return {
        street,
        city: cityStateMatch[1],
        state: cityStateMatch[2].toUpperCase(),
        zip: "",
      };
    }

    // Fallback: treat second part as city, look for state in remaining
    return { street, city: cityPart, state: "", zip: "" };
  }

  return { street: fullAddress, city: "", state: "", zip: "" };
}

// ── Component ──

export default function ListSmartlyOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [business, setBusiness] = useState<BusinessInfo>({
    businessName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });
  const [brandLoading, setBrandLoading] = useState(true);

  // Step 2
  const [industry, setIndustry] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  // Step 3
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);

  // Step 3 - expanded findings
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

  // Step 4
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | null>(null);

  // ── Pre-fill from brand kit ──

  const [hasBrandKit, setHasBrandKit] = useState(false);

  const syncFromBrandKit = useCallback(async () => {
    setBrandLoading(true);
    try {
      const res = await fetch("/api/brand");
      if (!res.ok) return;
      const json = await res.json();
      const bk = json.data?.brandKit;
      if (!bk) return;

      setHasBrandKit(true);

      // Use separate address fields if available, otherwise parse the single address
      let street = bk.address || "";
      let city = bk.city || "";
      let state = bk.state || "";
      let zip = bk.zip || "";
      let country = bk.country || "US";

      // Fallback: parse combined address if separate fields are empty
      if (street && !city && !state && street.includes(",")) {
        const parsed = parseAddress(street);
        street = parsed.street;
        city = parsed.city;
        state = parsed.state;
        zip = parsed.zip;
      }

      setBusiness((prev) => ({
        ...prev,
        businessName: bk.name || prev.businessName,
        phone: bk.phone || prev.phone,
        email: bk.email || prev.email,
        website: bk.website || prev.website,
        address: street || prev.address,
        city: city || prev.city,
        state: state || prev.state,
        zip: zip || prev.zip,
        country: country || prev.country || "US",
      }));
      if (bk.industry && !industry) {
        // Try to match industry to our list
        const match = INDUSTRIES.find(
          (ind) => ind.toLowerCase().includes(bk.industry.toLowerCase()) ||
                   bk.industry.toLowerCase().includes(ind.toLowerCase())
        );
        if (match) setIndustry(match);
      }
      toast({ title: "Synced!", description: "Business info loaded from your Brand Kit." });
    } catch {
      // Brand kit not available
    } finally {
      setBrandLoading(false);
    }
  }, [industry, toast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncFromBrandKit(); }, []);

  // Check for previous scan results on mount
  useEffect(() => {
    async function loadPreviousScan() {
      try {
        const res = await fetch("/api/listsmartly/sync");
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data && json.data.status === "completed" && json.data.details) {
          const details = typeof json.data.details === "string" ? JSON.parse(json.data.details) : json.data.details;
          if (details.findings?.length > 0) {
            // We have previous scan results — load them
            const allFindings = details.findings || [];
            const liveCount = allFindings.filter((f: { status: string }) => ["live", "submitted", "claimed"].includes(f.status)).length;
            const missingCount = allFindings.filter((f: { status: string }) => f.status === "missing").length;
            setScanResults({
              totalDirectories: allFindings.length,
              relevant: allFindings.length,
              alreadySubmitted: liveCount,
              missing: missingCount,
              findings: allFindings.map((f: { directoryName: string; tier: number; status: string; listingUrl?: string }) => ({
                directoryName: f.directoryName,
                tier: f.tier,
                status: f.status,
                listingUrl: f.listingUrl || undefined,
              })),
            });
          }
        }
      } catch { /* no previous scan */ }
    }
    loadPreviousScan();
  }, []);

  // ── Handlers ──

  function updateBusiness(field: keyof BusinessInfo, value: string) {
    setBusiness((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function runScan() {
    setScanning(true);
    setScanProgress(0);

    // Animate progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 8;
      });
    }, 200);

    try {
      // Try to activate (create profile + seed directories + initialize listings)
      const activateRes = await fetch("/api/listsmartly/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...business,
          industry,
          categories,
        }),
      });

      // If profile already exists (409), update it and continue
      if (activateRes.status === 409) {
        await fetch("/api/listsmartly/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...business,
            industry,
            categories: JSON.stringify(categories),
          }),
        });
      } else if (!activateRes.ok) {
        const err = await activateRes.json().catch(() => ({}));
        throw new Error(err.error?.message || "Activation failed");
      }

      // Run the REAL scan — this calls Google Places API + Custom Search
      // and WAITS for it to complete (not fire-and-forget)
      setScanProgress(50);
      const scanRes = await fetch("/api/listsmartly/listings/scan", { method: "POST" });
      const scanJson = scanRes.ok ? await scanRes.json() : null;

      clearInterval(interval);
      setScanProgress(100);

      // Get actual listing data with directory details + profile for rating
      const [listingsRes, profileRes] = await Promise.all([
        fetch("/api/listsmartly/listings?limit=200"),
        fetch("/api/listsmartly/profile"),
      ]);
      const listingsJson = listingsRes.ok ? await listingsRes.json() : null;
      const profileJson = profileRes.ok ? await profileRes.json() : null;
      const allListings = listingsJson?.data?.listings || [];
      const profileData = profileJson?.data || {};

      const liveCount = allListings.filter((l: { status: string }) => l.status === "live" || l.status === "submitted").length;
      const missingCount = allListings.filter((l: { status: string }) => l.status === "missing").length;

      // Build findings list sorted by tier then status (live first)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const findings: ListingFinding[] = allListings
        .map((l: any) => {
          // Parse rich data stored in aiDescription (JSON from Google Places)
          let richData: any = {};
          try {
            if (l.aiDescription) richData = JSON.parse(l.aiDescription);
          } catch { /* not JSON */ }

          return {
            directoryName: l.directory?.name || "Unknown",
            tier: l.directory?.tier || 7,
            status: l.status,
            listingUrl: l.listingUrl || undefined,
            rating: richData.rating || undefined,
            reviewCount: richData.reviewCount || undefined,
            address: l.address || undefined,
            phone: l.phone || undefined,
            website: l.website || undefined,
            businessName: l.businessName || undefined,
            recentReviews: richData.recentReviews || undefined,
            hours: richData.hours || undefined,
            isOpenNow: richData.isOpenNow,
          };
        })
        .sort((a: { status: string; tier: number }, b: { status: string; tier: number }) => {
          if (a.status === "live" && b.status !== "live") return -1;
          if (a.status !== "live" && b.status === "live") return 1;
          return a.tier - b.tier;
        });

      setScanResults({
        totalDirectories: allListings.length,
        relevant: allListings.length,
        alreadySubmitted: liveCount,
        missing: missingCount,
        findings,
      });
    } catch (err: unknown) {
      clearInterval(interval);
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setScanProgress(0);
    } finally {
      setScanning(false);
    }
  }

  async function selectPlan(plan: "basic" | "pro") {
    setSelectedPlan(plan);
    setLoading(true);
    try {
      const res = await fetch("/api/listsmartly/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lsPlan: plan }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to select plan");
      }
      toast({ title: "Plan selected", description: `${plan === "pro" ? "Pro" : "Basic"} plan activated with free trial.` });
      setStep(4);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to select plan",
        variant: "destructive",
      });
      setSelectedPlan(null);
    } finally {
      setLoading(false);
    }
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return !!(business.businessName && business.phone && business.email);
      case 1:
        return !!industry;
      case 2:
        return !!scanResults;
      case 3:
        return !!selectedPlan;
      default:
        return true;
    }
  }

  function handleNext() {
    if (step === 2 && !scanResults) {
      runScan();
      return;
    }
    if (step < STEP_CONFIG.length - 1) {
      setStep(step + 1);
    }
  }

  function handlePrev() {
    if (step > 0) setStep(step - 1);
  }

  // ── Step Renderers ──

  function renderStep0() {
    if (brandLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Tell us about your business</h2>
            <p className="text-sm text-muted-foreground">
              This info will be used across all your directory listings.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncFromBrandKit}
            disabled={brandLoading}
            className="shrink-0 gap-2"
          >
            {brandLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-teal-500" />
            )}
            Sync from Brand Kit
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="businessName"
                value={business.businessName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("businessName", e.target.value)}
                placeholder="Acme Corp"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone *</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={business.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={business.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("email", e.target.value)}
                placeholder="hello@acme.com"
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
                value={business.website}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("website", e.target.value)}
                placeholder="https://acme.com"
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
                value={business.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("address", e.target.value)}
                placeholder="123 Main St"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={business.city}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("city", e.target.value)}
              placeholder="Springfield"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={business.state}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("state", e.target.value)}
              placeholder="IL"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="zip">ZIP Code</Label>
            <Input
              id="zip"
              value={business.zip}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("zip", e.target.value)}
              placeholder="62701"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={business.country}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBusiness("country", e.target.value)}
              placeholder="US"
              className="mt-1"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderStep1() {
    const availableCategories = industry ? CATEGORY_OPTIONS[industry] || [] : [];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Select your industry</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll find the most relevant directories for your business type.
          </p>
        </div>

        <div>
          <Label htmlFor="industry">Industry *</Label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              setCategories([]);
            }}
            className="mt-1 w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select an industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        {availableCategories.length > 0 && (
          <div>
            <Label>Categories (optional)</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Select specific categories to refine your directory matches.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    categories.includes(cat)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {categories.includes(cat) && <Check className="inline h-3 w-3 mr-1" />}
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Directory Scan</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll scan 161 directories to find where your business is listed and where it&apos;s missing.
          </p>
        </div>

        {!scanResults && !scanning && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-2">Ready to scan</p>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Click &quot;Scan Now&quot; to check 161 directories for your business listings.
              </p>
              <Button onClick={runScan}>
                <Search className="h-4 w-4 mr-2" />
                Scan Now
              </Button>
            </CardContent>
          </Card>
        )}

        {scanning && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-foreground font-medium mb-2">
                  Scanning 161 directories...
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Checking Google, Yelp, Facebook, Bing, Apple Maps, and more
                </p>
                <div className="w-full max-w-md">
                  <Progress value={scanProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {Math.round(scanProgress)}% complete
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {scanResults && (
          <div className="space-y-4">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Scan Complete!</p>
                      <p className="text-sm text-muted-foreground">
                        Scanned {scanResults.totalDirectories} directories
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setScanResults(null); runScan(); }}
                    disabled={scanning}
                  >
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Re-scan
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{scanResults.relevant}</p>
                  <p className="text-sm text-muted-foreground">Relevant Directories</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-green-500">{scanResults.alreadySubmitted}</p>
                  <p className="text-sm text-muted-foreground">Already Listed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-red-500">{scanResults.missing}</p>
                  <p className="text-sm text-muted-foreground">Missing Listings</p>
                </CardContent>
              </Card>
            </div>

            {/* AI Analysis & Score — FIRST (selling pitch) */}
            <Card className="border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-cyan-500/5">
              <CardContent className="py-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-teal-500" />
                  <h3 className="font-semibold text-foreground">AI Presence Analysis</h3>
                </div>
                <div className="flex items-center gap-6 mb-5">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/50" />
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                        strokeDasharray={`${((scanResults.alreadySubmitted / Math.max(scanResults.totalDirectories, 1)) * 264)} 264`}
                        strokeLinecap="round"
                        className={scanResults.alreadySubmitted > 0 ? "text-yellow-500" : "text-red-500"} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-lg font-bold ${scanResults.alreadySubmitted > 0 ? "text-yellow-500" : "text-red-500"}`}>
                        {Math.round((scanResults.alreadySubmitted / Math.max(scanResults.totalDirectories, 1)) * 100)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {scanResults.alreadySubmitted === 0 ? "Critical: No Online Presence Detected"
                        : scanResults.alreadySubmitted < 10 ? "Poor: Minimal Online Presence"
                        : scanResults.alreadySubmitted < 30 ? "Below Average: Room for Growth"
                        : "Growing: Good Foundation"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Your business is listed on {scanResults.alreadySubmitted} of {scanResults.totalDirectories} directories
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-3 h-3 text-red-500" />
                    </div>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">{scanResults.findings?.filter(f => f.status === "missing" && f.tier === 1).length || 0} critical directories</strong> (Google, Yelp, Apple Maps) are missing — these drive 80% of local search traffic
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <BarChart3 className="w-3 h-3 text-yellow-500" />
                    </div>
                    <p className="text-muted-foreground">
                      Competitors with <strong className="text-foreground">50+ citations</strong> rank significantly higher in local search results
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 text-teal-500" />
                    </div>
                    <p className="text-muted-foreground">
                      ListSmartly can <strong className="text-foreground">submit your business to all {scanResults.missing} missing directories</strong> and monitor them with AI autopilot
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Findings List */}
            {scanResults.findings && scanResults.findings.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Detailed Findings</h3>

                {/* Live / Found listings — rich collapsible cards */}
                {scanResults.findings.filter(f => f.status === "live").length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">
                      Found ({scanResults.findings.filter(f => f.status === "live").length})
                    </p>
                    {scanResults.findings.filter(f => f.status === "live").map((f, i) => {
                      const isExpanded = expandedFindings.has(i);
                      const hasDetails = f.rating || f.address || f.phone;
                      return (
                        <Card key={i} className="border-green-500/20 bg-green-500/5 overflow-hidden">
                          <CardContent className="p-0">
                            {/* Header — always visible */}
                            <button
                              onClick={() => {
                                if (!hasDetails) return;
                                setExpandedFindings(prev => {
                                  const next = new Set(prev);
                                  next.has(i) ? next.delete(i) : next.add(i);
                                  return next;
                                });
                              }}
                              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-green-500/5 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Star className="w-4 h-4 text-green-500" />
                                <span className="font-semibold text-foreground">{f.directoryName}</span>
                                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] border-green-500/20">Found</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                {f.listingUrl && (
                                  <a
                                    href={f.listingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" /> View
                                  </a>
                                )}
                                {hasDetails && (
                                  isExpanded
                                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && hasDetails && (
                              <div className="px-4 pb-4 pt-1 border-t border-green-500/10 space-y-3">
                                {/* Rating + Reviews */}
                                {f.rating && (
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <div className="text-3xl font-black text-foreground">{f.rating}</div>
                                      <div className="text-xs text-muted-foreground">out of 5.0</div>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-0.5 mb-1">
                                        {Array.from({ length: 5 }).map((_, si) => (
                                          <Star
                                            key={si}
                                            className={`w-4 h-4 ${si < Math.round(f.rating!) ? "text-amber-400 fill-amber-400" : "text-muted fill-muted"}`}
                                          />
                                        ))}
                                      </div>
                                      {f.reviewCount !== undefined && (
                                        <p className="text-sm text-muted-foreground">
                                          <strong className="text-foreground">{f.reviewCount}</strong> Google reviews
                                        </p>
                                      )}
                                      {/* Rating bar */}
                                      <div className="mt-2 w-48">
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${((f.rating || 0) / 5) * 100}%` }}
                                          />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                                          <span>0</span>
                                          <span>Benchmark: 4.5</span>
                                          <span>5.0</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Address, Phone, Open Status */}
                                <div className="space-y-1.5 text-sm">
                                  {f.address && (
                                    <div className="flex items-start gap-2 text-muted-foreground">
                                      <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                                      <span>{f.address}</span>
                                    </div>
                                  )}
                                  {f.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Phone className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                      <a href={`tel:${f.phone}`} className="hover:text-blue-500">{f.phone}</a>
                                    </div>
                                  )}
                                  {f.listingUrl && (
                                    <div className="flex items-center gap-2">
                                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                      <a href={f.listingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                                        View on Google Maps
                                      </a>
                                    </div>
                                  )}
                                  {f.isOpenNow !== undefined && (
                                    <div className={`flex items-center gap-2 text-sm font-medium ${f.isOpenNow ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                      <div className={`w-2 h-2 rounded-full ${f.isOpenNow ? "bg-green-500" : "bg-red-500"}`} />
                                      {f.isOpenNow ? "Open now" : "Closed now"}
                                    </div>
                                  )}
                                </div>

                                {/* Show hours */}
                                {f.hours && f.hours.length > 0 && (
                                  <details className="text-xs">
                                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer">Show hours</summary>
                                    <div className="mt-1.5 space-y-0.5 pl-2">
                                      {f.hours.map((h, hi) => (
                                        <div key={hi} className="text-muted-foreground">{h}</div>
                                      ))}
                                    </div>
                                  </details>
                                )}

                                {/* Recent Customer Reviews */}
                                {f.recentReviews && f.recentReviews.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" /> Recent Customer Reviews
                                    </div>
                                    <div className="space-y-2">
                                      {f.recentReviews.map((rv, ri) => (
                                        <div key={ri} className={`rounded-lg p-3 text-xs ${rv.rating >= 4 ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
                                          <div className="flex items-center gap-2 mb-1">
                                            <div className="flex">
                                              {Array.from({ length: 5 }).map((_, si) => (
                                                <Star key={si} className={`w-3 h-3 ${si < rv.rating ? "text-amber-400 fill-amber-400" : "text-muted fill-muted"}`} />
                                              ))}
                                            </div>
                                            <span className="text-muted-foreground/60">{rv.timeAgo}</span>
                                          </div>
                                          <p className="text-foreground leading-relaxed line-clamp-3">&ldquo;{rv.text}&rdquo;</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Missing listings (show top 20 by tier importance) */}
                <Card>
                  <CardContent className="py-3">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                      Missing — Priority Directories ({Math.min(20, scanResults.findings.filter(f => f.status === "missing").length)} of {scanResults.findings.filter(f => f.status === "missing").length})
                    </p>
                    <div className="space-y-1.5">
                      {scanResults.findings.filter(f => f.status === "missing").slice(0, 20).map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <X className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-muted-foreground">{f.directoryName}</span>
                            <Badge variant="outline" className="text-[10px] h-4">Tier {f.tier}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground/60">Not listed</span>
                        </div>
                      ))}
                    </div>
                    {scanResults.findings.filter(f => f.status === "missing").length > 20 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        + {scanResults.findings.filter(f => f.status === "missing").length - 20} more missing directories (view all in dashboard)
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* AI Analysis moved to top */}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Choose your plan</h2>
          <p className="text-sm text-muted-foreground">
            Start with a free trial. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Plan */}
          <Card
            className={`relative cursor-pointer transition-all ${
              selectedPlan === "basic" ? "ring-2 ring-primary" : "hover:border-primary/50"
            }`}
            onClick={() => !loading && selectPlan("basic")}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Basic</span>
                <Badge variant="secondary">30-day free trial</Badge>
              </CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">$7</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { icon: Search, text: "Manual listing management" },
                  { icon: Shield, text: "Consistency checking" },
                  { icon: BarChart3, text: "Citation score tracking" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <item.icon className="h-4 w-4 text-primary shrink-0" />
                    {item.text}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={selectedPlan === "basic" ? "default" : "outline"}
                disabled={loading}
              >
                {loading && selectedPlan === "basic" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Start Free Trial
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card
            className={`relative cursor-pointer transition-all ${
              selectedPlan === "pro" ? "ring-2 ring-primary" : "hover:border-primary/50"
            }`}
            onClick={() => !loading && selectPlan("pro")}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">
                <Star className="h-3 w-3 mr-1" />
                Recommended
              </Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="flex items-center justify-between">
                <span>Pro</span>
                <Badge variant="secondary">14-day free trial</Badge>
              </CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">$15</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { icon: Search, text: "Everything in Basic" },
                  { icon: Sparkles, text: "AI Autopilot submissions" },
                  { icon: MessageSquare, text: "Review Command Center" },
                  { icon: FileText, text: "AI-generated reports" },
                  { icon: Zap, text: "Priority support" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <item.icon className="h-4 w-4 text-primary shrink-0" />
                    {item.text}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={selectedPlan === "pro" ? "default" : "outline"}
                disabled={loading}
              >
                {loading && selectedPlan === "pro" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Start Free Trial
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <Rocket className="h-10 w-10 text-green-500" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">You&apos;re all set!</h2>
          <p className="text-muted-foreground max-w-md">
            Your ListSmartly profile is ready. We&apos;ve identified your directory opportunities and
            your {selectedPlan === "pro" ? "Pro" : "Basic"} trial is active.
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardContent className="py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Business</span>
              <span className="text-foreground font-medium">{business.businessName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Industry</span>
              <span className="text-foreground font-medium">{industry}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Directories Found</span>
              <span className="text-foreground font-medium">{scanResults?.relevant || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="secondary">{selectedPlan === "pro" ? "Pro" : "Basic"} Trial</Badge>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" onClick={() => router.push("/listsmartly/dashboard")}>
          Go to Dashboard
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  // ── Render ──

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-6 lg:px-8 w-full">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {STEP_CONFIG.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={`text-xs mt-1.5 hidden sm:block ${
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <Progress value={((step + 1) / STEP_CONFIG.length) * 100} className="h-1.5" />
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="py-6">{stepRenderers[step]()}</CardContent>
      </Card>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handlePrev} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {step !== 3 && (
            <Button onClick={handleNext} disabled={!canAdvance() && step !== 2}>
              {step === 2 && !scanResults ? (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Scan Now
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
