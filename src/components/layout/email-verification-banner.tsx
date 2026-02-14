"use client";

import { useState } from "react";
import { Mail, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  if (!isVisible) return null;

  const handleSendVerification = async () => {
    setIsSending(true);
    try {
      const response = await fetch("/api/auth/send-verification", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        setIsSent(true);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Mail className="h-5 w-5 text-amber-600 shrink-0" />
        {isSent ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-amber-800">
              Check your inbox! A verification link has been sent.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSent(false);
                handleSendVerification();
              }}
              className="text-amber-700 hover:text-amber-900 h-auto py-1 px-2"
            >
              Resend
            </Button>
          </div>
        ) : (
          <span className="text-sm text-amber-800">
            Please verify your email to access all features.
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isSent && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendVerification}
            disabled={isSending}
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            {isSending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Sending...
              </>
            ) : (
              "Send Verification Email"
            )}
          </Button>
        )}
        <button
          onClick={() => setIsVisible(false)}
          className="text-amber-400 hover:text-amber-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
