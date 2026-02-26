"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface WhatsAppConnectProps {
  onSuccess: () => void;
  buttonText?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
  icon?: "connect" | "refresh";
}

export function WhatsAppConnect({
  onSuccess,
  buttonText = "Connect WhatsApp Business",
  variant = "default",
  size = "lg",
  className,
  icon = "connect",
}: WhatsAppConnectProps) {
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // If FB SDK already loaded
    if (window.FB) {
      setSdkReady(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      setSdkReady(true);
    };

    // Load SDK script if not already present
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Listen for Embedded Signup session events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      )
        return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          if (data.event === "FINISH") {
            console.log("[WhatsApp Embedded Signup] Completed:", data.data);
          } else if (data.event === "CANCEL") {
            console.log("[WhatsApp Embedded Signup] Cancelled by user");
            setLoading(false);
          } else if (data.event === "ERROR") {
            console.error("[WhatsApp Embedded Signup] Error:", data.data);
            setLoading(false);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleConnect = useCallback(() => {
    if (!sdkReady || !window.FB) {
      toast({
        title: "Loading...",
        description: "Facebook SDK is still loading. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    window.FB.login(
      async function (response: any) {
        if (response.authResponse) {
          const code = response.authResponse.code;

          try {
            const res = await fetch("/api/social/whatsapp/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });

            const data = await res.json();

            if (data.success) {
              toast({
                title: "WhatsApp Connected!",
                description: `Connected ${data.accountsFound} phone number${data.accountsFound > 1 ? "s" : ""} successfully.`,
              });
              onSuccess();
            } else {
              toast({
                title: "Connection Failed",
                description: data.error || "Failed to connect WhatsApp Business account.",
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error("[WhatsApp Connect] Exchange error:", error);
            toast({
              title: "Connection Failed",
              description: "Something went wrong connecting your WhatsApp account. Please try again.",
              variant: "destructive",
            });
          }
        } else {
          // User cancelled or popup was closed
          console.log("[WhatsApp Connect] Login cancelled or failed");
        }
        setLoading(false);
      },
      {
        scope: "whatsapp_business_management,whatsapp_business_messaging",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          sessionInfoVersion: 2,
        },
      }
    );
  }, [sdkReady, toast, onSuccess]);

  const IconComponent = icon === "refresh" ? RefreshCw : MessageSquare;

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleConnect}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <IconComponent className="w-4 h-4 mr-2" />
      )}
      {loading ? "Connecting..." : buttonText}
    </Button>
  );
}
