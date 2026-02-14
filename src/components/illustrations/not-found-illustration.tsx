"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";

export function NotFoundIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg viewBox="0 0 400 300" className="w-full h-auto" aria-hidden="true">
        <defs>
          <linearGradient id="nf-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Background circles */}
        <motion.circle
          cx="200" cy="150" r="120"
          fill="none"
          stroke="url(#nf-grad)"
          strokeWidth="1"
          strokeOpacity="0.15"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.circle
          cx="200" cy="150" r="90"
          fill="none"
          stroke="url(#nf-grad)"
          strokeWidth="1"
          strokeOpacity="0.1"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* 404 text */}
        <motion.text
          x="200" y="165"
          textAnchor="middle"
          className="font-bold"
          fontSize="72"
          fill="url(#nf-grad)"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          404
        </motion.text>

        {/* Floating question marks */}
        {[
          { x: 90, y: 80, delay: 0 },
          { x: 310, y: 70, delay: 0.5 },
          { x: 70, y: 200, delay: 1 },
          { x: 330, y: 190, delay: 0.8 },
        ].map((q, i) => (
          <motion.text
            key={i}
            x={q.x} y={q.y}
            textAnchor="middle"
            fontSize="20"
            fill="currentColor"
            fillOpacity="0.15"
            animate={{
              y: [q.y, q.y - 8, q.y],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: q.delay,
              ease: "easeInOut",
            }}
          >
            ?
          </motion.text>
        ))}
      </svg>

      {/* Magnifying glass icon */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-12"
        animate={{
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Search className="w-8 h-8 text-muted-foreground/30" />
      </motion.div>
    </div>
  );
}
