"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Check, X, Briefcase, CheckCircle, Gift, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterIllustration } from "@/components/illustrations/register-illustration";
import { REGIONS } from "@/lib/constants/regions";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const refCode = searchParams.get("ref");
  const isAgentFlow = redirectTo === "/agent/apply";
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(!!refCode);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    country: "",
    referralCode: refCode || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate referral code on mount if present
  useEffect(() => {
    if (refCode) {
      fetch(`/api/referrals/check/${encodeURIComponent(refCode)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.valid) {
            setReferrerName(data.data.referrerName);
          }
        })
        .catch(() => {});
    }
  }, [refCode]);

  // Password strength indicators
  const passwordChecks = {
    length: formData.password.length >= 8,
    lowercase: /[a-z]/.test(formData.password),
    uppercase: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Client-side validation
    if (!formData.country) {
      setErrors((prev) => ({ ...prev, country: "Please select your country" }));
      setIsLoading(false);
      return;
    }

    try {
      // Only include referralCode if it has a value
      const payload = {
        ...formData,
        referralCode: formData.referralCode || undefined,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.details) {
          const fieldErrors: Record<string, string> = {};
          Object.entries(data.error.details).forEach(([key, value]) => {
            fieldErrors[key] = Array.isArray(value) ? value[0] : String(value);
          });
          setErrors(fieldErrors);
        } else {
          toast({
            title: "Registration failed",
            description: data.error?.message || "Something went wrong",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Account created!",
        description: "Welcome to FlowSmartly. Let's get started.",
      });

      router.push(redirectTo || data.data?.redirectTo || "/dashboard");
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      illustration={<RegisterIllustration />}
      gradientFrom={isAgentFlow ? "from-violet-600" : "from-violet-600"}
      gradientVia={isAgentFlow ? "via-violet-500" : "via-fuchsia-600"}
      gradientTo={isAgentFlow ? "to-brand-500" : "to-pink-500"}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {isAgentFlow ? (
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-sm font-medium mb-4">
              <Briefcase className="w-4 h-4" />
              Agent Registration
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Become a FlowSmartly Agent</h1>
            <p className="text-muted-foreground mt-2">
              Create your account first, then complete your agent application
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-violet-500 shrink-0" />
                <span>Free agent plan with full feature access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-violet-500 shrink-0" />
                <span>Manage clients and earn from your services</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-violet-500 shrink-0" />
                <span>Get listed on the marketplace after approval</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
            <p className="text-muted-foreground mt-2">
              Start your journey with AI-powered content creation
            </p>
          </div>
        )}

        {/* Referral badge */}
        {referrerName && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          >
            <Gift className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">
              Referred by <strong>{referrerName}</strong>
            </span>
          </motion.div>
        )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            disabled={isLoading}
            autoComplete="name"
            required
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            disabled={isLoading}
            autoComplete="email"
            required
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              disabled={isLoading}
              autoComplete="username"
              className="pl-8"
              required
            />
          </div>
          {errors.username && (
            <p className="text-sm text-destructive">{errors.username}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              disabled={isLoading}
              autoComplete="new-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}

          {/* Password strength indicator */}
          {formData.password && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <PasswordCheck
                  passed={passwordChecks.length}
                  label="At least 8 characters"
                />
                <PasswordCheck
                  passed={passwordChecks.lowercase}
                  label="Lowercase letter"
                />
                <PasswordCheck
                  passed={passwordChecks.uppercase}
                  label="Uppercase letter"
                />
                <PasswordCheck
                  passed={passwordChecks.number}
                  label="Number"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            name="country"
            value={formData.country}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, country: e.target.value }));
              if (errors.country) setErrors(prev => ({ ...prev, country: "" }));
            }}
            disabled={isLoading}
            required
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
          {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
        </div>

        {/* Referral code field */}
        {refCode ? (
          <div className="space-y-2">
            <Label htmlFor="referralCode">Referral Code</Label>
            <Input
              id="referralCode"
              name="referralCode"
              type="text"
              value={formData.referralCode}
              disabled
              className="bg-muted"
            />
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setShowReferralInput(!showReferralInput)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>Have a referral code?</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReferralInput ? "rotate-180" : ""}`} />
            </button>
            {showReferralInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="mt-2 overflow-hidden"
              >
                <Input
                  id="referralCode"
                  name="referralCode"
                  type="text"
                  placeholder="REF-XXXXXXXX"
                  value={formData.referralCode}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </motion.div>
            )}
          </div>
        )}

        <Button type="submit" className={`w-full ${isAgentFlow ? "bg-violet-600 hover:bg-violet-700" : ""}`} size="lg" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : isAgentFlow ? (
            <>
              <Briefcase className="h-4 w-4 mr-2" />
              Create Account & Apply as Agent
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"}
          className="font-medium text-brand-500 hover:text-brand-600"
        >
          Sign in
        </Link>
      </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  );
}

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        passed ? "text-success" : "text-muted-foreground"
      }`}
    >
      {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  );
}
