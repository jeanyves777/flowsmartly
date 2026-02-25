"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Download,
  Link as LinkIcon,
  Check,
} from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  onDownload?: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export function AudioPlayer({ audioUrl, onDownload }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [copied, setCopied] = useState(false);

  // Attach event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleTimeUpdate() {
      setCurrentTime(audio!.currentTime);
    }

    function handleLoadedMetadata() {
      setDuration(audio!.duration);
    }

    function handleEnded() {
      setIsPlaying(false);
      setCurrentTime(0);
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  // Reset state when audioUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  function handleSpeedChange(rate: number) {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const bar = progressRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(audioUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-muted/50 border border-border rounded-2xl p-6 space-y-4"
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="w-full h-2 rounded-full bg-muted cursor-pointer group relative"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-100 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white flex items-center justify-center shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all shrink-0"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        {/* Time display */}
        <span className="text-sm font-mono text-foreground min-w-[90px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {SPEED_OPTIONS.map((rate) => (
            <button
              key={rate}
              onClick={() => handleSpeedChange(rate)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                playbackRate === rate
                  ? "bg-brand-500/20 text-brand-500 border border-brand-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          <Download className="w-4 h-4" />
          Download MP3
        </button>

        <button
          onClick={handleCopyUrl}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <LinkIcon className="w-4 h-4" />
              Copy URL
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
