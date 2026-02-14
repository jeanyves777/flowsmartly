"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Search,
  MapPin,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  MessageSquare,
  Globe,
  Sparkles,
  Shield,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  monthlyRentalCost: number;
}

interface CurrentNumber {
  hasNumber: boolean;
  phoneNumber: string | null;
  sid: string | null;
  verified: boolean;
}

// Pricing constants
const PHONE_NUMBER_RENTAL_COST = 500; // $5.00/month in cents
const SMS_COST = 5; // $0.05 per SMS in cents
const MMS_COST = 10; // $0.10 per MMS in cents
const CREDITS_PER_DOLLAR = 20; // 1 credit = $0.05

const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
];

export default function PhoneNumberPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Current number state
  const [currentNumber, setCurrentNumber] = useState<CurrentNumber | null>(null);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);

  // Search state
  const [searchCountry, setSearchCountry] = useState("US");
  const [searchAreaCode, setSearchAreaCode] = useState("");
  const [searchContains, setSearchContains] = useState("");
  const [numberType, setNumberType] = useState<"all" | "local" | "tollFree" | "mobile">("local");
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Rent state
  const [rentingNumber, setRentingNumber] = useState<string | null>(null);
  const [confirmNumber, setConfirmNumber] = useState<AvailableNumber | null>(null);

  // User credits
  const [userCredits, setUserCredits] = useState<number>(0);

  // Fetch current number status
  const fetchCurrentNumber = useCallback(async () => {
    try {
      setIsLoadingCurrent(true);
      const response = await fetch("/api/sms/numbers?action=current");
      const data = await response.json();

      if (data.success) {
        setCurrentNumber({
          hasNumber: data.data.hasNumber || false,
          phoneNumber: data.data.phoneNumber || null,
          sid: data.data.sid || null,
          verified: data.data.verified || false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch current number:", error);
    } finally {
      setIsLoadingCurrent(false);
    }
  }, []);

  // Fetch user credits
  const fetchUserCredits = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (data.success && data.data?.user) {
        setUserCredits(data.data.user.aiCredits || 0);
      }
    } catch (error) {
      console.error("Failed to fetch user credits:", error);
    }
  }, []);

  useEffect(() => {
    fetchCurrentNumber();
    fetchUserCredits();
  }, [fetchCurrentNumber, fetchUserCredits]);

  // If user already has a number, redirect to settings
  useEffect(() => {
    if (!isLoadingCurrent && currentNumber?.hasNumber) {
      router.push("/settings/sms-marketing");
    }
  }, [isLoadingCurrent, currentNumber, router]);

  // Search for available numbers
  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        country: searchCountry,
        numberType,
        limit: "20",
      });
      if (searchAreaCode) params.set("areaCode", searchAreaCode);
      if (searchContains) params.set("contains", searchContains);

      const response = await fetch(`/api/sms/numbers?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to search numbers");
      }

      setAvailableNumbers(data.data.numbers || []);
    } catch (err) {
      toast({
        title: "Search failed",
        description: err instanceof Error ? err.message : "Failed to search numbers",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Show confirmation dialog before renting
  const handleRentNumber = (number: AvailableNumber) => {
    if (userCredits < requiredCredits) {
      toast({
        title: "Insufficient credits",
        description: `You need ${requiredCredits} credits to rent a phone number. You have ${userCredits}.`,
        variant: "destructive",
      });
      return;
    }
    setConfirmNumber(number);
  };

  // Actually rent the number after confirmation
  const handleConfirmRent = async () => {
    if (!confirmNumber) return;

    setRentingNumber(confirmNumber.phoneNumber);
    setConfirmNumber(null);

    try {
      const response = await fetch("/api/sms/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: confirmNumber.phoneNumber }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to rent number");
      }

      toast({
        title: "Phone number activated!",
        description: `${data.data.phoneNumber} is now ready for SMS campaigns.`,
      });

      // Redirect to SMS marketing settings
      router.push("/settings/sms-marketing");
    } catch (err) {
      toast({
        title: "Failed to rent number",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRentingNumber(null);
    }
  };

  const requiredCredits = Math.ceil((PHONE_NUMBER_RENTAL_COST / 100) * CREDITS_PER_DOLLAR);
  const hasEnoughCredits = userCredits >= requiredCredits;

  if (isLoadingCurrent) {
    return (
      <div className="flex-1 flex flex-col space-y-6 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings/sms-marketing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            Get a Phone Number
          </h1>
          <p className="text-muted-foreground mt-1">
            Choose a dedicated phone number for your SMS marketing campaigns
          </p>
        </div>
      </div>

      {/* Credits Warning */}
      {!hasEnoughCredits && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Insufficient Credits</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              You need {requiredCredits} credits to rent a phone number. You have {userCredits} credits.
            </span>
            <Button size="sm" variant="outline" asChild className="ml-4">
              <Link href="/settings?tab=billing">Buy Credits</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">SMS & MMS</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Send text messages and rich media to your audience
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Dedicated Number</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your own number that customers can recognize
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Instant Setup</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Start sending campaigns within minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Find Your Number
          </CardTitle>
          <CardDescription>
            Search for available phone numbers by country, area code, or specific digits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={searchCountry} onValueChange={setSearchCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Number Type</Label>
              <Select value={numberType} onValueChange={(v) => setNumberType(v as typeof numberType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tollFree">Toll-Free</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area Code (optional)</Label>
              <Input
                placeholder="e.g. 415, 212"
                value={searchAreaCode}
                onChange={(e) => setSearchAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>

            <div className="space-y-2">
              <Label>Contains (optional)</Label>
              <Input
                placeholder="e.g. 1234"
                value={searchContains}
                onChange={(e) => setSearchContains(e.target.value.replace(/\D/g, "").slice(0, 7))}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search Numbers
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Popular Area Codes */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Popular:</span>
            {["212", "415", "310", "305", "512", "702"].map((code) => (
              <button
                key={code}
                onClick={() => {
                  setSearchAreaCode(code);
                  setSearchCountry("US");
                }}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  searchAreaCode === code
                    ? "border-green-500 bg-green-500/10 text-green-600"
                    : "border-border hover:border-green-500/50 hover:bg-muted/50"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Available Numbers
              </span>
              {availableNumbers.length > 0 && (
                <Badge variant="secondary">{availableNumbers.length} found</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSearching ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : availableNumbers.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-semibold mb-2">No numbers found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Try adjusting your search criteria. Remove the area code or contains filter for more results.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => {
                  setSearchAreaCode("");
                  setSearchContains("");
                  handleSearch();
                }}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Search All Numbers
                </Button>
              </div>
            ) : (
              <>
                {/* Warning if no SMS-capable numbers */}
                {availableNumbers.length > 0 && !availableNumbers.some(n => n.capabilities.sms) && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No SMS-Capable Numbers Available</AlertTitle>
                    <AlertDescription>
                      All numbers found are voice-only. Try searching for <strong>Toll-Free</strong> numbers instead, which typically have SMS capability. If the issue persists, please contact support.
                    </AlertDescription>
                  </Alert>
                )}

                {/* SMS count summary */}
                {availableNumbers.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {availableNumbers.filter(n => n.capabilities.sms).length} of {availableNumbers.length} numbers have SMS capability
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableNumbers.map((number) => {
                    const hasSms = number.capabilities.sms;
                    return (
                      <motion.div
                        key={number.phoneNumber}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          !hasSms
                            ? "border-border/50 opacity-60"
                            : rentingNumber === number.phoneNumber
                              ? "border-green-500 bg-green-500/5"
                              : "border-border hover:border-green-500/50 hover:bg-muted/30"
                        }`}
                      >
                        {/* Number type badge — always visible */}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          {number.locality ? (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-600 font-semibold">
                              LOCAL
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-600 font-semibold">
                              TOLL-FREE
                            </Badge>
                          )}
                          {!hasSms && (
                            <Badge variant="outline" className="text-[10px] bg-yellow-500/10 border-yellow-500/30 text-yellow-600">
                              Voice Only
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              hasSms
                                ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20"
                                : "bg-muted"
                            }`}>
                              <Phone className={`w-6 h-6 ${hasSms ? "text-green-600" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <p className="text-lg font-mono font-bold">{number.phoneNumber}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {number.locality || "Toll-Free"}, {number.region || number.isoCountry}
                              </p>
                            </div>
                          </div>

                          <div className="text-right mt-5">
                            <p className={`text-lg font-bold ${hasSms ? "text-green-600" : "text-muted-foreground"}`}>
                              ${(number.monthlyRentalCost / 100).toFixed(2)}
                              <span className="text-xs font-normal text-muted-foreground">/mo</span>
                            </p>
                          </div>
                        </div>

                        {/* Capabilities */}
                        <div className="flex items-center gap-2 mt-3">
                          {number.capabilities.sms ? (
                            <Badge variant="outline" className="text-xs bg-blue-500/5 border-blue-500/30 text-blue-600">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              SMS
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-red-500/5 border-red-500/30 text-red-500">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              No SMS
                            </Badge>
                          )}
                          {number.capabilities.mms && (
                            <Badge variant="outline" className="text-xs bg-purple-500/5 border-purple-500/30 text-purple-600">
                              <Sparkles className="w-3 h-3 mr-1" />
                              MMS
                            </Badge>
                          )}
                          {number.capabilities.voice && (
                            <Badge variant="outline" className="text-xs bg-orange-500/5 border-orange-500/30 text-orange-600">
                              <Phone className="w-3 h-3 mr-1" />
                              Voice
                            </Badge>
                          )}
                        </div>

                        {/* Rent Button */}
                        {hasSms ? (
                          <Button
                            className="w-full mt-4 bg-green-600 hover:bg-green-700"
                            onClick={() => handleRentNumber(number)}
                            disabled={rentingNumber !== null || !hasEnoughCredits}
                          >
                            {rentingNumber === number.phoneNumber ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Activating...
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Get This Number
                              </>
                            )}
                          </Button>
                        ) : (
                          <p className="mt-4 text-center text-xs text-muted-foreground py-2">
                            Not available for SMS campaigns
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing Info — compact inline */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">Pricing:</span>
        </span>
        <span>Number <span className="font-medium text-foreground">${(PHONE_NUMBER_RENTAL_COST / 100).toFixed(2)}/mo</span></span>
        <span className="hidden sm:inline text-border">|</span>
        <span>SMS <span className="font-medium text-foreground">${(SMS_COST / 100).toFixed(2)}/msg</span></span>
        <span className="hidden sm:inline text-border">|</span>
        <span>MMS <span className="font-medium text-foreground">${(MMS_COST / 100).toFixed(2)}/msg</span></span>
        <span className="hidden sm:inline text-border">|</span>
        <span>Balance: <span className={`font-medium ${hasEnoughCredits ? "text-green-600" : "text-red-500"}`}>{userCredits} credits</span></span>
      </div>
      {/* Confirmation Dialog */}
      <Dialog open={!!confirmNumber} onOpenChange={(open) => !open && setConfirmNumber(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-600" />
              Confirm Phone Number Rental
            </DialogTitle>
            <DialogDescription>
              Review the details below before activating this number.
            </DialogDescription>
          </DialogHeader>

          {confirmNumber && (
            <div className="space-y-4 py-2">
              {/* Number */}
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <p className="text-2xl font-mono font-bold">{confirmNumber.phoneNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {confirmNumber.locality || "Toll-Free"}, {confirmNumber.region || confirmNumber.isoCountry}
                </p>
              </div>

              {/* Capabilities */}
              <div>
                <p className="text-sm font-medium mb-2">Capabilities</p>
                <div className="flex items-center gap-2">
                  {confirmNumber.capabilities.sms && (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                      <MessageSquare className="w-3 h-3 mr-1" /> SMS
                    </Badge>
                  )}
                  {confirmNumber.capabilities.mms && (
                    <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                      <Sparkles className="w-3 h-3 mr-1" /> MMS
                    </Badge>
                  )}
                  {confirmNumber.capabilities.voice && (
                    <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                      <Phone className="w-3 h-3 mr-1" /> Voice
                    </Badge>
                  )}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Cost Breakdown</p>
                <div className="p-3 rounded-lg bg-muted/30 border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly rental</span>
                    <span className="font-medium">${(PHONE_NUMBER_RENTAL_COST / 100).toFixed(2)}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits charged now</span>
                    <span className="font-medium">{requiredCredits} credits</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SMS per message</span>
                    <span className="font-medium">${(SMS_COST / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MMS per message</span>
                    <span className="font-medium">${(MMS_COST / 100).toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="font-medium">{userCredits} credits</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">After rental</span>
                    <span className="font-medium text-green-600">{userCredits - requiredCredits} credits remaining</span>
                  </div>
                </div>
              </div>

              {/* Toll-free verification notice */}
              {confirmNumber.phoneNumber.match(/^\+1(800|833|844|855|866|877|888)/) && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Toll-Free Verification Required
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Toll-free numbers require carrier verification before sending messages. We&apos;ll auto-submit verification using your compliance data. Review takes 1-5 business days.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Your number will be charged {requiredCredits} credits monthly. You can release the number at any time from SMS Marketing settings.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmNumber(null)}>
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmRent}>
              <Check className="w-4 h-4 mr-2" />
              Confirm & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
