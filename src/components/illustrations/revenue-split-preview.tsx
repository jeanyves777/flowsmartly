"use client";

import { motion } from "framer-motion";
import { DollarSign, ArrowRight } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function RevenueSplitPreview() {
  // Donut chart math: circle circumference = 2 * PI * r
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const agentPortion = circumference * 0.8; // 80%
  const platformPortion = circumference * 0.2; // 20%

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-xl bg-card p-6"
    >
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Donut Chart */}
        <motion.div variants={fadeUp} className="relative w-40 h-40 flex-shrink-0">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="18"
            />
            {/* Agent portion (80%) */}
            <motion.circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${agentPortion} ${circumference}`}
              initial={{ strokeDashoffset: circumference }}
              whileInView={{ strokeDashoffset: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
            />
            {/* Platform portion (20%) */}
            <motion.circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${platformPortion} ${circumference}`}
              strokeDashoffset={-agentPortion}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 1.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <DollarSign className="w-5 h-5 text-muted-foreground mb-0.5" />
            <span className="text-lg font-bold">80/20</span>
            <span className="text-[10px] text-muted-foreground">Split</span>
          </div>
        </motion.div>

        {/* Legend + Flow */}
        <div className="flex-1 space-y-4">
          {/* Legend */}
          <motion.div variants={fadeUp} className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-purple" />
              <span className="text-xs font-medium">Agent (80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-500" />
              <span className="text-xs font-medium">Platform (20%)</span>
            </div>
          </motion.div>

          {/* Flow diagram */}
          <motion.div variants={fadeUp} className="space-y-3">
            {/* Client pays */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium">Client pays</div>
                <div className="text-lg font-bold">$500<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-3">
              <div className="w-px h-4 bg-border" />
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
            </div>

            {/* Split */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                variants={fadeUp}
                className="p-3 rounded-lg border-2 border-accent-purple/20 bg-accent-purple/5"
              >
                <div className="text-[10px] text-accent-purple font-medium mb-1">Agent receives</div>
                <div className="text-xl font-bold text-accent-purple">$400</div>
              </motion.div>
              <motion.div
                variants={fadeUp}
                className="p-3 rounded-lg border-2 border-brand-500/20 bg-brand-500/5"
              >
                <div className="text-[10px] text-brand-500 font-medium mb-1">Platform fee</div>
                <div className="text-xl font-bold text-brand-500">$100</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
