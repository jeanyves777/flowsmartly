"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShoppingBag, Palette, Brain, CreditCard, BarChart3, ArrowRight } from "lucide-react";

const features = [
  { icon: Palette, label: "10 Pro Themes", color: "bg-violet-500" },
  { icon: Brain, label: "AI-Powered Tools", color: "bg-indigo-500" },
  { icon: CreditCard, label: "Secure Payments", color: "bg-emerald-500" },
  { icon: BarChart3, label: "Smart Analytics", color: "bg-amber-500" },
];

export function FlowShopSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-violet-50/30 to-background dark:via-violet-950/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column — Text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 mb-4">
              <ShoppingBag className="w-3.5 h-3.5" />
              FlowShop
            </span>

            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Launch Your{" "}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Online Store
              </span>
            </h2>

            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Create a beautiful, AI-powered e-commerce store in minutes. Sell products, accept payments,
              track orders, and grow your business — all from one platform.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${f.color} flex items-center justify-center shrink-0`}>
                    <f.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                </div>
              ))}
            </div>

            <Link
              href="/flowshop"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Explore FlowShop
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Right Column — Animated Store SVG */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <svg viewBox="0 0 500 400" className="w-full max-w-lg" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="fs-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="fs-grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="fs-chart" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="fs-shadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.1" />
                </filter>
              </defs>

              {/* Browser frame */}
              <rect x="20" y="20" width="460" height="360" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="1.5" filter="url(#fs-shadow)" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
              {/* Title bar */}
              <rect x="20" y="20" width="460" height="40" rx="12" fill="#f9fafb" className="dark:fill-[hsl(var(--muted))]" />
              <rect x="20" y="48" width="460" height="12" fill="#f9fafb" className="dark:fill-[hsl(var(--muted))]" />
              {/* Dots */}
              <circle cx="44" cy="40" r="5" fill="#ef4444" />
              <circle cx="62" cy="40" r="5" fill="#f59e0b" />
              <circle cx="80" cy="40" r="5" fill="#10b981" />
              {/* URL bar */}
              <rect x="110" y="32" width="260" height="16" rx="8" fill="#e5e7eb" className="dark:fill-[hsl(var(--border))]" />
              <text x="170" y="44" fontSize="8" fill="#9ca3af" fontFamily="system-ui">mystore.flowsmartly.com</text>

              {/* Store header */}
              <rect x="40" y="72" width="420" height="36" rx="6" fill="url(#fs-grad1)" />
              <text x="60" y="95" fontSize="14" fill="white" fontWeight="bold" fontFamily="system-ui">My Store</text>
              <rect x="360" y="82" width="80" height="18" rx="9" fill="rgba(255,255,255,0.2)" />
              <text x="377" y="95" fontSize="9" fill="white" fontFamily="system-ui">Cart (2)</text>

              {/* Product card 1 */}
              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-6;0,0" dur="3s" repeatCount="indefinite" />
                <rect x="40" y="124" width="125" height="150" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <rect x="48" y="132" width="109" height="75" rx="4" fill="url(#fs-grad2)" />
                <rect x="70" y="155" width="65" height="30" rx="4" fill="url(#fs-grad1)" opacity="0.3" />
                <text x="85" y="175" fontSize="10" fill="#7c3aed" fontFamily="system-ui">Product</text>
                <text x="56" y="224" fontSize="10" fill="#374151" fontWeight="600" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">Wireless Earbuds</text>
                <text x="56" y="240" fontSize="12" fill="#7c3aed" fontWeight="bold" fontFamily="system-ui">$49.99</text>
                <rect x="110" y="230" width="46" height="18" rx="4" fill="url(#fs-grad1)">
                  <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
                </rect>
                <text x="118" y="242" fontSize="7" fill="white" fontFamily="system-ui">Add +</text>
              </g>

              {/* Product card 2 */}
              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-5;0,0" dur="3.5s" repeatCount="indefinite" />
                <rect x="185" y="124" width="125" height="150" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <rect x="193" y="132" width="109" height="75" rx="4" fill="#ecfdf5" />
                <rect x="215" y="155" width="65" height="30" rx="4" fill="#10b981" opacity="0.3" />
                <text x="228" y="175" fontSize="10" fill="#059669" fontFamily="system-ui">Product</text>
                <text x="200" y="224" fontSize="10" fill="#374151" fontWeight="600" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">Smart Watch</text>
                <text x="200" y="240" fontSize="12" fill="#059669" fontWeight="bold" fontFamily="system-ui">$89.99</text>
                <rect x="258" y="230" width="46" height="18" rx="4" fill="#10b981">
                  <animate attributeName="opacity" values="1;0.7;1" dur="2.3s" repeatCount="indefinite" />
                </rect>
                <text x="266" y="242" fontSize="7" fill="white" fontFamily="system-ui">Add +</text>
              </g>

              {/* Product card 3 */}
              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-4;0,0" dur="4s" repeatCount="indefinite" />
                <rect x="330" y="124" width="125" height="150" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <rect x="338" y="132" width="109" height="75" rx="4" fill="#fef3c7" />
                <rect x="360" y="155" width="65" height="30" rx="4" fill="#f59e0b" opacity="0.3" />
                <text x="373" y="175" fontSize="10" fill="#d97706" fontFamily="system-ui">Product</text>
                <text x="345" y="224" fontSize="10" fill="#374151" fontWeight="600" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">Backpack Pro</text>
                <text x="345" y="240" fontSize="12" fill="#d97706" fontWeight="bold" fontFamily="system-ui">$34.99</text>
                <rect x="403" y="230" width="46" height="18" rx="4" fill="#f59e0b">
                  <animate attributeName="opacity" values="1;0.7;1" dur="2.7s" repeatCount="indefinite" />
                </rect>
                <text x="411" y="242" fontSize="7" fill="white" fontFamily="system-ui">Add +</text>
              </g>

              {/* Revenue bar at bottom */}
              <rect x="40" y="290" width="420" height="76" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
              <text x="56" y="310" fontSize="9" fill="#6b7280" fontFamily="system-ui">Revenue</text>
              <text x="56" y="326" fontSize="16" fill="#374151" fontWeight="bold" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">$12,847</text>
              <text x="130" y="326" fontSize="9" fill="#10b981" fontFamily="system-ui">+24.5%</text>

              {/* Mini chart */}
              <polyline
                points="200,340 230,325 260,332 290,310 320,318 350,300 380,305 410,290 440,295"
                fill="none"
                stroke="url(#fs-chart)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <animate attributeName="stroke-dasharray" values="0 500;500 0" dur="2s" fill="freeze" />
              </polyline>
              {/* Chart dots */}
              <circle cx="440" cy="295" r="3.5" fill="#10b981">
                <animate attributeName="r" values="3.5;5;3.5" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
