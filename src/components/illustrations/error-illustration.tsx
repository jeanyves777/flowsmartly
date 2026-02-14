"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export function ErrorIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg viewBox="0 0 400 300" className="w-full h-auto" aria-hidden="true">
        <defs>
          <linearGradient id="err-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Background pulse rings */}
        {[120, 95, 70].map((r, i) => (
          <motion.circle
            key={i}
            cx="200" cy="150" r={r}
            fill="none"
            stroke="url(#err-grad)"
            strokeWidth="1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: [0, 0.15, 0],
              scale: [0.9, 1.05, 0.9],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Broken gear - left half */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 5, -3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "180px 145px" }}
        >
          <motion.path
            d="M165,120 L175,110 L185,115 L190,105 L200,108 L200,145 L165,145 Z"
            fill="url(#err-grad)"
            fillOpacity="0.2"
            stroke="url(#err-grad)"
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />
        </motion.g>

        {/* Broken gear - right half */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, -4, 6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          style={{ transformOrigin: "220px 155px" }}
        >
          <motion.path
            d="M200,145 L235,145 L235,180 L225,180 L220,190 L210,185 L205,195 L200,192 Z"
            fill="url(#err-grad)"
            fillOpacity="0.15"
            stroke="url(#err-grad)"
            strokeWidth="1.5"
            strokeOpacity="0.3"
          />
        </motion.g>

        {/* Crack line */}
        <motion.path
          d="M195,130 L202,148 L198,155 L205,170"
          fill="none"
          stroke="url(#err-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 1, delay: 0.5 }}
        />

        {/* Glitch spark particles */}
        {[
          { x: 160, y: 110, delay: 0 },
          { x: 240, y: 100, delay: 0.3 },
          { x: 150, y: 180, delay: 0.7 },
          { x: 250, y: 185, delay: 1 },
          { x: 200, y: 90, delay: 0.5 },
        ].map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x} cy={p.y} r="2"
            fill="url(#err-grad)"
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: p.delay,
            }}
          />
        ))}

        {/* X marks */}
        {[
          { x: 120, y: 100 },
          { x: 280, y: 110 },
          { x: 100, y: 200 },
          { x: 300, y: 195 },
        ].map((pos, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.2, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.15 }}
          >
            <line x1={pos.x - 5} y1={pos.y - 5} x2={pos.x + 5} y2={pos.y + 5} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1={pos.x + 5} y1={pos.y - 5} x2={pos.x - 5} y2={pos.y + 5} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </motion.g>
        ))}
      </svg>

      {/* Alert icon overlay */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-2"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <AlertTriangle className="w-12 h-12 text-destructive/60" />
      </motion.div>
    </div>
  );
}
