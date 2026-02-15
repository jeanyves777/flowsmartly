"use client";

import { motion } from "framer-motion";
import {
  Search,
  Star,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Filter,
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

const scaleIn = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, type: "spring" } },
};

const agents = [
  {
    name: "Sarah Mitchell",
    specialty: "Social Media",
    rating: 4.9,
    reviews: 127,
    price: "$250/mo",
    score: 94,
    color: "from-accent-purple to-pink-500",
    industries: ["E-Commerce", "Beauty"],
  },
  {
    name: "James Chen",
    specialty: "Content Strategy",
    rating: 4.8,
    reviews: 89,
    price: "$350/mo",
    score: 91,
    color: "from-brand-500 to-accent-teal",
    industries: ["SaaS", "Tech"],
  },
  {
    name: "Maria Gonzalez",
    specialty: "Paid Ads",
    rating: 5.0,
    reviews: 203,
    price: "$500/mo",
    score: 97,
    color: "from-emerald-500 to-brand-500",
    industries: ["Finance", "Real Estate"],
  },
];

const filters = [
  { label: "Social Media", active: true },
  { label: "Content", active: false },
  { label: "Paid Ads", active: false },
  { label: "Email", active: false },
];

export function MarketplacePreview() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-2xl bg-card"
    >
      <div className="flex min-h-[340px] sm:min-h-[420px]">
        {/* Filter Sidebar */}
        <motion.div
          variants={container}
          className="hidden sm:flex w-48 flex-col bg-muted/50 border-r p-4"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </motion.div>

          {/* Search */}
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card mb-4"
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Search agents...</span>
          </motion.div>

          {/* Specialty filters */}
          <motion.div variants={fadeUp} className="mb-4">
            <span className="text-xs font-medium text-muted-foreground mb-2 block">Specialty</span>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <span
                  key={f.label}
                  className={`text-[10px] px-2 py-1 rounded-full ${
                    f.active
                      ? "bg-accent-purple/10 text-accent-purple font-medium"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Price range */}
          <motion.div variants={fadeUp} className="mb-4">
            <span className="text-xs font-medium text-muted-foreground mb-2 block">Price Range</span>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent-purple to-brand-500"
                initial={{ width: 0 }}
                whileInView={{ width: "65%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.6 }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>$100</span>
              <span>$1,000</span>
            </div>
          </motion.div>

          {/* Rating filter */}
          <motion.div variants={fadeUp}>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">Min Rating</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <motion.div
                  key={s}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 + s * 0.1 }}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      s <= 4 ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
                    }`}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Agent Cards Grid */}
        <div className="flex-1 p-4 sm:p-5">
          {/* Header */}
          <motion.div variants={fadeUp} className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-sm">Agent Marketplace</h4>
              <p className="text-[10px] text-muted-foreground">324 agents available</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Sort: Top Rated</span>
            </div>
          </motion.div>

          {/* Agent cards */}
          <motion.div variants={container} className="space-y-3">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.name}
                variants={fadeUp}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-shadow"
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-sm font-bold">
                    {agent.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{agent.name}</span>
                    <motion.div variants={scaleIn}>
                      <ShieldCheck className="w-3 h-3 text-brand-500 flex-shrink-0" />
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple font-medium">
                      {agent.specialty}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-medium">{agent.rating}</span>
                      <span className="text-[10px] text-muted-foreground">({agent.reviews})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {agent.industries.map((ind) => (
                      <span key={ind} className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="w-2 h-2" />
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score + Price */}
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <div className="text-xs font-bold text-accent-purple">{agent.price}</div>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span className="text-[10px] text-muted-foreground">Score</span>
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-emerald-500"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${agent.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.2 }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-emerald-500">{agent.score}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
