"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Sparkles,
  Palette,
  Video,
  Crown,
  BarChart3,
  Megaphone,
  FolderOpen,
  Users,
  DollarSign,
  TrendingUp,
  Eye,
} from "lucide-react";

const sidebarIcons = [
  { Icon: LayoutDashboard, label: "Dashboard", active: true },
  { Icon: Sparkles, label: "FlowAI" },
  { Icon: Palette, label: "Image Studio" },
  { Icon: Video, label: "Video Studio" },
  { Icon: Crown, label: "Logo Gen" },
  { Icon: FolderOpen, label: "Media" },
  { Icon: Megaphone, label: "Ads" },
  { Icon: BarChart3, label: "Analytics" },
];

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function AnimatedCounter({ value, label, icon: Icon, color }: { value: string; label: string; icon: React.ElementType; color: string }) {
  return (
    <motion.div
      variants={cardItem}
      className="bg-card rounded-lg border p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-emerald-500 flex items-center gap-0.5 mb-1">
          <TrendingUp className="w-3 h-3" /> +12%
        </span>
      </div>
    </motion.div>
  );
}

export function DashboardPreview() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-2xl bg-card"
    >
      <div className="flex min-h-[320px] sm:min-h-[400px]">
        {/* Sidebar */}
        <motion.div
          variants={container}
          className="hidden sm:flex w-48 flex-col gap-1 bg-muted/50 border-r p-3"
        >
          <div className="flex items-center gap-2 mb-4 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="FlowSmartly" className="h-6 w-auto" />
          </div>
          {sidebarIcons.map(({ Icon, label, active }) => (
            <motion.div
              key={label}
              variants={item}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-brand-500/10 text-brand-500 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-6">
          {/* Header */}
          <motion.div
            variants={cardItem}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h3 className="font-semibold text-lg">Dashboard</h3>
              <p className="text-xs text-muted-foreground">Welcome back</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand-500" />
              </div>
            </div>
          </motion.div>

          {/* Metric cards */}
          <motion.div
            variants={container}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
          >
            <AnimatedCounter value="12.4K" label="Total Views" icon={Eye} color="text-brand-500" />
            <AnimatedCounter value="3,847" label="Followers" icon={Users} color="text-accent-purple" />
            <AnimatedCounter value="$2,450" label="Earnings" icon={DollarSign} color="text-emerald-500" />
            <AnimatedCounter value="156" label="Posts" icon={BarChart3} color="text-accent-gold" />
          </motion.div>

          {/* Chart area */}
          <motion.div
            variants={cardItem}
            className="bg-card rounded-lg border p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Performance Overview</span>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>
            <svg viewBox="0 0 500 120" className="w-full h-auto">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0, 30, 60, 90].map((y) => (
                <line
                  key={y}
                  x1="0" y1={y} x2="500" y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
              ))}
              {/* Area fill */}
              <motion.path
                d="M0,90 L70,75 L140,60 L210,70 L280,40 L350,45 L420,25 L500,15 L500,120 L0,120Z"
                fill="url(#chartGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
              />
              {/* Line */}
              <motion.path
                d="M0,90 L70,75 L140,60 L210,70 L280,40 L350,45 L420,25 L500,15"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
              />
              {/* Dots */}
              {[
                [0, 90], [70, 75], [140, 60], [210, 70], [280, 40], [350, 45], [420, 25], [500, 15],
              ].map(([cx, cy], i) => (
                <motion.circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="3.5"
                  fill="#0ea5e9"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.15 }}
                />
              ))}
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
