"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginIllustration } from "@/components/illustrations/login-illustration";

export default function ForgotPasswordPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error?.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitted(true);
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
        {isSubmitted ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10">
              <Mail className="h-8 w-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Check your email
            </h1>
            <p className="text-muted-foreground mt-3 text-sm">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{email}</span>, we
              sent a password reset link. The link expires in 1 hour.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Don&apos;t see it? Check your spam folder.
            </p>
            <Link href="/login">
              <Button variant="outline" className="mt-8 w-full" size="lg">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                Forgot your password?
              </h1>
              <p className="text-muted-foreground mt-2">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                  required
                />
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
                    Sending reset link...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-medium text-brand-500 hover:text-brand-600"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </AuthShell>
  );
}
