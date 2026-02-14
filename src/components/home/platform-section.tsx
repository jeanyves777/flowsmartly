"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BarChart3, Megaphone, Share2 } from "lucide-react";
import { AIStudioPreview } from "@/components/illustrations/ai-studio-preview";
import { AnalyticsPreview } from "@/components/illustrations/analytics-preview";
import { MarketingPreview } from "@/components/illustrations/marketing-preview";
import { SocialPreview } from "@/components/illustrations/social-preview";

const tabs = [
  {
    id: "ai",
    label: "AI Studio",
    icon: Sparkles,
    title: "AI Content Studio",
    description:
      "Generate blog posts, social media content, ad copy, and images with powerful AI. Our FlowAI engine understands your brand voice and creates content that resonates with your audience.",
    Component: AIStudioPreview,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    title: "Smart Analytics",
    description:
      "Track engagement, audience growth, and revenue with AI-powered insights. Understand what content performs best and optimize your strategy with data-driven recommendations.",
    Component: AnalyticsPreview,
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    title: "Marketing Suite",
    description:
      "Run email and SMS campaigns from one place. Build contact lists, design beautiful templates, schedule sends, and track open rates and conversions — all TCPA compliant.",
    Component: MarketingPreview,
  },
  {
    id: "social",
    label: "Social",
    icon: Share2,
    title: "Social & Sharing Hub",
    description:
      "Create content once and share it everywhere. Our native social feed, scheduling tools, and one-click cross-posting make content distribution effortless.",
    Component: SocialPreview,
  },
];

export function PlatformSection() {
  const [activeTab, setActiveTab] = useState("ai");
  const active = tabs.find((t) => t.id === activeTab)!;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See the Platform in Action
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built for creators and businesses who want to grow smarter, not harder.
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Text */}
              <div className="order-2 lg:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <active.icon className="w-5 h-5 text-brand-500" />
                  </div>
                  <h3 className="text-2xl font-bold">{active.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {active.description}
                </p>
              </div>
              {/* Illustration */}
              <div className="order-1 lg:order-2">
                <active.Component />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
