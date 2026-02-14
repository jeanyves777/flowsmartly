"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Users,
  Sparkles,
  ArrowUpRight,
  Megaphone,
  Mail,
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

export function LoginIllustration() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="w-full max-w-md"
    >
      {/* Heading */}
      <motion.div variants={fadeIn} className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
        <p className="text-white/70">Your dashboard is waiting for you</p>
      </motion.div>

      {/* Dashboard mockup */}
      <motion.div
        variants={fadeIn}
        className="rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl overflow-hidden"
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 text-xs text-white/50">
              <LayoutDashboard className="w-3 h-3" />
              flowsmartly.com/dashboard
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Users,
                label: "Followers",
                value: "12.4K",
                change: "+8.2%",
                color: "text-sky-300",
              },
              {
                icon: TrendingUp,
                label: "Engagement",
                value: "24.1%",
                change: "+3.7%",
                color: "text-emerald-300",
              },
              {
                icon: Sparkles,
                label: "AI Credits",
                value: "2,450",
                change: "+150",
                color: "text-violet-300",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={fadeIn}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
                <div className="text-lg font-bold text-white">{stat.value}</div>
                <div className="text-[10px] text-white/50">{stat.label}</div>
                <div className="flex items-center gap-0.5 mt-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">
                    {stat.change}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Chart area */}
          <motion.div
            variants={fadeIn}
            className="rounded-xl bg-white/5 border border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-white/70" />
                <span className="text-xs font-medium text-white/80">
                  Performance
                </span>
              </div>
              <span className="text-xs text-emerald-400">+18.3%</span>
            </div>
            {/* SVG Chart */}
            <svg
              viewBox="0 0 320 80"
              className="w-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Grid lines */}
              {[0, 20, 40, 60].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="320"
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                />
              ))}
              {/* Area fill */}
              <motion.path
                d="M0 70 L40 55 L80 60 L120 40 L160 45 L200 25 L240 30 L280 15 L320 10 L320 80 L0 80Z"
                fill="url(#loginGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
              />
              {/* Line */}
              <motion.path
                d="M0 70 L40 55 L80 60 L120 40 L160 45 L200 25 L240 30 L280 15 L320 10"
                stroke="rgba(56,189,248,0.8)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
              />
              {/* Dots */}
              {[
                [0, 70],
                [80, 60],
                [160, 45],
                [240, 30],
                [320, 10],
              ].map(([cx, cy], i) => (
                <motion.circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill="#38bdf8"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.15 }}
                />
              ))}
              <defs>
                <linearGradient
                  id="loginGradient"
                  x1="160"
                  y1="0"
                  x2="160"
                  y2="80"
                >
                  <stop offset="0%" stopColor="rgba(56,189,248,0.3)" />
                  <stop offset="100%" stopColor="rgba(56,189,248,0)" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>

          {/* Recent activity */}
          <motion.div
            variants={fadeIn}
            className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3"
          >
            <div className="text-xs font-medium text-white/80 mb-2">
              Recent Activity
            </div>
            {[
              {
                icon: Sparkles,
                text: "AI generated 3 posts",
                time: "2m ago",
                color: "text-violet-300",
              },
              {
                icon: Megaphone,
                text: "Campaign reached 5K views",
                time: "1h ago",
                color: "text-sky-300",
              },
              {
                icon: Mail,
                text: "Email sent to 1,200 contacts",
                time: "3h ago",
                color: "text-pink-300",
              },
            ].map((item, i) => (
              <motion.div
                key={item.text}
                variants={fadeIn}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/80 truncate">{item.text}</p>
                </div>
                <span className="text-[10px] text-white/40 whitespace-nowrap">
                  {item.time}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
