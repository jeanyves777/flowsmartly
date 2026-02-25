"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  Clock,
  Type,
} from "lucide-react";

interface ScriptEditorProps {
  script: string;
  onScriptChange: (s: string) => void;
  onGenerate: (topic: string, tone: string, duration: number) => Promise<void>;
  isGenerating: boolean;
  maxLength?: number;
}

const TONES = [
  "Professional",
  "Casual",
  "Persuasive",
  "Informative",
  "Storytelling",
];

const DURATIONS = [
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
  { value: 120, label: "120s" },
];

export function ScriptEditor({
  script,
  onScriptChange,
  onGenerate,
  isGenerating,
  maxLength = 5000,
}: ScriptEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [duration, setDuration] = useState(60);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const charCount = script.length;
  const estimatedSeconds = Math.round((wordCount / 150) * 60);
  const estimatedMin = Math.floor(estimatedSeconds / 60);
  const estimatedSec = estimatedSeconds % 60;

  async function handleGenerate() {
    if (!topic.trim()) return;
    await onGenerate(topic.trim(), tone, duration);
  }

  return (
    <div className="space-y-3">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Type or paste your script here..."
          maxLength={maxLength}
          className="w-full min-h-[200px] rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder:text-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
        />
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Type className="w-3 h-3" />
          {wordCount} words
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {charCount} / {maxLength.toLocaleString()} chars
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          ~{estimatedMin > 0 ? `${estimatedMin}m ` : ""}{estimatedSec}s estimated
        </span>
        {charCount >= maxLength && (
          <span className="text-red-400 font-medium">Character limit reached</span>
        )}
      </div>

      {/* AI Generate Section */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Generate with AI
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                {/* Topic input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Product launch announcement, Podcast intro..."
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  />
                </div>

                {/* Duration + Tone row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Duration */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Duration</label>
                    <div className="flex gap-2">
                      {DURATIONS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setDuration(d.value)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            duration === d.value
                              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                              : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Tone</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all appearance-none cursor-pointer"
                    >
                      {TONES.map((t) => (
                        <option key={t} value={t} className="bg-gray-900 text-white">
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !topic.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Script
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
