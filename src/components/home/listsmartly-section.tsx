"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { MapPin, Sparkles, Star, BarChart3, ArrowRight } from "lucide-react";

const features = [
  { icon: MapPin, label: "150+ Directories", description: "Sync your business across Google, Yelp, Apple Maps, and 150+ more", color: "bg-teal-500" },
  { icon: Sparkles, label: "AI Autopilot", description: "AI monitors and auto-fixes listing inconsistencies 24/7", color: "bg-cyan-500" },
  { icon: Star, label: "Review Management", description: "AI drafts review responses in your brand voice", color: "bg-blue-500" },
  { icon: BarChart3, label: "Citation Score", description: "Real-time presence score with actionable AI insights", color: "bg-green-500" },
];

export function ListSmartlySection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-teal-50/30 to-background dark:via-teal-950/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column — Text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 mb-4">
              <MapPin className="w-3.5 h-3.5" />
              ListSmartly
            </span>

            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Dominate{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Local Search
              </span>
            </h2>

            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              AI-powered listing sync across 150+ directories. Manage reviews, track citations,
              and outrank competitors — all on autopilot.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {features.map((f) => (
                <div key={f.label} className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${f.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <f.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground block">{f.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight block">{f.description}</span>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/listsmartly-details"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Learn More
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Right Column — Animated Listing Dashboard SVG */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <svg viewBox="0 0 500 400" className="w-full max-w-lg" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="ls-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0d9488" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="ls-grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="ls-score" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0d9488" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="ls-shadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.1" />
                </filter>
              </defs>

              {/* Browser frame */}
              <rect x="20" y="20" width="460" height="360" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="1.5" filter="url(#ls-shadow)" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
              {/* Title bar */}
              <rect x="20" y="20" width="460" height="40" rx="12" fill="#f9fafb" className="dark:fill-[hsl(var(--muted))]" />
              <rect x="20" y="48" width="460" height="12" fill="#f9fafb" className="dark:fill-[hsl(var(--muted))]" />
              {/* Dots */}
              <circle cx="44" cy="40" r="5" fill="#ef4444" />
              <circle cx="62" cy="40" r="5" fill="#f59e0b" />
              <circle cx="80" cy="40" r="5" fill="#10b981" />
              {/* URL bar */}
              <rect x="110" y="32" width="260" height="16" rx="8" fill="#e5e7eb" className="dark:fill-[hsl(var(--border))]" />
              <text x="160" y="44" fontSize="8" fill="#9ca3af" fontFamily="system-ui">listsmartly.flowsmartly.com</text>

              {/* Dashboard header */}
              <rect x="40" y="72" width="420" height="36" rx="6" fill="url(#ls-grad1)" />
              <text x="60" y="95" fontSize="14" fill="white" fontWeight="bold" fontFamily="system-ui">Listing Dashboard</text>
              <rect x="340" y="82" width="100" height="18" rx="9" fill="rgba(255,255,255,0.2)" />
              <text x="354" y="95" fontSize="9" fill="white" fontFamily="system-ui">161 Synced</text>

              {/* Citation Score Gauge */}
              <g>
                <rect x="40" y="122" width="200" height="110" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <text x="56" y="142" fontSize="9" fill="#6b7280" fontFamily="system-ui">Citation Score</text>
                {/* Gauge arc background */}
                <circle cx="140" cy="195" r="35" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeDasharray="110 220" strokeLinecap="round" transform="rotate(-180 140 195)" className="dark:stroke-[hsl(var(--border))]" />
                {/* Gauge arc filled */}
                <circle cx="140" cy="195" r="35" fill="none" stroke="url(#ls-score)" strokeWidth="6" strokeDasharray="95 220" strokeLinecap="round" transform="rotate(-180 140 195)">
                  <animate attributeName="stroke-dasharray" values="0 220;95 220" dur="2s" fill="freeze" />
                </circle>
                <text x="125" y="198" fontSize="20" fill="#0d9488" fontWeight="bold" fontFamily="system-ui">87</text>
                <text x="118" y="212" fontSize="8" fill="#6b7280" fontFamily="system-ui">out of 100</text>
              </g>

              {/* Listing Cards */}
              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-4;0,0" dur="3s" repeatCount="indefinite" />
                <rect x="255" y="122" width="205" height="34" rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <circle cx="275" cy="139" r="8" fill="#4285F4" />
                <text x="275" y="143" fontSize="8" fill="white" fontFamily="system-ui" textAnchor="middle">G</text>
                <text x="290" y="143" fontSize="9" fill="#374151" fontWeight="600" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">Google Business</text>
                <rect x="410" y="131" width="38" height="16" rx="8" fill="#ecfdf5" />
                <text x="416" y="142" fontSize="7" fill="#059669" fontFamily="system-ui">Synced</text>
              </g>

              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-3;0,0" dur="3.4s" repeatCount="indefinite" />
                <rect x="255" y="164" width="205" height="34" rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <circle cx="275" cy="181" r="8" fill="#d32323" />
                <text x="275" y="185" fontSize="8" fill="white" fontFamily="system-ui" textAnchor="middle">Y</text>
                <text x="290" y="185" fontSize="9" fill="#374151" fontWeight="600" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">Yelp</text>
                <rect x="410" y="173" width="38" height="16" rx="8" fill="#ecfdf5" />
                <text x="416" y="184" fontSize="7" fill="#059669" fontFamily="system-ui">Synced</text>
              </g>

              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-5;0,0" dur="3.8s" repeatCount="indefinite" />
                <rect x="255" y="206" width="205" height="34" rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
                <circle cx="275" cy="223" r="8" fill="#333333" />
                <text x="275" y="227" fontSize="7" fill="white" fontFamily="system-ui" textAnchor="middle">A</text>
                <text x="290" y="227" fontSize="9" fill="#374151" fontWeight="600" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">Apple Maps</text>
                <rect x="410" y="215" width="38" height="16" rx="8" fill="#fef3c7" />
                <text x="413" y="226" fontSize="7" fill="#d97706" fontFamily="system-ui">Fixing</text>
              </g>

              {/* Review summary bar */}
              <rect x="40" y="248" width="420" height="50" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
              <text x="56" y="268" fontSize="9" fill="#6b7280" fontFamily="system-ui">Reviews</text>
              <text x="56" y="286" fontSize="14" fill="#374151" fontWeight="bold" fontFamily="system-ui" className="dark:fill-[hsl(var(--foreground))]">4.7</text>
              {/* Stars */}
              <text x="82" y="286" fontSize="12" fill="#f59e0b" fontFamily="system-ui">&#9733;&#9733;&#9733;&#9733;&#9733;</text>
              <text x="145" y="286" fontSize="9" fill="#6b7280" fontFamily="system-ui">128 reviews</text>

              {/* AI autopilot indicator */}
              <rect x="280" y="258" width="165" height="30" rx="6" fill="url(#ls-grad1)" opacity="0.9">
                <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
              </rect>
              <text x="296" y="278" fontSize="9" fill="white" fontWeight="600" fontFamily="system-ui">AI Autopilot Active</text>
              <circle cx="430" cy="273" r="4" fill="#10b981">
                <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
              </circle>

              {/* Activity feed */}
              <rect x="40" y="310" width="420" height="58" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" className="dark:fill-[hsl(var(--card))] dark:stroke-[hsl(var(--border))]" />
              <text x="56" y="330" fontSize="8" fill="#0d9488" fontWeight="600" fontFamily="system-ui">AI Fixed</text>
              <text x="100" y="330" fontSize="8" fill="#6b7280" fontFamily="system-ui">Address mismatch on Bing Places — 2m ago</text>
              <text x="56" y="350" fontSize="8" fill="#3b82f6" fontWeight="600" fontFamily="system-ui">New Review</text>
              <text x="112" y="350" fontSize="8" fill="#6b7280" fontFamily="system-ui">5-star on Google — AI response drafted — 14m ago</text>
            </svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
