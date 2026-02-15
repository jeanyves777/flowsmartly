"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Rocket,
  Zap,
  Share2,
  PenSquare,
  Image as ImageIcon,
  Video,
  Star,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const float = {
  animate: {
    y: [0, -10, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

export function RegisterIllustration() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="w-full max-w-md"
    >
      {/* Heading */}
      <motion.div variants={fadeIn} className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">
          Start Creating Today
        </h2>
        <p className="text-white/70">
          AI-powered tools to grow your brand
        </p>
      </motion.div>

      {/* Main creation showcase */}
      <motion.div
        variants={fadeIn}
        className="rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl overflow-hidden"
      >
        {/* AI generation header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-4">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(139,92,246,0)",
                  "0 0 20px 4px rgba(139,92,246,0.3)",
                  "0 0 0 0 rgba(139,92,246,0)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <div className="text-sm font-semibold text-white">
                AI Content Studio
              </div>
              <div className="text-[10px] text-white/50">
                Generate anything in seconds
              </div>
            </div>
          </div>

          {/* Prompt bar */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "85%" }}
              transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
              className="h-3 rounded bg-white/10 mb-2 overflow-hidden"
            >
              <motion.div
                className="h-full bg-gradient-to-r from-violet-400/40 to-fuchsia-400/40 rounded"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, delay: 0.5 }}
              />
            </motion.div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">
                Write a compelling post about...
              </span>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 2 }}
                className="px-2 py-1 rounded-lg bg-violet-500/30 text-[10px] font-medium text-violet-200"
              >
                Generate
              </motion.div>
            </div>
          </div>

          {/* Generated content types */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: PenSquare, label: "Posts", color: "from-sky-500 to-blue-500" },
              { icon: ImageIcon, label: "Images", color: "from-violet-500 to-fuchsia-500" },
              { icon: Video, label: "Videos", color: "from-sky-500 to-cyan-500" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                variants={fadeIn}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="rounded-xl bg-white/5 border border-white/10 p-3 text-center"
              >
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-2`}
                >
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-medium text-white/70">
                  {item.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Share section */}
        <div className="bg-white/5 border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4 text-white/70" />
            <span className="text-xs font-medium text-white/80">
              Share Everywhere
            </span>
          </div>
          <div className="flex items-center gap-2">
            {["Facebook", "Instagram", "Twitter", "LinkedIn", "TikTok"].map(
              (platform, i) => (
                <motion.div
                  key={platform}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1 + i * 0.08 }}
                  className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
                >
                  <span className="text-[9px] font-medium text-white/60">
                    {platform}
                  </span>
                </motion.div>
              )
            )}
          </div>
        </div>
      </motion.div>

      {/* Bottom feature pills */}
      <motion.div
        variants={fadeIn}
        className="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        {[
          { icon: Rocket, text: "Launch in minutes" },
          { icon: Zap, text: "10x faster with AI" },
          { icon: Star, text: "No credit card needed" },
        ].map((item, i) => (
          <motion.div
            key={item.text}
            variants={fadeIn}
            transition={{ delay: 1.2 + i * 0.1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15"
          >
            <item.icon className="w-3.5 h-3.5 text-white/80" />
            <span className="text-xs text-white/80">{item.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Social proof */}
      <motion.div variants={fadeIn} className="mt-6 text-center">
        <div className="flex items-center justify-center gap-1 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.5 + i * 0.05 }}
            >
              <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-white/60">
          Trusted by <span className="text-white font-medium">10,000+</span>{" "}
          creators worldwide
        </p>
        <div className="flex items-center justify-center gap-4 mt-3">
          {[
            { text: "Free plan available", icon: CheckCircle2 },
            { text: "No setup required", icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-1">
              <item.icon className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-white/60">{item.text}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
