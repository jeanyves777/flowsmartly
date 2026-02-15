"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginIllustration } from "@/components/illustrations/login-illustration";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<
    "loading" | "invalid" | "valid" | "success"
  >("loading");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const allChecksPassed = Object.values(passwordChecks).every(Boolean);

  const validateToken = useCallback(async () => {
    if (!token) {
      setErrorMessage("No reset token provided.");
      setStatus("invalid");
      return;
    }

    try {
      const response = await fetch(
        `/api/auth/reset-password?token=${encodeURIComponent(token)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(
          data.error?.message || "This reset link is invalid or has expired."
        );
        setStatus("invalid");
        return;
      }

      setMaskedEmail(data.data?.email || "");
      setStatus("valid");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("invalid");
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!allChecksPassed) {
      setErrors({ password: "Please meet all password requirements" });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.code === "INVALID_TOKEN") {
          setErrorMessage(
            data.error.message || "This reset link is invalid or has expired."
          );
          setStatus("invalid");
        } else {
          toast({
            title: "Error",
            description: data.error?.message || "Something went wrong",
            variant: "destructive",
          });
        }
        return;
      }

      setStatus("success");
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
    <AuthShell illustration={<LoginIllustration />}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="mt-4 text-sm text-muted-foreground">
              Validating reset link...
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Invalid or expired link
            </h1>
            <p className="text-muted-foreground mt-3 text-sm">
              {errorMessage}
            </p>
            <div className="mt-8 space-y-3">
              <Link href="/forgot-password" className="block">
                <Button className="w-full" size="lg">
                  Request a new link
                </Button>
              </Link>
              <Link href="/login" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === "valid" && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                Set a new password
              </h1>
              <p className="text-muted-foreground mt-2">
                Enter a new password for{" "}
                <span className="font-medium text-foreground">
                  {maskedEmail}
                </span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password)
                        setErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    error={errors.password}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="pr-10"
                    autoFocus
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

                {password && (
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
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword)
                        setErrors((prev) => ({
                          ...prev,
                          confirmPassword: "",
                        }));
                    }}
                    error={errors.confirmPassword}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetting password...
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>
            </form>
          </>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Password reset successfully!
            </h1>
            <p className="text-muted-foreground mt-3 text-sm">
              Your password has been updated and all other sessions have been
              signed out. You can now sign in with your new password.
            </p>
            <Link href="/login">
              <Button className="mt-8 w-full" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        )}
      </motion.div>
    </AuthShell>
  );
}

function PasswordCheck({
  passed,
  label,
}: {
  passed: boolean;
  label: string;
}) {
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell illustration={<LoginIllustration />}>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        </AuthShell>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
