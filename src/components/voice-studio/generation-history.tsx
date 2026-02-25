"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Play,
  Pause,
  Download,
  RotateCcw,
} from "lucide-react";

interface Generation {
  id: string;
  script: string;
  audioUrl: string | null;
  durationMs: number | null;
  gender: string | null;
  accent: string | null;
  style: string | null;
  isClonedVoice: boolean;
  createdAt: string;
  voiceProfile?: { name: string; type: string } | null;
}

interface GenerationHistoryProps {
  generations: Generation[];
  onReuse?: (gen: {
    script: string;
    gender: string;
    accent: string;
    style: string;
  }) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// -- Mini audio player for each history item --

function MiniPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function formatTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white flex items-center justify-center shrink-0 hover:from-brand-600 hover:to-brand-700 transition-all"
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>
      <span className="text-xs font-mono text-muted-foreground">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

// -- Stagger animation variants --

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// -- Main component --

export function GenerationHistory({
  generations,
  onReuse,
}: GenerationHistoryProps) {
  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
          <Mic className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No voice generations yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Generate your first voice-over to see it here
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {generations.map((gen) => {
        const truncatedScript =
          gen.script.length > 120
            ? gen.script.slice(0, 120) + "..."
            : gen.script;

        const voiceBadges = [gen.gender, gen.accent, gen.style].filter(Boolean);

        return (
          <motion.div
            key={gen.id}
            variants={itemVariants}
            className="bg-card border border-border rounded-2xl p-4 space-y-3"
          >
            {/* Script preview */}
            <p className="text-sm text-foreground leading-relaxed">
              {truncatedScript}
            </p>

            {/* Mini player */}
            {gen.audioUrl && <MiniPlayer audioUrl={gen.audioUrl} />}

            {/* Voice badges + timestamp */}
            <div className="flex flex-wrap items-center gap-2">
              {voiceBadges.map((badge) => (
                <span
                  key={badge}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted border border-border text-muted-foreground"
                >
                  {capitalize(badge)}
                </span>
              ))}

              {gen.isClonedVoice && gen.voiceProfile && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  {gen.voiceProfile.name}
                </span>
              )}

              {gen.durationMs && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDuration(gen.durationMs)}
                </span>
              )}

              <span className="ml-auto text-[10px] text-muted-foreground">
                {timeAgo(gen.createdAt)}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              {gen.audioUrl && (
                <a
                  href={gen.audioUrl}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              )}

              {onReuse && (
                <button
                  onClick={() =>
                    onReuse({
                      script: gen.script,
                      gender: gen.gender || "",
                      accent: gen.accent || "",
                      style: gen.style || "",
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reuse
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
