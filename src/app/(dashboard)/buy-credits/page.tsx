"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Package,
  CreditCard,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Shield,
  Zap,
  Plus,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { useStripe } from "@stripe/react-stripe-js";
import { StripeProvider } from "@/components/providers/stripe-provider";
import { AddCardForm } from "@/components/payments/add-card-form";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus: number;
  priceCents: number;
  label: string;
  priceFormatted: string;
  isPopular: boolean;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

type Step = "select" | "payment" | "review";

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "select", label: "Select Package", icon: Package },
  { id: "payment", label: "Payment Method", icon: CreditCard },
  { id: "review", label: "Review & Confirm", icon: Check },
];

export default function BuyCreditsPage() {
  return (
    <StripeProvider>
      <BuyCreditsContent />
    </StripeProvider>
  );
}

function BuyCreditsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("select");
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [currentCredits, setCurrentCredits] = useState<number>(0);

  // Pre-select package from query param
  useEffect(() => {
    const pkg = searchParams.get("package");
    if (pkg) setSelectedPackageId(pkg);
  }, [searchParams]);

  // Fetch credit packages
  useEffect(() => {
    async function fetchPackages() {
      try {
        setPackagesLoading(true);
        const response = await fetch("/api/payments/packages");
        const data = await response.json();
        if (data.success) {
          setPackages(data.data.creditPackages);
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load credit packages",
          variant: "destructive",
        });
      } finally {
        setPackagesLoading(false);
      }
    }
    fetchPackages();
  }, [toast]);

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    try {
      setPaymentMethodsLoading(true);
      const response = await fetch("/api/payments/methods");
      const data = await response.json();
      if (data.success) {
        const methods = data.data.paymentMethods || [];
        setPaymentMethods(methods);
        // Auto-select default payment method
        const defaultMethod = methods.find((m: PaymentMethod) => m.isDefault);
        if (defaultMethod) {
          setSelectedPaymentMethodId(defaultMethod.id);
        } else if (methods.length > 0) {
          setSelectedPaymentMethodId(methods[0].id);
        }
      }
    } catch {
      console.error("Failed to fetch payment methods");
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // Fetch current credits
  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/users/profile");
        const data = await response.json();
        if (data.success) {
          setCurrentCredits(data.data.user.aiCredits || 0);
        }
      } catch {
        // Non-critical
      }
    }
    fetchProfile();
  }, []);

  // Handle card added callback
  const handleCardAdded = useCallback(() => {
    fetchPaymentMethods();
    toast({
      title: "Payment method added!",
      description: "Your card has been saved. You can now complete your purchase.",
    });
  }, [fetchPaymentMethods, toast]);

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const selectedPaymentMethod = paymentMethods.find(
    (m) => m.id === selectedPaymentMethodId
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleNext = () => {
    if (step === "select" && selectedPackageId) {
      setStep("payment");
    } else if (step === "payment" && selectedPaymentMethodId) {
      setStep("review");
    }
  };

  const handleBack = () => {
    if (step === "payment") setStep("select");
    else if (step === "review") setStep("payment");
  };

  const handleAddPaymentMethod = () => {
    setShowAddCardModal(true);
  };

  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const stripeInstance = useStripe();

  const handleConfirmPurchase = async () => {
    if (!selectedPackageId || !selectedPaymentMethodId) return;

    setIsCheckingOut(true);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "credit_purchase",
          packageId: selectedPackageId,
          paymentMethodId: selectedPaymentMethodId,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Payment failed");
      }

      // Handle 3DS authentication if required
      if (data.data.requiresAction && data.data.clientSecret && stripeInstance) {
        const { error } = await stripeInstance.confirmCardPayment(data.data.clientSecret);
        if (error) {
          throw new Error(error.message || "Payment authentication failed");
        }
      }

      // Payment succeeded — update balance from response or re-fetch
      if (data.data.newBalance) {
        setCurrentCredits(data.data.newBalance);
      } else {
        // Fallback: re-fetch profile for updated balance
        try {
          const profileRes = await fetch("/api/users/profile");
          const profileData = await profileRes.json();
          if (profileData.success) {
            setCurrentCredits(profileData.data.user.aiCredits || 0);
          }
        } catch { /* non-critical */ }
      }

      setPurchaseSuccess(true);
      const totalAdded = data.data.creditsAdded || ((selectedPackage?.credits ?? 0) + (selectedPackage?.bonus ?? 0));
      toast({
        title: "Purchase successful!",
        description: `${totalAdded.toLocaleString()} credits have been added to your account.`,
      });
    } catch (err) {
      toast({
        title: "Payment failed",
        description:
          err instanceof Error ? err.message : "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getPerCreditCost = (pkg: CreditPackage) => {
    const totalCredits = pkg.credits + pkg.bonus;
    return (pkg.priceCents / totalCredits / 100).toFixed(3);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings?tab=billing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            Buy Credits
          </h1>
          <p className="text-muted-foreground mt-1">
            Purchase credits to power AI features, cartoons, SMS, and more
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isCompleted = i < stepIndex;
          const StepIcon = s.icon;

          return (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => {
                  if (isCompleted) {
                    setStep(s.id);
                  }
                }}
                disabled={!isCompleted && !isActive}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full",
                  isActive &&
                    "bg-brand-500 text-white shadow-md",
                  isCompleted &&
                    "bg-green-500/10 text-green-600 hover:bg-green-500/20 cursor-pointer",
                  !isActive &&
                    !isCompleted &&
                    "bg-muted text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    isActive && "bg-white/20",
                    isCompleted && "bg-green-500/20",
                    !isActive && !isCompleted && "bg-muted-foreground/10"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Credits Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-500/5 border border-brand-500/20">
        <Zap className="w-5 h-5 text-brand-500 shrink-0" />
        <span className="text-sm">
          Current balance:{" "}
          <span className="font-bold">{currentCredits.toLocaleString()} credits</span>
        </span>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Select Package */}
        {step === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand-500" />
                  Choose a Credit Package
                </CardTitle>
                <CardDescription>
                  Select the credit package that fits your needs. Larger packages include bonus credits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {packagesLoading ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-48" />
                    ))}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {packages.map((pkg) => {
                      const isSelected = selectedPackageId === pkg.id;
                      const totalCredits = pkg.credits + pkg.bonus;

                      return (
                        <button
                          key={pkg.id}
                          onClick={() => setSelectedPackageId(pkg.id)}
                          className={cn(
                            "relative p-5 rounded-xl border-2 text-left transition-all hover:shadow-md",
                            isSelected
                              ? "border-brand-500 bg-brand-500/5 shadow-md"
                              : "border-border hover:border-brand-500/50"
                          )}
                        >
                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}

                          {/* Popular badge */}
                          {pkg.isPopular && (
                            <Badge className="absolute top-3 left-3 bg-amber-500/10 text-amber-600 border-amber-500/20">
                              Most Popular
                            </Badge>
                          )}

                          <div className={cn("mt-1", pkg.isPopular && "mt-8")}>
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-5 h-5 text-brand-500" />
                              <span className="font-semibold">{pkg.label}</span>
                            </div>

                            <p className="text-3xl font-bold">
                              {pkg.priceFormatted}
                            </p>

                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Base credits
                                </span>
                                <span className="font-medium">
                                  {pkg.credits.toLocaleString()}
                                </span>
                              </div>
                              {pkg.bonus > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-green-600">
                                    Bonus credits
                                  </span>
                                  <span className="font-medium text-green-600">
                                    +{pkg.bonus.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              <div className="border-t pt-1.5 flex items-center justify-between text-sm">
                                <span className="font-medium">Total credits</span>
                                <span className="font-bold">
                                  {totalCredits.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                ${getPerCreditCost(pkg)} per credit
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next button */}
            <div className="flex justify-end">
              <Button
                onClick={handleNext}
                disabled={!selectedPackageId}
                size="lg"
              >
                Continue to Payment
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Payment Method */}
        {step === "payment" && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  Select Payment Method
                </CardTitle>
                <CardDescription>
                  Choose a saved payment method or add a new one to continue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentMethodsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl">
                    <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-lg mb-1">
                      No Payment Method Found
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      You need to add a payment method before purchasing credits.
                      Your card details are securely stored by Stripe.
                    </p>
                    <Button onClick={handleAddPaymentMethod}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Payment Method
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => {
                      const isSelected =
                        selectedPaymentMethodId === method.id;

                      return (
                        <button
                          key={method.id}
                          onClick={() =>
                            setSelectedPaymentMethodId(method.id)
                          }
                          className={cn(
                            "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                            isSelected
                              ? "border-brand-500 bg-brand-500/5"
                              : "border-border hover:border-brand-500/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-12 h-12 rounded-lg flex items-center justify-center",
                              isSelected
                                ? "bg-brand-500 text-white"
                                : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                            )}
                          >
                            <CreditCard className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium flex items-center gap-2">
                              <span className="capitalize">{method.brand}</span>{" "}
                              ending in {method.last4}
                              {method.isDefault && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  Default
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Expires {method.expMonth}/{method.expYear}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* Add new card */}
                    <button
                      onClick={handleAddPaymentMethod}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-border hover:border-brand-500/50 text-left transition-all"
                    >
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Add a new card</p>
                        <p className="text-sm text-muted-foreground">
                          Securely save a new payment method
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security note */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <Shield className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Your payment information is securely processed by Stripe. We never store your card details.
              </span>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!selectedPaymentMethodId}
                size="lg"
              >
                Review Order
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Purchase Success */}
        {purchaseSuccess && selectedPackage && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Purchase Successful!</h2>
                <p className="text-muted-foreground mb-1">
                  {(selectedPackage.credits + selectedPackage.bonus).toLocaleString()} credits have been added to your account.
                </p>
                <p className="text-lg font-semibold text-brand-500 mb-6">
                  New balance: {currentCredits.toLocaleString()} credits
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" asChild>
                    <Link href="/credits/history">View History</Link>
                  </Button>
                  <Button
                    onClick={() => {
                      setPurchaseSuccess(false);
                      setStep("select");
                      setSelectedPackageId(null);
                    }}
                  >
                    Buy More Credits
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === "review" && !purchaseSuccess && selectedPackage && selectedPaymentMethod && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Review Your Order
                </CardTitle>
                <CardDescription>
                  Please review the details below before confirming your purchase.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Package summary */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-brand-500/5 to-purple-500/5 border border-brand-500/20">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                    Credit Package
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-brand-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">
                          {selectedPackage.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPackage.credits.toLocaleString()} credits
                          {selectedPackage.bonus > 0 &&
                            ` + ${selectedPackage.bonus.toLocaleString()} bonus`}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedPackage.priceFormatted}
                    </p>
                  </div>
                </div>

                {/* Payment method */}
                <div className="p-5 rounded-xl bg-muted/50 border">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                    Payment Method
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">
                        <span className="capitalize">
                          {selectedPaymentMethod.brand}
                        </span>{" "}
                        ending in {selectedPaymentMethod.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {selectedPaymentMethod.expMonth}/
                        {selectedPaymentMethod.expYear}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order summary */}
                <div className="p-5 rounded-xl border space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                    Order Summary
                  </h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedPackage.credits.toLocaleString()} credits
                    </span>
                    <span>{formatPrice(selectedPackage.priceCents)}</span>
                  </div>
                  {selectedPackage.bonus > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">
                        Bonus credits ({selectedPackage.bonus.toLocaleString()})
                      </span>
                      <span className="text-green-600">FREE</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold">
                      {formatPrice(selectedPackage.priceCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-3">
                    <span className="text-muted-foreground">
                      Credits after purchase
                    </span>
                    <span className="font-bold text-brand-500">
                      {(
                        currentCredits +
                        selectedPackage.credits +
                        selectedPackage.bonus
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confirm button */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleConfirmPurchase}
                disabled={isCheckingOut}
                size="lg"
                className="bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Confirm Purchase — {selectedPackage.priceFormatted}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Card Modal */}
      <AddCardForm
        open={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        onSuccess={handleCardAdded}
      />
    </motion.div>
  );
}
