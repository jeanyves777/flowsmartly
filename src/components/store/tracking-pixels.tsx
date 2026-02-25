"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface TrackingPixelsProps {
  facebookPixelId?: string;
  googleTagId?: string;
  tiktokPixelId?: string;
  pinterestTagId?: string;
}

// Extend window type for pixel globals
declare global {
  interface Window {
    __fsPixels?: TrackingPixelsProps;
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: { track: (...args: unknown[]) => void; page: () => void };
    pintrk?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Fire a pixel event across all configured platforms.
 * Call from any component: window.__fsFirePixelEvent?.("ViewContent", { ... })
 */
function firePixelEvent(
  eventName: string,
  data: Record<string, unknown> = {}
) {
  // Facebook
  if (window.fbq) {
    try {
      window.fbq("track", eventName, data);
    } catch {}
  }

  // Google Analytics
  if (window.gtag) {
    const gaMap: Record<string, string> = {
      ViewContent: "view_item",
      AddToCart: "add_to_cart",
      InitiateCheckout: "begin_checkout",
      Purchase: "purchase",
    };
    try {
      window.gtag("event", gaMap[eventName] || eventName, data);
    } catch {}
  }

  // TikTok
  if (window.ttq) {
    const ttMap: Record<string, string> = {
      Purchase: "CompletePayment",
    };
    try {
      window.ttq.track(ttMap[eventName] || eventName, data);
    } catch {}
  }

  // Pinterest
  if (window.pintrk) {
    const pinMap: Record<string, string> = {
      ViewContent: "pagevisit",
      AddToCart: "addtocart",
      InitiateCheckout: "checkout",
      Purchase: "checkout",
    };
    try {
      window.pintrk("track", pinMap[eventName] || eventName, data);
    } catch {}
  }
}

export default function TrackingPixels({
  facebookPixelId,
  googleTagId,
  tiktokPixelId,
  pinterestTagId,
}: TrackingPixelsProps) {
  const pathname = usePathname();

  // Initialize pixels on mount
  useEffect(() => {
    // Store pixel config globally so other components can check what's active
    window.__fsPixels = { facebookPixelId, googleTagId, tiktokPixelId, pinterestTagId };

    // Also expose the fire function globally
    (window as any).__fsFirePixelEvent = firePixelEvent;

    // Facebook Pixel
    if (facebookPixelId && !window.fbq) {
      const script = document.createElement("script");
      script.innerHTML = `
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${facebookPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
    }

    // Google Tag
    if (googleTagId && !window.gtag) {
      const gtagScript = document.createElement("script");
      gtagScript.async = true;
      gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`;
      document.head.appendChild(gtagScript);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", googleTagId);
    }

    // TikTok Pixel
    if (tiktokPixelId && !window.ttq) {
      const script = document.createElement("script");
      script.innerHTML = `
        !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
        ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
        ttq._o=ttq._o||{};ttq._o[e]=n||{};
        var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
        var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${tiktokPixelId}');
        ttq.page();
        }(window,document,'ttq');
      `;
      document.head.appendChild(script);
    }

    // Pinterest Tag
    if (pinterestTagId && !window.pintrk) {
      const script = document.createElement("script");
      script.innerHTML = `
        !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
        var n=window.pintrk;n.queue=[],n.version="3.0";
        var t=document.createElement("script");t.async=!0,t.src=e;
        var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
        pintrk('load','${pinterestTagId}');
        pintrk('page');
      `;
      document.head.appendChild(script);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire PageView on route changes (SPA navigation)
  useEffect(() => {
    if (window.fbq) window.fbq("track", "PageView");
    if (window.ttq) window.ttq.page();
    if (window.pintrk) window.pintrk("track", "pagevisit");
    // gtag auto-tracks with config
  }, [pathname]);

  return null; // This component renders nothing visible
}
