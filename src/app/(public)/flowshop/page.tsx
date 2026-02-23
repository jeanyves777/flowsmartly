import type { Metadata } from "next";
import Link from "next/link";
import {
  Palette,
  Package,
  CreditCard,
  Truck,
  Brain,
  BarChart3,
  ArrowRight,
  Check,
  ShoppingBag,
  Zap,
  TrendingUp,
  Search,
  Star,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "FlowShop — AI-Powered Online Store",
  description:
    "Launch a beautiful, fully-featured online store in minutes with AI-powered product copy, dynamic pricing, SEO optimization, and 10 professional themes. Start your free trial today.",
};

const features = [
  {
    icon: Palette,
    title: "Beautiful Storefront",
    description:
      "10 professional themes with full customization. Your brand, your colors, your store — looking stunning on every device.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Package,
    title: "Product Management",
    description:
      "Easy catalog management with variants, inventory tracking, bulk import, and rich product pages with galleries.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description:
      "Stripe-powered checkout with PCI compliance. Accept credit cards, debit cards, and regional payment methods.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Truck,
    title: "Delivery & Tracking",
    description:
      "Real-time order tracking, automated status updates, delivery notifications, and multiple shipping options.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Brain,
    title: "AI Intelligence",
    description:
      "Dynamic pricing, SEO optimizer, Google Trends integration, and product recommendations — all powered by AI.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Revenue tracking, order analytics, conversion rates, top products, customer insights, and growth metrics.",
    gradient: "from-indigo-500 to-violet-500",
  },
];

const steps = [
  {
    number: "01",
    title: "Set Up Your Store",
    description:
      "5-minute onboarding: choose your theme, add your logo, set your currency and shipping regions. Your store is live instantly.",
    icon: ShoppingBag,
  },
  {
    number: "02",
    title: "Add Products",
    description:
      "Upload product photos and let AI generate compelling descriptions. Enhance images, set pricing, and organize your catalog.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Start Selling",
    description:
      "Share your store link, accept payments securely, track orders in real-time, and grow your business with AI insights.",
    icon: Zap,
  },
];

const aiFeatures = [
  {
    icon: TrendingUp,
    title: "Dynamic Pricing",
    description: "AI analyzes market conditions and adjusts pricing to maximize revenue and stay competitive.",
  },
  {
    icon: Search,
    title: "SEO Optimizer",
    description: "Automatic meta tags, structured data, and keyword optimization for better search rankings.",
  },
  {
    icon: BarChart3,
    title: "Google Trends",
    description: "Real-time trend data to identify hot products and optimize your catalog timing.",
  },
  {
    icon: Star,
    title: "Smart Recommendations",
    description: "AI suggests product bundles, cross-sells, and personalized recommendations for customers.",
  },
];

const basicFeatures = [
  "Full AI store",
  "Product management with AI",
  "Google Trends & discovery",
  "Competitor pricing",
  "Ad feed integration",
  "Mobile-first storefront",
  "AI recommendations",
  "Region-aware payments",
  "Free subdomain",
  "Connect your own domain",
];

const proFeatures = [
  "Everything in Basic, plus:",
  "1 FREE domain (.com, .store, .shop)",
  "Domain auto-config + SSL",
  "WHOIS privacy",
  "Priority AI processing",
  "Advanced analytics",
  "AI customer chatbot",
  "Abandoned cart recovery",
  "Free domain renewal while subscribed",
];

export default function FlowShopPage() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl"
            style={{ animation: "float-orb 8s ease-in-out infinite" }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl"
            style={{ animation: "float-orb 10s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-purple-500/5 blur-3xl"
            style={{ animation: "float-orb 6s ease-in-out infinite 1s" }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-sm font-medium mb-6">
            <ShoppingBag className="w-4 h-4" />
            FlowShop E-Commerce
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Your{" "}
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              AI-Powered
            </span>{" "}
            Online Store
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Launch a beautiful, fully-featured online store in minutes. AI-powered product copy,
            dynamic pricing, SEO optimization, and 10 professional themes — everything you need to
            sell online.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login?redirect=/ecommerce"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/25"
            >
              Start Your Store
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-accent transition-colors"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Store Preview SVG */}
      <section className="px-4 sm:px-6 lg:px-8 -mt-8 mb-20">
        <div className="max-w-4xl mx-auto">
          <svg viewBox="0 0 800 480" className="w-full rounded-2xl shadow-2xl shadow-violet-500/10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="fsp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
              <linearGradient id="fsp-bg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </linearGradient>
              <linearGradient id="fsp-chart" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <filter id="fsp-shadow">
                <feDropShadow dx="0" dy="2" stdDeviation="6" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* Browser frame */}
            <rect width="800" height="480" rx="16" fill="url(#fsp-bg)" />
            <rect width="800" height="44" rx="16" fill="#ffffff" />
            <rect y="32" width="800" height="12" fill="#ffffff" />
            <circle cx="28" cy="22" r="6" fill="#ef4444" />
            <circle cx="48" cy="22" r="6" fill="#f59e0b" />
            <circle cx="68" cy="22" r="6" fill="#10b981" />
            <rect x="200" y="12" width="400" height="20" rx="10" fill="#f1f5f9" />
            <text x="320" y="26" fontSize="10" fill="#94a3b8" fontFamily="system-ui">mystore.flowsmartly.com</text>

            {/* Store header */}
            <rect x="0" y="44" width="800" height="50" fill="url(#fsp-grad)" />
            <text x="30" y="76" fontSize="18" fill="white" fontWeight="bold" fontFamily="system-ui">StyleShop</text>
            <text x="680" y="74" fontSize="11" fill="rgba(255,255,255,0.8)" fontFamily="system-ui">Cart (3)</text>
            <rect x="725" y="62" width="50" height="22" rx="11" fill="rgba(255,255,255,0.2)" />
            <text x="734" y="77" fontSize="10" fill="white" fontFamily="system-ui">Shop</text>

            {/* Product cards row */}
            <g>
              <animateTransform attributeName="transform" type="translate" values="0,0;0,-5;0,0" dur="3s" repeatCount="indefinite" />
              <rect x="30" y="114" width="175" height="220" rx="12" fill="white" filter="url(#fsp-shadow)" />
              <rect x="38" y="122" width="159" height="110" rx="8" fill="#ede9fe" />
              <rect x="75" y="148" width="85" height="60" rx="6" fill="url(#fsp-grad)" opacity="0.2" />
              <text x="95" y="183" fontSize="12" fill="#7c3aed" fontFamily="system-ui">Product</text>
              <text x="48" y="252" fontSize="12" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Premium Headphones</text>
              <text x="48" y="270" fontSize="11" fill="#94a3b8" fontFamily="system-ui">Wireless • 40h battery</text>
              <text x="48" y="295" fontSize="16" fill="#7c3aed" fontWeight="bold" fontFamily="system-ui">$129.99</text>
              <rect x="130" y="282" width="62" height="24" rx="6" fill="url(#fsp-grad)">
                <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
              </rect>
              <text x="141" y="298" fontSize="9" fill="white" fontFamily="system-ui">Add +</text>
            </g>

            <g>
              <animateTransform attributeName="transform" type="translate" values="0,0;0,-4;0,0" dur="3.5s" repeatCount="indefinite" />
              <rect x="220" y="114" width="175" height="220" rx="12" fill="white" filter="url(#fsp-shadow)" />
              <rect x="228" y="122" width="159" height="110" rx="8" fill="#ecfdf5" />
              <rect x="265" y="148" width="85" height="60" rx="6" fill="#10b981" opacity="0.2" />
              <text x="285" y="183" fontSize="12" fill="#059669" fontFamily="system-ui">Product</text>
              <text x="238" y="252" fontSize="12" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Smart Watch Pro</text>
              <text x="238" y="270" fontSize="11" fill="#94a3b8" fontFamily="system-ui">Health • GPS • Fitness</text>
              <text x="238" y="295" fontSize="16" fill="#059669" fontWeight="bold" fontFamily="system-ui">$249.99</text>
              <rect x="320" y="282" width="62" height="24" rx="6" fill="#10b981">
                <animate attributeName="opacity" values="1;0.7;1" dur="2.3s" repeatCount="indefinite" />
              </rect>
              <text x="331" y="298" fontSize="9" fill="white" fontFamily="system-ui">Add +</text>
            </g>

            <g>
              <animateTransform attributeName="transform" type="translate" values="0,0;0,-6;0,0" dur="4s" repeatCount="indefinite" />
              <rect x="410" y="114" width="175" height="220" rx="12" fill="white" filter="url(#fsp-shadow)" />
              <rect x="418" y="122" width="159" height="110" rx="8" fill="#fef3c7" />
              <rect x="455" y="148" width="85" height="60" rx="6" fill="#f59e0b" opacity="0.2" />
              <text x="475" y="183" fontSize="12" fill="#d97706" fontFamily="system-ui">Product</text>
              <text x="428" y="252" fontSize="12" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Canvas Backpack</text>
              <text x="428" y="270" fontSize="11" fill="#94a3b8" fontFamily="system-ui">Eco • 30L capacity</text>
              <text x="428" y="295" fontSize="16" fill="#d97706" fontWeight="bold" fontFamily="system-ui">$59.99</text>
              <rect x="510" y="282" width="62" height="24" rx="6" fill="#f59e0b">
                <animate attributeName="opacity" values="1;0.7;1" dur="2.6s" repeatCount="indefinite" />
              </rect>
              <text x="521" y="298" fontSize="9" fill="white" fontFamily="system-ui">Add +</text>
            </g>

            {/* Sidebar stats */}
            <rect x="605" y="114" width="175" height="220" rx="12" fill="white" filter="url(#fsp-shadow)" />
            <text x="620" y="140" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Today&apos;s Revenue</text>
            <text x="620" y="162" fontSize="22" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">$2,847</text>
            <text x="710" y="162" fontSize="10" fill="#10b981" fontFamily="system-ui">+18%</text>
            <text x="620" y="190" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Orders: 34</text>
            <line x1="620" y1="200" x2="765" y2="200" stroke="#e2e8f0" strokeWidth="1" />
            <text x="620" y="220" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Revenue Trend</text>
            <polyline points="620,290 640,275 660,280 680,260 700,265 720,245 740,250 760,235" fill="none" stroke="url(#fsp-chart)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <animate attributeName="stroke-dasharray" values="0 400;400 0" dur="2s" fill="freeze" />
            </polyline>
            <circle cx="760" cy="235" r="4" fill="#10b981">
              <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
            </circle>
            <text x="620" y="320" fontSize="10" fill="#94a3b8" fontFamily="system-ui">Conversion Rate</text>
            <rect x="620" y="326" width="145" height="6" rx="3" fill="#e2e8f0" />
            <rect x="620" y="326" width="98" height="6" rx="3" fill="url(#fsp-grad)">
              <animate attributeName="width" values="0;98" dur="1.5s" fill="freeze" />
            </rect>

            {/* Bottom bar */}
            <rect x="30" y="350" width="555" height="110" rx="12" fill="white" filter="url(#fsp-shadow)" />
            <text x="50" y="376" fontSize="11" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Recent Orders</text>
            <rect x="50" y="388" width="520" height="1" fill="#e2e8f0" />
            <text x="50" y="408" fontSize="10" fill="#64748b" fontFamily="system-ui">#1042 — Sarah M. — Premium Headphones</text>
            <rect x="460" y="396" width="60" height="18" rx="9" fill="#ecfdf5" />
            <text x="470" y="409" fontSize="8" fill="#059669" fontFamily="system-ui">Shipped</text>
            <text x="50" y="430" fontSize="10" fill="#64748b" fontFamily="system-ui">#1041 — John D. — Smart Watch Pro × 2</text>
            <rect x="460" y="418" width="60" height="18" rx="9" fill="#ede9fe" />
            <text x="466" y="431" fontSize="8" fill="#7c3aed" fontFamily="system-ui">Processing</text>
            <text x="50" y="452" fontSize="10" fill="#64748b" fontFamily="system-ui">#1040 — Lisa K. — Canvas Backpack</text>
            <rect x="460" y="440" width="60" height="18" rx="9" fill="#dbeafe" />
            <text x="468" y="453" fontSize="8" fill="#3b82f6" fontFamily="system-ui">Delivered</text>
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything Your Store Needs
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete e-commerce solution with AI-powered tools to help you sell more and grow faster.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl bg-card border hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Up and Running in{" "}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                3 Simple Steps
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From zero to selling in minutes. No technical skills required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 opacity-20" />

            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/20">
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm font-bold text-violet-500 mb-2 block">
                  STEP {step.number}
                </span>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Intelligence */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-violet-50/50 to-background dark:from-violet-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-sm font-medium mb-4">
                <Brain className="w-4 h-4" />
                AI-Powered
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Smarter Selling with{" "}
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  AI Intelligence
                </span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Let AI handle the heavy lifting. From optimizing your prices to writing product
                descriptions, our AI tools help you make better decisions and sell more.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {aiFeatures.map((af) => (
                  <div
                    key={af.title}
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <af.icon className="w-5 h-5 text-violet-500 mb-2" />
                    <h4 className="font-semibold mb-1">{af.title}</h4>
                    <p className="text-sm text-muted-foreground">{af.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Dashboard SVG */}
            <div className="flex justify-center">
              <svg viewBox="0 0 420 340" className="w-full max-w-md" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="fsp-ai1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                  <linearGradient id="fsp-ai2" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3" />
                  </linearGradient>
                </defs>

                <rect width="420" height="340" rx="16" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-gray-900 dark:stroke-gray-700" />

                {/* Header */}
                <text x="24" y="36" fontSize="14" fill="#1e293b" fontWeight="bold" fontFamily="system-ui" className="dark:fill-gray-200">AI Intelligence Dashboard</text>
                <rect x="300" y="18" width="100" height="26" rx="13" fill="url(#fsp-ai1)" />
                <text x="316" y="35" fontSize="10" fill="white" fontFamily="system-ui">AI Insights</text>

                {/* Pricing suggestion card */}
                <rect x="20" y="56" width="185" height="90" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-gray-800 dark:stroke-gray-700" />
                <text x="34" y="78" fontSize="10" fill="#64748b" fontFamily="system-ui">Dynamic Pricing</text>
                <text x="34" y="100" fontSize="18" fill="#1e293b" fontWeight="bold" fontFamily="system-ui" className="dark:fill-gray-200">+$12.40</text>
                <text x="110" y="100" fontSize="9" fill="#10b981" fontFamily="system-ui">optimal margin</text>
                <rect x="34" y="114" width="155" height="4" rx="2" fill="#e2e8f0" />
                <rect x="34" y="114" width="110" height="4" rx="2" fill="url(#fsp-ai1)">
                  <animate attributeName="width" values="0;110" dur="2s" fill="freeze" />
                </rect>
                <text x="34" y="134" fontSize="8" fill="#94a3b8" fontFamily="system-ui">Confidence: 94%</text>

                {/* SEO score card */}
                <rect x="215" y="56" width="185" height="90" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-gray-800 dark:stroke-gray-700" />
                <text x="230" y="78" fontSize="10" fill="#64748b" fontFamily="system-ui">SEO Score</text>
                <text x="230" y="100" fontSize="18" fill="#10b981" fontWeight="bold" fontFamily="system-ui">92/100</text>
                <text x="290" y="100" fontSize="9" fill="#10b981" fontFamily="system-ui">excellent</text>
                <circle cx="370" cy="100" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle cx="370" cy="100" r="20" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="115 130" strokeLinecap="round" transform="rotate(-90 370 100)">
                  <animate attributeName="stroke-dasharray" values="0 130;115 130" dur="1.5s" fill="freeze" />
                </circle>

                {/* Trend chart */}
                <rect x="20" y="160" width="380" height="90" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-gray-800 dark:stroke-gray-700" />
                <text x="34" y="182" fontSize="10" fill="#64748b" fontFamily="system-ui">Google Trends — &quot;wireless earbuds&quot;</text>
                <polyline points="40,230 70,220 100,225 130,210 160,215 190,195 220,200 250,185 280,190 310,175 340,180 370,165" fill="none" stroke="url(#fsp-ai1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <animate attributeName="stroke-dasharray" values="0 600;600 0" dur="2.5s" fill="freeze" />
                </polyline>
                <text x="340" y="162" fontSize="9" fill="#10b981" fontWeight="bold" fontFamily="system-ui">Trending</text>

                {/* Recommendation cards */}
                <rect x="20" y="264" width="120" height="60" rx="8" fill="#ede9fe" className="dark:fill-violet-900/30">
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
                </rect>
                <text x="32" y="284" fontSize="9" fill="#7c3aed" fontWeight="600" fontFamily="system-ui">Bundle Deal</text>
                <text x="32" y="300" fontSize="8" fill="#7c3aed" opacity="0.7" fontFamily="system-ui">Earbuds + Case</text>
                <text x="32" y="316" fontSize="11" fill="#7c3aed" fontWeight="bold" fontFamily="system-ui">+$24 rev</text>

                <rect x="150" y="264" width="120" height="60" rx="8" fill="#ecfdf5" className="dark:fill-emerald-900/30">
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="3.3s" repeatCount="indefinite" />
                </rect>
                <text x="162" y="284" fontSize="9" fill="#059669" fontWeight="600" fontFamily="system-ui">Cross-Sell</text>
                <text x="162" y="300" fontSize="8" fill="#059669" opacity="0.7" fontFamily="system-ui">Watch + Band</text>
                <text x="162" y="316" fontSize="11" fill="#059669" fontWeight="bold" fontFamily="system-ui">+$18 rev</text>

                <rect x="280" y="264" width="120" height="60" rx="8" fill="#fef3c7" className="dark:fill-amber-900/30">
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="3.6s" repeatCount="indefinite" />
                </rect>
                <text x="292" y="284" fontSize="9" fill="#d97706" fontWeight="600" fontFamily="system-ui">Price Alert</text>
                <text x="292" y="300" fontSize="8" fill="#d97706" opacity="0.7" fontFamily="system-ui">Backpack: underpriced</text>
                <text x="292" y="316" fontSize="11" fill="#d97706" fontWeight="bold" fontFamily="system-ui">+$8 margin</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Two plans to fit your needs. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Plan */}
            <div className="rounded-2xl border-2 border-violet-500/20 bg-card p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold">
                30-DAY FREE TRIAL
              </div>

              <p className="text-muted-foreground mb-2 font-medium">FlowShop Basic</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-5xl font-bold">$5</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-6">No credit card required</p>

              <ul className="space-y-3 mb-8">
                {basicFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login?redirect=/ecommerce"
                className="block w-full text-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20"
              >
                Start Free Trial
              </Link>
              <p className="text-center text-xs text-muted-foreground mt-3">
                No card required. Cancel anytime.
              </p>
            </div>

            {/* Pro Plan — highlighted */}
            <div className="rounded-2xl border-2 border-violet-500 bg-card p-8 relative overflow-hidden shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/20">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 pointer-events-none" />

              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-bold">
                BEST VALUE
              </div>
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold">
                14-DAY FREE TRIAL
              </div>

              <p className="text-muted-foreground mb-2 font-medium mt-4 ">FlowShop Pro</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold">$12</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                {proFeatures.map((feature, i) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className={`text-sm text-foreground ${i === 0 ? "font-semibold" : ""}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login?redirect=/ecommerce"
                className="block w-full text-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/25"
              >
                Start Free Trial
              </Link>
              <p className="text-center text-xs text-muted-foreground mt-3">
                No charge during trial. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-violet-600 to-indigo-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Launch Your Store?
          </h2>
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            Join thousands of entrepreneurs selling online with FlowShop. Set up your store in
            minutes and start accepting orders today.
          </p>
          <Link
            href="/login?redirect=/ecommerce"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-violet-600 font-bold hover:bg-white/90 transition-colors shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* CSS Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes float-orb {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-30px) scale(1.05); }
            }
          `,
        }}
      />
    </div>
  );
}
