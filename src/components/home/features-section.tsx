"use client";

import { motion } from "framer-motion";
import { Sparkles, Share2, BarChart3, Mail, MessageSquare, Megaphone } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Content Studio",
    description:
      "Generate engaging posts, ads, and captions with Claude AI. Create content that resonates with your audience.",
    color: "bg-brand-500",
  },
  {
    icon: Share2,
    title: "FlowSocial & Share Hub",
    description:
      "Native social feed with one-click sharing to all major platforms. No API complexity, just seamless sharing.",
    color: "bg-accent-purple",
  },
  {
    icon: Megaphone,
    title: "Ad Campaigns",
    description:
      "Create and manage ad campaigns to promote your content. Reach new audiences with targeted advertising.",
    color: "bg-emerald-500",
  },
  {
    icon: Mail,
    title: "Email Marketing",
    description:
      "Build beautiful email campaigns with AI-powered content. Track opens, clicks, and conversions.",
    color: "bg-accent-pink",
  },
  {
    icon: MessageSquare,
    title: "SMS Campaigns",
    description:
      "Reach your audience instantly with personalized SMS marketing. TCPA compliant out of the box.",
    color: "bg-accent-orange",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description:
      "AI-powered insights to optimize your content strategy. Know what works and why.",
    color: "bg-accent-teal",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to help creators and businesses grow their audience and
            revenue.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group p-6 rounded-xl bg-card border hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
            >
              <div
                className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
