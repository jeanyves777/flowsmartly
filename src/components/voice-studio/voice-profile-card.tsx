"use client";

import { motion } from "framer-motion";
import { Mic, UserCircle, Star, Trash2 } from "lucide-react";

interface VoiceProfileCardProps {
  profile: {
    id: string;
    name: string;
    type: string;
    gender?: string | null;
    accent?: string | null;
    style?: string | null;
    isDefault: boolean;
    lastUsedAt?: string | null;
  };
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function VoiceProfileCard({
  profile,
  isSelected = false,
  onSelect,
  onDelete,
}: VoiceProfileCardProps) {
  const isCloned = profile.type === "cloned";

  const details = [profile.gender, profile.accent, profile.style]
    .filter(Boolean)
    .map(capitalize)
    .join(" / ");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`bg-white/5 backdrop-blur-sm border rounded-2xl p-4 transition-all ${
        isSelected
          ? "border-purple-500 shadow-[0_0_16px_rgba(147,51,234,0.25)]"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCloned
              ? "bg-cyan-500/10 text-cyan-400"
              : "bg-purple-500/10 text-purple-400"
          }`}
        >
          {isCloned ? (
            <UserCircle className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">
              {profile.name}
            </h3>
            {profile.isDefault && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            )}
          </div>

          {/* Type badge */}
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              isCloned
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
            }`}
          >
            {isCloned ? "Cloned" : "Preset"}
          </span>
        </div>
      </div>

      {/* Details */}
      {details && (
        <p className="mt-3 text-xs text-gray-400">{details}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        <button
          onClick={() => onSelect(profile.id)}
          className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isSelected
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
              : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          {isSelected ? "Selected" : "Use"}
        </button>

        <button
          onClick={() => onDelete(profile.id)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Delete profile"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
