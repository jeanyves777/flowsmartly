"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  BarChart3,
  Share2,
  Mail,
  MessageSquare,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";

const float = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

const floatSlow = {
  animate: {
    y: [0, -6, 0],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
  },
};

const fadeIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

const features = [
  { icon: Sparkles, label: "AI Studio", x: "10%", y: "15%" },
  { icon: Share2, label: "Social Hub", x: "65%", y: "10%" },
  { icon: BarChart3, label: "Analytics", x: "75%", y: "55%" },
  { icon: Mail, label: "Email", x: "5%", y: "65%" },
  { icon: Megaphone, label: "Ads", x: "60%", y: "80%" },
  { icon: MessageSquare, label: "SMS", x: "20%", y: "85%" },
];

export function AuthIllustration() {
  return (
    <div className="relative w-full max-w-lg aspect-square">
      {/* Central card */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.6 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 p-6 shadow-2xl"
      >
        <motion.div variants={float} animate="animate">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">10K+</div>
            <div className="text-sm text-white/70">Active Creators</div>
            <div className="mt-4 flex items-center justify-center gap-1">
              <Users className="w-4 h-4 text-white/60" />
              <span className="text-xs text-white/60">Growing daily</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating feature badges */}
      {features.map((feature, i) => (
        <motion.div
          key={feature.label}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
          style={{ position: "absolute", left: feature.x, top: feature.y }}
        >
          <motion.div
            variants={i % 2 === 0 ? float : floatSlow}
            animate="animate"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 shadow-lg"
          >
            <feature.icon className="w-4 h-4 text-white" />
            <span className="text-xs font-medium text-white/90 whitespace-nowrap">
              {feature.label}
            </span>
          </motion.div>
        </motion.div>
      ))}

      {/* Decorative rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-white/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-white/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-white/5" />
    </div>
  );
}
