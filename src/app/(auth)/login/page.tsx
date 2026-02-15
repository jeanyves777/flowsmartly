"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginIllustration } from "@/components/illustrations/login-illustration";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const isAgentFlow = redirectTo === "/agent/apply";
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
            title: "Login failed",
            description: data.error?.message || "Invalid credentials",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.data.user.name}`,
      });

      // Redirect to intended page or dashboard
      router.push(redirectTo || "/dashboard");
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
      illustration={<LoginIllustration />}
      {...(isAgentFlow ? {
        gradientFrom: "from-violet-600",
        gradientVia: "via-violet-500",
        gradientTo: "to-brand-500",
      } : {})}
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
              Agent Login
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Sign in to apply as Agent</h1>
            <p className="text-muted-foreground mt-2">
              Log in to your existing account to complete your agent application
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-2">
              Enter your credentials to access your account
            </p>
          </div>
        )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-brand-500 hover:text-brand-600"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              disabled={isLoading}
              autoComplete="current-password"
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
        </div>

        <Button type="submit" className={`w-full ${isAgentFlow ? "bg-violet-600 hover:bg-violet-700" : ""}`} size="lg" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : isAgentFlow ? (
            <>
              <Briefcase className="h-4 w-4 mr-2" />
              Sign in & Apply as Agent
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"}
            className="font-medium text-brand-500 hover:text-brand-600"
          >
            Create an account
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
