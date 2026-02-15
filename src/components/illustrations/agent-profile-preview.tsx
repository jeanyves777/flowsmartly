"use client";

import { motion } from "framer-motion";
import {
  Star,
  ShieldCheck,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
} from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const portfolioItems = [
  { label: "Brand Launch", color: "from-accent-purple to-pink-500" },
  { label: "Social Growth", color: "from-brand-500 to-accent-teal" },
  { label: "Ad Campaign", color: "from-emerald-500 to-brand-500" },
  { label: "Email Series", color: "from-accent-gold to-orange-500" },
];

export function AgentProfilePreview() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-xl bg-card"
    >
      {/* Browser chrome */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/50 border-b">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="flex-1 mx-3">
          <div className="max-w-[200px] mx-auto px-3 py-1 rounded-md bg-card border text-[9px] text-muted-foreground text-center">
            flowsmartly.com/agents/sarah-mitchell
          </div>
        </div>
      </motion.div>

      <div className="p-5">
        {/* Agent header */}
        <motion.div variants={fadeUp} className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-purple to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-bold">SM</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm">Sarah Mitchell</h4>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                <ShieldCheck className="w-4 h-4 text-brand-500" />
              </motion.div>
            </div>
            <p className="text-[11px] text-muted-foreground">Social Media Strategist</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {["Social Media", "Content", "Branding"].map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left: Score + Stats */}
          <motion.div variants={fadeUp} className="space-y-3">
            {/* Performance ring */}
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="3"
                  />
                  <motion.circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="97.4"
                    initial={{ strokeDashoffset: 97.4 }}
                    whileInView={{ strokeDashoffset: 97.4 * (1 - 0.94) }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold">94</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold">Performance Score</div>
                <div className="text-[10px] text-muted-foreground">Top 5% of agents</div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Users, value: "47", label: "Clients", color: "text-brand-500" },
                { icon: Star, value: "4.9", label: "Rating", color: "text-amber-400" },
                { icon: Calendar, value: "2yr", label: "Active", color: "text-emerald-500" },
                { icon: MessageSquare, value: "<2h", label: "Response", color: "text-accent-purple" },
              ].map((stat) => (
                <div key={stat.label} className="p-2 rounded-lg border bg-muted/30">
                  <stat.icon className={`w-3 h-3 ${stat.color} mb-1`} />
                  <div className="text-xs font-bold">{stat.value}</div>
                  <div className="text-[9px] text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Portfolio + Review */}
          <motion.div variants={fadeUp} className="space-y-3">
            {/* Mini portfolio */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium">Portfolio</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {portfolioItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    className={`h-12 rounded-lg bg-gradient-to-br ${item.color} flex items-end p-1.5`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                  >
                    <span className="text-[8px] text-white font-medium">{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Review snippet */}
            <motion.div
              variants={fadeUp}
              className="p-2.5 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-0.5 mb-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground leading-relaxed italic">
                &ldquo;Sarah transformed our social presence. Engagement up 340% in 3 months!&rdquo;
              </p>
              <div className="text-[9px] font-medium mt-1.5">— Alex R., E-Commerce</div>
            </motion.div>

            {/* CTA button mockup */}
            <div className="px-3 py-2 rounded-lg bg-accent-purple text-white text-center text-[10px] font-medium">
              Hire This Agent — $250/mo
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
