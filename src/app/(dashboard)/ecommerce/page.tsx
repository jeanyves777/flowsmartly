"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Store,
  Package,
  Truck,
  CreditCard,
  BarChart3,
  Loader2,
  Check,
  ArrowRight,
  Globe,
  Palette,
  Brain,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { StripeProvider } from "@/components/providers/stripe-provider";
import { SubscriptionCheckoutModal } from "@/components/ecommerce/subscription-checkout-modal";

interface StoreData {
  id: string;
  ecomSubscriptionStatus: string;
  setupComplete: boolean;
  isActive: boolean;
}

const FEATURES = [
  {
    icon: Store,
    label: "Beautiful Storefront",
    desc: "10 premium themes, custom colors, fonts, and layouts",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Package,
    label: "Product Management",
    desc: "Variants, inventory tracking, bulk uploads, categories",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: CreditCard,
    label: "Secure Payments",
    desc: "Stripe integration, regional payment methods, COD support",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Truck,
    label: "Delivery & Tracking",
    desc: "Driver management, real-time GPS, status updates",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: Brain,
    label: "AI Intelligence",
    desc: "Dynamic pricing, SEO optimizer, product copy generator",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: BarChart3,
    label: "Analytics Dashboard",
    desc: "Revenue charts, top products, conversion tracking",
    color: "from-indigo-500 to-blue-600",
  },
];

const HIGHLIGHTS = [
  { icon: Globe, label: "Multi-region support", detail: "US, Europe, Africa, Asia" },
  { icon: Palette, label: "10 Store Themes", detail: "Modern, Minimal, Bold & more" },
  { icon: Sparkles, label: "AI Product Photos", detail: "Auto-enhance & generate" },
  { icon: TrendingUp, label: "Google Trends", detail: "Market intelligence built-in" },
  { icon: Shield, label: "Secure Checkout", detail: "PCI compliant via Stripe" },
  { icon: Zap, label: "Instant Setup", detail: "Live in under 5 minutes" },
];

export default function EcommercePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [store, setStore] = useState<StoreData | null>(null);

  useEffect(() => {
    fetchStore();
  }, []);

  async function fetchStore() {
    try {
      const res = await fetch("/api/ecommerce/store");
      const json = await res.json();

      if (json.success && json.data.hasStore) {
        const s = json.data.store;
        setStore(s);

        const isSubscribed = s.ecomSubscriptionStatus === "active" || s.ecomSubscriptionStatus === "trialing";
        if (isSubscribed && s.setupComplete) {
          router.replace("/ecommerce/dashboard");
          return;
        }
        if (isSubscribed && !s.setupComplete) {
          router.replace("/ecommerce/onboarding");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to fetch store:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleCheckoutSuccess() {
    toast({
      title: "FlowShop activated!",
      description: "Your 14-day free trial has started. Let's set up your store.",
    });
    setCheckoutOpen(false);
    router.push("/ecommerce/onboarding");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading FlowShop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-20">
      {/* ── Hero Section ── */}
      <section className="relative text-center pt-8">
        {/* Animated background gradient */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>

        {/* Animated store icon */}
        <div className="relative inline-flex mb-6">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-[float_3s_ease-in-out_infinite]">
            <ShoppingBag className="h-12 w-12 text-white" />
          </div>
          {/* Orbiting dots */}
          <div className="absolute inset-0 animate-[spin_8s_linear_infinite]">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite_reverse]">
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="absolute inset-0 animate-[spin_10s_linear_infinite]">
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 h-2 w-2 rounded-full bg-pink-400" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
          FlowShop
        </h1>
        <p className="mt-3 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Launch your online store in minutes. AI-powered product management,
          beautiful themes, and built-in intelligence to grow your business.
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-emerald-500" /> Secure Payments
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-500" /> 10 Themes
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-blue-500" /> AI-Powered
          </span>
        </div>
      </section>

      {/* ── Store Preview SVG ── */}
      <section className="relative">
        <div className="rounded-2xl border bg-card overflow-hidden shadow-xl">
          <svg viewBox="0 0 1200 600" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
              <linearGradient id="cardGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f0f9ff" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </linearGradient>
              <linearGradient id="cardGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fdf4ff" />
                <stop offset="100%" stopColor="#fae8ff" />
              </linearGradient>
              <linearGradient id="cardGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f0fdf4" />
                <stop offset="100%" stopColor="#dcfce7" />
              </linearGradient>
              <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Browser chrome */}
            <rect x="0" y="0" width="1200" height="600" rx="12" fill="#f8fafc" />
            <rect x="0" y="0" width="1200" height="40" rx="12" fill="#f1f5f9" />
            <rect x="0" y="28" width="1200" height="12" fill="#f1f5f9" />
            <circle cx="20" cy="18" r="6" fill="#ef4444" opacity="0.7" />
            <circle cx="40" cy="18" r="6" fill="#eab308" opacity="0.7" />
            <circle cx="60" cy="18" r="6" fill="#22c55e" opacity="0.7" />
            <rect x="300" y="10" width="600" height="20" rx="10" fill="#e2e8f0" />
            <text x="480" y="24" fontSize="10" fill="#94a3b8" fontFamily="system-ui">flowshop.flowsmartly.com/your-store</text>

            {/* Store header */}
            <rect x="0" y="40" width="1200" height="60" fill="url(#headerGrad)" />
            <text x="40" y="77" fontSize="20" fill="white" fontWeight="bold" fontFamily="system-ui">MyStore</text>
            <text x="220" y="75" fontSize="13" fill="rgba(255,255,255,0.8)" fontFamily="system-ui">Products</text>
            <text x="310" y="75" fontSize="13" fill="rgba(255,255,255,0.8)" fontFamily="system-ui">Categories</text>
            <text x="420" y="75" fontSize="13" fill="rgba(255,255,255,0.8)" fontFamily="system-ui">About</text>
            {/* Cart icon */}
            <rect x="1100" y="60" width="70" height="28" rx="14" fill="rgba(255,255,255,0.2)" />
            <text x="1115" y="78" fontSize="12" fill="white" fontFamily="system-ui">Cart (3)</text>

            {/* Hero banner */}
            <rect x="30" y="115" width="1140" height="160" rx="12" fill="url(#headerGrad)" opacity="0.08" />
            <text x="80" y="175" fontSize="28" fill="#1e1b4b" fontWeight="bold" fontFamily="system-ui">Summer Collection 2026</text>
            <text x="80" y="205" fontSize="14" fill="#6b7280" fontFamily="system-ui">Discover our latest products with free shipping on orders over $50</text>
            <rect x="80" y="225" width="140" height="36" rx="18" fill="url(#btnGrad)">
              <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" />
            </rect>
            <text x="115" y="248" fontSize="13" fill="white" fontWeight="600" fontFamily="system-ui">Shop Now</text>

            {/* Animated sparkle near CTA */}
            <g transform="translate(235, 235)">
              <path d="M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z" fill="#eab308">
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite" />
              </path>
            </g>

            {/* Product cards row */}
            {/* Product 1 */}
            <rect x="30" y="300" width="270" height="270" rx="12" fill="url(#cardGrad1)" stroke="#e2e8f0" strokeWidth="1">
              <animate attributeName="y" values="300;295;300" dur="3s" repeatCount="indefinite" />
            </rect>
            <rect x="50" y="315" width="230" height="140" rx="8" fill="#bfdbfe" opacity="0.5" />
            <text x="120" y="395" fontSize="40" fill="#3b82f6" opacity="0.6" fontFamily="system-ui">T</text>
            <text x="50" y="480" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Premium T-Shirt</text>
            <text x="50" y="500" fontSize="13" fill="#6b7280" fontFamily="system-ui">Organic cotton blend</text>
            <text x="50" y="525" fontSize="16" fill="#7c3aed" fontWeight="bold" fontFamily="system-ui">$29.99</text>
            <rect x="190" y="510" width="80" height="28" rx="14" fill="url(#btnGrad)" opacity="0.9" />
            <text x="207" y="528" fontSize="11" fill="white" fontFamily="system-ui">Add</text>

            {/* Product 2 */}
            <rect x="320" y="300" width="270" height="270" rx="12" fill="url(#cardGrad2)" stroke="#e2e8f0" strokeWidth="1">
              <animate attributeName="y" values="300;295;300" dur="3s" begin="0.5s" repeatCount="indefinite" />
            </rect>
            <rect x="340" y="315" width="230" height="140" rx="8" fill="#f5d0fe" opacity="0.4" />
            <text x="415" y="395" fontSize="40" fill="#a855f7" opacity="0.6" fontFamily="system-ui">S</text>
            <text x="340" y="480" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Sneaker Pro</text>
            <text x="340" y="500" fontSize="13" fill="#6b7280" fontFamily="system-ui">Limited edition</text>
            <text x="340" y="525" fontSize="16" fill="#7c3aed" fontWeight="bold" fontFamily="system-ui">$89.00</text>
            <rect x="480" y="510" width="80" height="28" rx="14" fill="url(#btnGrad)" opacity="0.9" />
            <text x="497" y="528" fontSize="11" fill="white" fontFamily="system-ui">Add</text>

            {/* Product 3 */}
            <rect x="610" y="300" width="270" height="270" rx="12" fill="url(#cardGrad3)" stroke="#e2e8f0" strokeWidth="1">
              <animate attributeName="y" values="300;295;300" dur="3s" begin="1s" repeatCount="indefinite" />
            </rect>
            <rect x="630" y="315" width="230" height="140" rx="8" fill="#bbf7d0" opacity="0.4" />
            <text x="705" y="395" fontSize="40" fill="#22c55e" opacity="0.6" fontFamily="system-ui">W</text>
            <text x="630" y="480" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Smart Watch X</text>
            <text x="630" y="500" fontSize="13" fill="#6b7280" fontFamily="system-ui">Fitness & health</text>
            <text x="630" y="525" fontSize="16" fill="#7c3aed" fontWeight="bold" fontFamily="system-ui">$199.00</text>
            <rect x="770" y="510" width="80" height="28" rx="14" fill="url(#btnGrad)" opacity="0.9" />
            <text x="787" y="528" fontSize="11" fill="white" fontFamily="system-ui">Add</text>

            {/* Stats sidebar */}
            <rect x="910" y="300" width="260" height="130" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="930" y="330" fontSize="12" fill="#6b7280" fontFamily="system-ui">Revenue Today</text>
            <text x="930" y="358" fontSize="24" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">$1,247.50</text>
            <text x="1060" y="358" fontSize="12" fill="#22c55e" fontWeight="600" fontFamily="system-ui">+12.4%</text>
            {/* Mini chart */}
            <polyline
              points="930,400 960,390 990,395 1020,380 1050,385 1080,370 1110,360 1140,350 1155,355"
              fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"
            >
              <animate attributeName="stroke-dashoffset" from="300" to="0" dur="2s" fill="freeze" />
              <animate attributeName="stroke-dasharray" from="0 300" to="300 0" dur="2s" fill="freeze" />
            </polyline>
            <path
              d="M930,400 L960,390 L990,395 L1020,380 L1050,385 L1080,370 L1110,360 L1140,350 L1155,355 L1155,410 L930,410 Z"
              fill="url(#chartGrad)" opacity="0.5"
            >
              <animate attributeName="opacity" from="0" to="0.5" dur="2s" fill="freeze" />
            </path>

            {/* Orders count */}
            <rect x="910" y="445" width="125" height="125" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="930" y="475" fontSize="12" fill="#6b7280" fontFamily="system-ui">Orders</text>
            <text x="930" y="508" fontSize="28" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">48</text>
            <text x="930" y="530" fontSize="11" fill="#22c55e" fontFamily="system-ui">+8 today</text>
            <circle cx="1005" cy="520" r="25" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle cx="1005" cy="520" r="25" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeDasharray="110 157" strokeLinecap="round" transform="rotate(-90 1005 520)">
              <animate attributeName="stroke-dasharray" from="0 157" to="110 157" dur="1.5s" fill="freeze" />
            </circle>

            {/* Products count */}
            <rect x="1045" y="445" width="125" height="125" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="1065" y="475" fontSize="12" fill="#6b7280" fontFamily="system-ui">Products</text>
            <text x="1065" y="508" fontSize="28" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">124</text>
            <text x="1065" y="530" fontSize="11" fill="#3b82f6" fontFamily="system-ui">3 categories</text>
          </svg>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">Everything you need to sell online</h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            From product management to AI-powered pricing — FlowShop gives you the tools to compete with the big players.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.label}
              className="group relative rounded-2xl border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Gradient accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity`} />

              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{feature.label}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Highlights Bar ── */}
      <section className="rounded-2xl border bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-indigo-950/30 p-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="text-center">
              <div className="h-10 w-10 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center mx-auto mb-2">
                <h.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-sm font-medium">{h.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{h.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Activation Card ── */}
      <section id="activate" className="max-w-lg mx-auto">
        <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-card shadow-xl overflow-hidden">
          {/* Card header gradient */}
          <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600 px-8 py-6 text-center text-white">
            <ShoppingBag className="h-10 w-10 mx-auto mb-2" />
            <h2 className="text-2xl font-bold">Start Selling Today</h2>
            <p className="text-white/80 text-sm mt-1">14-day free trial — no charge today</p>
          </div>

          <div className="p-8">
            {/* Price */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-3">
                14-Day Free Trial
              </div>
              <div className="inline-flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">$5&ndash;$12</span>
                <span className="text-muted-foreground text-lg">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Choose Basic or Pro when you subscribe</p>
              <p className="text-xs text-muted-foreground mt-0.5">After trial ends. Cancel anytime.</p>
            </div>

            {/* What you get */}
            <div className="space-y-3 mb-6">
              {[
                "Unlimited products & categories",
                "10 premium store themes",
                "Stripe payments integration",
                "AI product copy & image tools",
                "Analytics & intelligence dashboard",
                "Customer email notifications",
                "Delivery tracking system",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            {/* Activate Button — opens the confirmation modal */}
            <Button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-12 text-base bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 shadow-lg shadow-violet-500/25"
              size="lg"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-3">
              Card required. You will not be charged during the 14-day trial.
            </p>
          </div>
        </div>
      </section>

      {/* Subscription Checkout Modal */}
      <StripeProvider>
        <SubscriptionCheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      </StripeProvider>

      {/* ── Dashboard Preview SVG ── */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold">Powerful Analytics Dashboard</h2>
          <p className="text-muted-foreground mt-2">Track revenue, orders, and customer insights in real-time</p>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden shadow-xl">
          <svg viewBox="0 0 1200 500" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="revenueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ordersGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect width="1200" height="500" fill="#f8fafc" />

            {/* Header */}
            <text x="40" y="45" fontSize="22" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">Analytics Overview</text>
            <rect x="1000" y="22" width="60" height="30" rx="6" fill="#7c3aed" opacity="0.1" />
            <text x="1013" y="42" fontSize="12" fill="#7c3aed" fontWeight="600" fontFamily="system-ui">30d</text>
            <rect x="1070" y="22" width="60" height="30" rx="6" fill="#f1f5f9" />
            <text x="1086" y="42" fontSize="12" fill="#94a3b8" fontFamily="system-ui">90d</text>

            {/* Stat cards */}
            {/* Revenue */}
            <rect x="40" y="70" width="260" height="90" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="65" y="100" fontSize="12" fill="#6b7280" fontFamily="system-ui">Total Revenue</text>
            <text x="65" y="130" fontSize="26" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">$24,890</text>
            <rect x="210" y="108" width="65" height="22" rx="11" fill="#dcfce7" />
            <text x="222" y="123" fontSize="11" fill="#16a34a" fontWeight="600" fontFamily="system-ui">+18.2%</text>

            {/* Orders */}
            <rect x="320" y="70" width="260" height="90" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="345" y="100" fontSize="12" fill="#6b7280" fontFamily="system-ui">Orders</text>
            <text x="345" y="130" fontSize="26" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">342</text>
            <rect x="490" y="108" width="65" height="22" rx="11" fill="#dcfce7" />
            <text x="503" y="123" fontSize="11" fill="#16a34a" fontWeight="600" fontFamily="system-ui">+24.5%</text>

            {/* AOV */}
            <rect x="600" y="70" width="260" height="90" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="625" y="100" fontSize="12" fill="#6b7280" fontFamily="system-ui">Avg Order Value</text>
            <text x="625" y="130" fontSize="26" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">$72.78</text>

            {/* Conversion */}
            <rect x="880" y="70" width="280" height="90" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="905" y="100" fontSize="12" fill="#6b7280" fontFamily="system-ui">Conversion Rate</text>
            <text x="905" y="130" fontSize="26" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">3.8%</text>
            <rect x="1070" y="108" width="65" height="22" rx="11" fill="#dcfce7" />
            <text x="1082" y="123" fontSize="11" fill="#16a34a" fontWeight="600" fontFamily="system-ui">+0.6%</text>

            {/* Revenue Chart */}
            <rect x="40" y="180" width="760" height="300" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="65" y="210" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Revenue Over Time</text>

            {/* Grid lines */}
            <line x1="80" y1="240" x2="770" y2="240" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="80" y1="290" x2="770" y2="290" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="80" y1="340" x2="770" y2="340" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="80" y1="390" x2="770" y2="390" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="80" y1="440" x2="770" y2="440" stroke="#f1f5f9" strokeWidth="1" />

            {/* Revenue area */}
            <path
              d="M80,420 L150,390 L220,400 L290,370 L360,350 L430,310 L500,330 L570,290 L640,260 L710,240 L770,250 L770,440 L80,440 Z"
              fill="url(#revenueGrad)"
            >
              <animate attributeName="opacity" from="0" to="1" dur="1s" fill="freeze" />
            </path>
            <polyline
              points="80,420 150,390 220,400 290,370 360,350 430,310 500,330 570,290 640,260 710,240 770,250"
              fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="2s" fill="freeze" />
              <animate attributeName="stroke-dasharray" from="0 1000" to="1000 0" dur="2s" fill="freeze" />
            </polyline>

            {/* Data point pulse */}
            <circle cx="770" cy="250" r="4" fill="#8b5cf6" />
            <circle cx="770" cy="250" r="8" fill="#8b5cf6" opacity="0.3">
              <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* X axis labels */}
            <text x="80" y="465" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Jan 24</text>
            <text x="220" y="465" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Jan 28</text>
            <text x="360" y="465" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Feb 1</text>
            <text x="500" y="465" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Feb 8</text>
            <text x="640" y="465" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Feb 15</text>
            <text x="740" y="465" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Feb 22</text>

            {/* Top Products */}
            <rect x="820" y="180" width="340" height="300" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="845" y="210" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Top Products</text>

            {/* Product bars */}
            <text x="845" y="248" fontSize="12" fill="#475569" fontFamily="system-ui">Premium T-Shirt</text>
            <rect x="845" y="255" width="200" height="8" rx="4" fill="#ede9fe" />
            <rect x="845" y="255" width="200" height="8" rx="4" fill="#8b5cf6">
              <animate attributeName="width" from="0" to="200" dur="1s" fill="freeze" />
            </rect>
            <text x="1055" y="264" fontSize="11" fill="#6b7280" fontFamily="system-ui">$4,280</text>

            <text x="845" y="296" fontSize="12" fill="#475569" fontFamily="system-ui">Sneaker Pro</text>
            <rect x="845" y="303" width="200" height="8" rx="4" fill="#ede9fe" />
            <rect x="845" y="303" width="160" height="8" rx="4" fill="#a78bfa">
              <animate attributeName="width" from="0" to="160" dur="1s" begin="0.2s" fill="freeze" />
            </rect>
            <text x="1055" y="312" fontSize="11" fill="#6b7280" fontFamily="system-ui">$3,560</text>

            <text x="845" y="344" fontSize="12" fill="#475569" fontFamily="system-ui">Smart Watch X</text>
            <rect x="845" y="351" width="200" height="8" rx="4" fill="#ede9fe" />
            <rect x="845" y="351" width="140" height="8" rx="4" fill="#c4b5fd">
              <animate attributeName="width" from="0" to="140" dur="1s" begin="0.4s" fill="freeze" />
            </rect>
            <text x="1055" y="360" fontSize="11" fill="#6b7280" fontFamily="system-ui">$2,890</text>

            <text x="845" y="392" fontSize="12" fill="#475569" fontFamily="system-ui">Leather Bag</text>
            <rect x="845" y="399" width="200" height="8" rx="4" fill="#ede9fe" />
            <rect x="845" y="399" width="110" height="8" rx="4" fill="#ddd6fe">
              <animate attributeName="width" from="0" to="110" dur="1s" begin="0.6s" fill="freeze" />
            </rect>
            <text x="1055" y="408" fontSize="11" fill="#6b7280" fontFamily="system-ui">$1,940</text>

            <text x="845" y="440" fontSize="12" fill="#475569" fontFamily="system-ui">Wireless Earbuds</text>
            <rect x="845" y="447" width="200" height="8" rx="4" fill="#ede9fe" />
            <rect x="845" y="447" width="80" height="8" rx="4" fill="#ede9fe">
              <animate attributeName="width" from="0" to="80" dur="1s" begin="0.8s" fill="freeze" />
            </rect>
            <text x="1055" y="456" fontSize="11" fill="#6b7280" fontFamily="system-ui">$1,220</text>
          </svg>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to start selling?</h2>
        <p className="text-muted-foreground mb-6">Join FlowShop and launch your online store today.</p>
        <Button
          onClick={() => document.getElementById("activate")?.scrollIntoView({ behavior: "smooth" })}
          size="lg"
          className="h-12 px-8 text-base bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 shadow-lg shadow-violet-500/25"
        >
          Get Started
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </section>

      {/* Float animation keyframe */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
