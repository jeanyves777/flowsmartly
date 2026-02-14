"use client";

import { motion } from "framer-motion";
import {
  Eye,
  DollarSign,
  Megaphone,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Gift,
  Target,
} from "lucide-react";

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

export function EarnCreditsPreview() {
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-emerald-500 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold">Earn Credits</h4>
            <p className="text-xs text-muted-foreground">View content, earn rewards</p>
          </div>
        </motion.div>

        {/* Flow diagram: View → Earn → Use */}
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          {[
            { icon: Eye, label: "View Ads", color: "bg-brand-500" },
            { icon: DollarSign, label: "Earn Credits", color: "bg-emerald-500" },
            { icon: Megaphone, label: "Boost Your Ads", color: "bg-accent-purple" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <motion.div
                variants={fadeUp}
                className="flex flex-col items-center gap-2"
              >
                <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium">{step.label}</span>
              </motion.div>
              {i < 2 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-[-16px]" />
              )}
            </div>
          ))}
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Credits balance card */}
          <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Your Credits</span>
              <Gift className="w-4 h-4 text-accent-gold" />
            </div>
            <div className="text-3xl font-bold mb-1">2,450</div>
            <div className="text-xs text-muted-foreground mb-4">credits available</div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Daily progress</span>
                <span className="font-medium">75/100</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-accent-gold to-emerald-500"
                  initial={{ width: 0 }}
                  whileInView={{ width: "75%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Recent earnings */}
            <div className="mt-4 space-y-2">
              {[
                { desc: "Viewed sponsored post", amount: "+5" },
                { desc: "Watched video ad", amount: "+10" },
                { desc: "Engaged with content", amount: "+3" },
              ].map((item) => (
                <div key={item.desc} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.desc}</span>
                  <span className="text-emerald-500 font-medium">{item.amount}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Use credits card */}
          <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Use Credits</span>
              <Target className="w-4 h-4 text-accent-purple" />
            </div>

            <div className="space-y-3">
              {[
                { icon: Megaphone, label: "Boost a Post", cost: "50 credits", color: "text-brand-500" },
                { icon: Sparkles, label: "AI Content Generation", cost: "25 credits", color: "text-accent-purple" },
                { icon: TrendingUp, label: "Promote Campaign", cost: "100 credits", color: "text-emerald-500" },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  variants={fadeUp}
                  className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  <item.icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground">{item.cost}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </motion.div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-3">
              <div>
                <div className="text-lg font-bold">1,200</div>
                <div className="text-[10px] text-muted-foreground">Credits earned this month</div>
              </div>
              <div>
                <div className="text-lg font-bold">800</div>
                <div className="text-[10px] text-muted-foreground">Credits spent on ads</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
