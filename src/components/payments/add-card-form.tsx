"use client";

import { useState, useEffect } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2, CreditCard, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AddCardFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCardForm({ open, onClose, onSuccess }: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSecret, setIsFetchingSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch SetupIntent clientSecret when modal opens
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      return;
    }

    async function fetchSetupIntent() {
      setIsFetchingSecret(true);
      setError(null);
      try {
        const response = await fetch("/api/payments/methods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        if (data.success && data.data.clientSecret) {
          setClientSecret(data.data.clientSecret);
        } else {
          setError(data.error?.message || "Failed to initialize card form");
        }
      } catch {
        setError("Failed to connect to payment service");
      } finally {
        setIsFetchingSecret(false);
      }
    }

    fetchSetupIntent();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !clientSecret) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (result.error) {
        setError(result.error.message || "Failed to save card");
      } else {
        // Notify server to send security email + in-app notification
        const pmId = typeof result.setupIntent.payment_method === "string"
          ? result.setupIntent.payment_method
          : result.setupIntent.payment_method?.id;

        if (pmId) {
          fetch("/api/payments/methods/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentMethodId: pmId }),
          }).catch(() => {}); // Fire-and-forget
        }

        onSuccess();
        onClose();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500" />
            Add Payment Method
          </DialogTitle>
          <DialogDescription>
            Enter your card details below. Your information is securely processed by Stripe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isFetchingSecret ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 border rounded-xl bg-background">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: "16px",
                        color: "#1a1a1a",
                        "::placeholder": { color: "#a3a3a3" },
                        fontFamily: "system-ui, -apple-system, sans-serif",
                      },
                      invalid: { color: "#ef4444" },
                    },
                  }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5 text-green-500" />
                <span>Secured with 256-bit SSL encryption by Stripe</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!stripe || !clientSecret || isLoading || isFetchingSecret}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Card"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
