"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing verification token");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error?.message || "Verification failed");
        }
      } catch {
        setStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/send-verification", {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Verification email sent",
          description: "Check your inbox for a new verification link.",
        });
      } else {
        toast({
          title: "Failed to send",
          description: data.error?.message || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
          <h1 className="text-2xl font-bold">Verifying your email...</h1>
          <p className="text-muted-foreground">Please wait while we verify your email address.</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold">Email Verified!</h1>
          <p className="text-muted-foreground">
            Your email has been successfully verified. You now have full access to all features.
          </p>
          <Button asChild className="mt-4" size="lg">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Verification Failed</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button onClick={handleResend} disabled={isResending} variant="default">
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
