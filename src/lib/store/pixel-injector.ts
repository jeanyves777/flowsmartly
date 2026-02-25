/**
 * Pixel script injection helpers for store pages.
 * Generates base scripts and event-firing code for retargeting pixels.
 */

export interface PixelConfig {
  facebookPixelId?: string;
  googleTagId?: string;
  tiktokPixelId?: string;
  pinterestTagId?: string;
}

/**
 * Get base initialization scripts for all configured pixels.
 * Returns an array of script strings to be injected into the page head.
 */
export function getPixelBaseScripts(pixels: PixelConfig): string[] {
  const scripts: string[] = [];

  if (pixels.facebookPixelId) {
    scripts.push(`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixels.facebookPixelId}');
      fbq('track', 'PageView');
    `);
  }

  if (pixels.googleTagId) {
    scripts.push(`
      (function(){
        var s=document.createElement('script');
        s.async=true;
        s.src='https://www.googletagmanager.com/gtag/js?id=${pixels.googleTagId}';
        document.head.appendChild(s);
        window.dataLayer=window.dataLayer||[];
        function gtag(){dataLayer.push(arguments);}
        window.gtag=gtag;
        gtag('js',new Date());
        gtag('config','${pixels.googleTagId}');
      })();
    `);
  }

  if (pixels.tiktokPixelId) {
    scripts.push(`
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
      ttq.load('${pixels.tiktokPixelId}');
      ttq.page();
      }(window,document,'ttq');
    `);
  }

  if (pixels.pinterestTagId) {
    scripts.push(`
      !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
      var n=window.pintrk;n.queue=[],n.version="3.0";
      var t=document.createElement("script");t.async=!0,t.src=e;
      var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
      pintrk('load','${pixels.pinterestTagId}');
      pintrk('page');
    `);
  }

  return scripts;
}

/**
 * Event data for pixel tracking
 */
export interface PixelEventData {
  contentId?: string;
  contentName?: string;
  contentCategory?: string;
  contentType?: string;
  value?: number;
  currency?: string;
  contents?: Array<{ id: string; quantity: number; price: number }>;
  numItems?: number;
}

/**
 * Build JS code to fire a specific event across all configured pixels.
 */
export function buildPixelEventCode(
  eventName: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase",
  data: PixelEventData,
  pixels: PixelConfig
): string {
  const parts: string[] = [];

  if (pixels.facebookPixelId) {
    const fbData: Record<string, unknown> = {};
    if (data.contentId) fbData.content_ids = [data.contentId];
    if (data.contentName) fbData.content_name = data.contentName;
    if (data.contentCategory) fbData.content_category = data.contentCategory;
    if (data.contentType) fbData.content_type = data.contentType || "product";
    if (data.value !== undefined) fbData.value = data.value;
    if (data.currency) fbData.currency = data.currency;
    if (data.contents) fbData.contents = data.contents;
    if (data.numItems !== undefined) fbData.num_items = data.numItems;
    parts.push(`if(typeof fbq!=='undefined'){fbq('track','${eventName}',${JSON.stringify(fbData)});}`);
  }

  if (pixels.googleTagId) {
    const gaEventMap: Record<string, string> = {
      ViewContent: "view_item",
      AddToCart: "add_to_cart",
      InitiateCheckout: "begin_checkout",
      Purchase: "purchase",
    };
    const gaData: Record<string, unknown> = {};
    if (data.value !== undefined) gaData.value = data.value;
    if (data.currency) gaData.currency = data.currency;
    if (data.contents) {
      gaData.items = data.contents.map((c) => ({
        item_id: c.id,
        quantity: c.quantity,
        price: c.price,
      }));
    }
    parts.push(`if(typeof gtag!=='undefined'){gtag('event','${gaEventMap[eventName]}',${JSON.stringify(gaData)});}`);
  }

  if (pixels.tiktokPixelId) {
    const ttEventMap: Record<string, string> = {
      ViewContent: "ViewContent",
      AddToCart: "AddToCart",
      InitiateCheckout: "InitiateCheckout",
      Purchase: "CompletePayment",
    };
    const ttData: Record<string, unknown> = {};
    if (data.contentId) ttData.content_id = data.contentId;
    if (data.contentName) ttData.content_name = data.contentName;
    if (data.value !== undefined) ttData.value = data.value;
    if (data.currency) ttData.currency = data.currency;
    if (data.contents) ttData.contents = data.contents;
    parts.push(`if(typeof ttq!=='undefined'){ttq.track('${ttEventMap[eventName]}',${JSON.stringify(ttData)});}`);
  }

  if (pixels.pinterestTagId) {
    const pinEventMap: Record<string, string> = {
      ViewContent: "pagevisit",
      AddToCart: "addtocart",
      InitiateCheckout: "checkout",
      Purchase: "checkout",
    };
    const pinData: Record<string, unknown> = {};
    if (data.value !== undefined) pinData.value = data.value;
    if (data.currency) pinData.currency = data.currency;
    if (data.contents) {
      pinData.line_items = data.contents.map((c) => ({
        product_id: c.id,
        product_quantity: c.quantity,
        product_price: c.price,
      }));
    }
    parts.push(`if(typeof pintrk!=='undefined'){pintrk('track','${pinEventMap[eventName]}',${JSON.stringify(pinData)});}`);
  }

  return parts.join("\n");
}
