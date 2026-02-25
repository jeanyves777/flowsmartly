"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  GENDERS,
  ACCENTS,
  STYLES,
  VOICE_PRESETS,
  type VoiceGender,
  type VoiceAccent,
  type VoiceStyle,
} from "@/lib/voice/voice-presets";

interface VoiceSelectorProps {
  gender: string;
  accent: string;
  style: string;
  speed: number;
  onGenderChange: (g: string) => void;
  onAccentChange: (a: string) => void;
  onStyleChange: (s: string) => void;
  onSpeedChange: (s: number) => void;
}

const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function VoiceSelector({
  gender,
  accent,
  style,
  speed,
  onGenderChange,
  onAccentChange,
  onStyleChange,
  onSpeedChange,
}: VoiceSelectorProps) {
  const activePresetId = VOICE_PRESETS.find(
    (p) => p.gender === gender && p.accent === accent && p.style === style
  )?.id;

  function applyPreset(preset: (typeof VOICE_PRESETS)[number]) {
    onGenderChange(preset.gender);
    onAccentChange(preset.accent);
    onStyleChange(preset.style);
  }

  return (
    <div className="space-y-6">
      {/* Quick Presets */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-300">Quick Presets</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {VOICE_PRESETS.map((preset) => (
            <motion.button
              key={preset.id}
              variants={staggerItem}
              onClick={() => applyPreset(preset)}
              className={`px-3 py-2 rounded-xl text-left transition-all ${
                activePresetId === preset.id
                  ? "bg-white/10 border-2 border-purple-500 shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                  : "bg-white/5 border border-white/10 cursor-pointer hover:border-purple-500/50"
              }`}
            >
              <p className="text-sm font-medium text-white">{preset.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{preset.description}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Gender */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <label className="text-sm font-medium text-gray-300">Gender</label>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <motion.button
              key={g.id}
              variants={staggerItem}
              onClick={() => onGenderChange(g.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                gender === g.id
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Accent */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <label className="text-sm font-medium text-gray-300">Accent</label>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <motion.button
              key={a.id}
              variants={staggerItem}
              onClick={() => onAccentChange(a.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                accent === a.id
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {a.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Style */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <label className="text-sm font-medium text-gray-300">Style</label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <motion.button
              key={s.id}
              variants={staggerItem}
              onClick={() => onStyleChange(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                style === s.id
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {s.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Speed */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Speed</label>
          <span className="text-sm font-mono text-purple-400">{speed.toFixed(2)}x</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.25}
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-gradient-to-r
              [&::-webkit-slider-thumb]:from-purple-600
              [&::-webkit-slider-thumb]:to-indigo-600
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-white/20
              [&::-moz-range-thumb]:appearance-none
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-gradient-to-r
              [&::-moz-range-thumb]:from-purple-600
              [&::-moz-range-thumb]:to-indigo-600
              [&::-moz-range-thumb]:shadow-lg
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-white/20"
          />
          <div className="flex justify-between mt-1 px-0.5">
            <span className="text-[10px] text-gray-500">0.5x</span>
            <span className="text-[10px] text-gray-500">1.0x</span>
            <span className="text-[10px] text-gray-500">1.5x</span>
            <span className="text-[10px] text-gray-500">2.0x</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
