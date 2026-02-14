"use client";

import { motion } from "framer-motion";
import { BarChart3, Users, DollarSign, TrendingUp, ArrowUpRight } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const barHeights = [45, 65, 55, 80, 70, 95, 85];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AnalyticsPreview() {
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold">Smart Analytics</h4>
            <p className="text-xs text-muted-foreground">AI-powered insights</p>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={container} className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Engagement", value: "24.8%", icon: TrendingUp, change: "+5.2%", color: "text-brand-500" },
            { label: "Audience", value: "8,241", icon: Users, change: "+12%", color: "text-accent-purple" },
            { label: "Revenue", value: "$4,820", icon: DollarSign, change: "+18%", color: "text-emerald-500" },
          ].map(({ label, value, icon: Icon, change, color }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className="rounded-lg border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-emerald-500 flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  {change}
                </span>
              </div>
              <div className="text-lg font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bar chart */}
        <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Weekly Performance</span>
            <span className="text-xs text-muted-foreground">Views & Engagement</span>
          </div>
          <div className="flex items-end justify-between gap-2 h-28">
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-brand-400"
                  initial={{ height: 0 }}
                  whileInView={{ height: `${h}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                />
                <span className="text-[10px] text-muted-foreground">{days[i]}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Line chart overlay */}
        <motion.div variants={fadeUp} className="mt-4 rounded-lg border bg-muted/30 p-4">
          <span className="text-sm font-medium">Growth Trend</span>
          <svg viewBox="0 0 400 80" className="w-full h-auto mt-2">
            <defs>
              <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,60 Q50,55 100,45 T200,30 T300,20 T400,10"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
            />
            <motion.path
              d="M0,60 Q50,55 100,45 T200,30 T300,20 T400,10 L400,80 L0,80Z"
              fill="url(#analyticsGrad)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 1.5 }}
            />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}
