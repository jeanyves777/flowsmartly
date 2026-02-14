"use client";

import { motion } from "framer-motion";
import { Share2, CalendarDays, Globe, Rss, Heart, MessageCircle, Repeat2, PenSquare } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
};

const platforms = [
  { name: "Twitter", color: "bg-sky-500" },
  { name: "Instagram", color: "bg-pink-500" },
  { name: "LinkedIn", color: "bg-blue-600" },
  { name: "Facebook", color: "bg-blue-500" },
];

export function SocialPreview() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-xl bg-card"
    >
      <div className="p-6">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-gold flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold">Social & Sharing Hub</h4>
            <p className="text-xs text-muted-foreground">Create once, share everywhere</p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-4">
          {/* Post card (takes 3 cols) */}
          <motion.div variants={fadeUp} className="md:col-span-3 space-y-4">
            {/* Post preview */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center">
                  <PenSquare className="w-4 h-4 text-brand-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">FlowSmartly</div>
                  <div className="text-[10px] text-muted-foreground">Just now</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Excited to launch our new AI content studio! Create stunning posts, images, and videos in seconds.
              </p>
              <div className="rounded-lg bg-gradient-to-br from-brand-500/10 to-accent-purple/10 h-28 flex items-center justify-center border">
                <Globe className="w-8 h-8 text-brand-500/40" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-muted-foreground">
                <motion.div
                  className="flex items-center gap-1 text-xs"
                  whileHover={{ scale: 1.05 }}
                >
                  <Heart className="w-3.5 h-3.5" /> 247
                </motion.div>
                <motion.div
                  className="flex items-center gap-1 text-xs"
                  whileHover={{ scale: 1.05 }}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> 38
                </motion.div>
                <motion.div
                  className="flex items-center gap-1 text-xs"
                  whileHover={{ scale: 1.05 }}
                >
                  <Repeat2 className="w-3.5 h-3.5" /> 95
                </motion.div>
              </div>
            </div>

            {/* Schedule bar */}
            <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-accent-gold" />
              <span className="text-xs font-medium">Scheduled</span>
              <div className="flex-1 flex items-center gap-1.5">
                {["9am", "12pm", "3pm", "6pm", "9pm"].map((time, i) => (
                  <motion.div
                    key={time}
                    variants={scaleIn}
                    className={`flex-1 h-6 rounded text-[10px] flex items-center justify-center ${
                      i < 3 ? "bg-brand-500/10 text-brand-500" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {time}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Share targets (takes 2 cols) */}
          <motion.div variants={container} className="md:col-span-2 space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium">Share to</span>
              </div>
              <div className="space-y-2.5">
                {platforms.map((platform, i) => (
                  <motion.div
                    key={platform.name}
                    variants={fadeUp}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-card transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-full ${platform.color} flex items-center justify-center`}>
                      <span className="text-white text-[10px] font-bold">{platform.name[0]}</span>
                    </div>
                    <span className="text-xs font-medium flex-1">{platform.name}</span>
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8 + i * 0.15 }}
                      className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Feed stats */}
            <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Rss className="w-4 h-4 text-accent-gold" />
                <span className="text-sm font-medium">Feed</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1.5">
                <div className="flex justify-between">
                  <span>Posts today</span>
                  <span className="font-medium text-foreground">12</span>
                </div>
                <div className="flex justify-between">
                  <span>Engagement</span>
                  <span className="font-medium text-foreground">89.2%</span>
                </div>
                <div className="flex justify-between">
                  <span>Reach</span>
                  <span className="font-medium text-foreground">45.6K</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
