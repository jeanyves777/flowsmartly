"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  Mic,
  MicOff,
  X,
  Pause,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  AlertCircle,
  ChevronDown,
  Star,
} from "lucide-react";

// ─── Sample Scripts ───────────────────────────────────────────────
const SAMPLE_SCRIPTS = [
  {
    title: "Professional Intro",
    text: "Hello, and welcome. My name is... and I'm here to share something exciting with you today. Over the next few minutes, we'll explore ideas that can transform the way you think about content creation. Whether you're a seasoned creator or just getting started, there's something here for everyone. Let's dive in and discover what's possible when creativity meets technology. I believe the best content comes from authentic voices, and that's exactly what we're building together.",
    estimatedSeconds: 45,
  },
  {
    title: "Storytelling",
    text: "It was a quiet morning when everything changed. The sun had barely risen, casting long shadows across the empty streets. I remember looking out the window, coffee in hand, thinking about all the possibilities that lay ahead. There's a certain magic in those early hours, before the world wakes up, when your thoughts are the clearest and your dreams feel the most real. That morning taught me that the best stories begin in the most unexpected moments.",
    estimatedSeconds: 40,
  },
  {
    title: "Energetic Promo",
    text: "Are you ready to take your content to the next level? Because today, we're talking about the tools and strategies that top creators use to stand out from the crowd. From eye-catching visuals to compelling scripts, we've got everything you need to make an impact. Don't just follow trends, set them! Your audience is waiting for something fresh, something bold, something uniquely you. Let's make it happen, starting right now!",
    estimatedSeconds: 35,
  },
  {
    title: "Calm & Warm",
    text: "Take a deep breath and relax. In this fast-paced world, it's important to slow down and appreciate the simple things. Today, I want to talk to you about finding balance, about creating content that resonates on a deeper level. When you speak from the heart, people listen. When you share your authentic self, connections happen naturally. So let's take this journey together, one word at a time, and see where it leads us.",
    estimatedSeconds: 40,
  },
];

const SCROLL_SPEEDS = {
  slow: { label: "Slow", pxPerInterval: 1, intervalMs: 50 },
  normal: { label: "Normal", pxPerInterval: 1, intervalMs: 30 },
  fast: { label: "Fast", pxPerInterval: 2, intervalMs: 30 },
} as const;

const MAX_DURATION = 300; // 5 minutes
const MIN_DURATION = 10;

type RecordingState = "idle" | "recording" | "paused" | "stopped";
type ScrollSpeed = keyof typeof SCROLL_SPEEDS;

// ─── Stagger Variants ─────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Props ────────────────────────────────────────────────────────
interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
}

export function VoiceRecorderModal({
  isOpen,
  onClose,
  onRecordingComplete,
}: VoiceRecorderModalProps) {
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Teleprompter state
  const [selectedScriptIndex, setSelectedScriptIndex] = useState(0);
  const [isCustomScript, setIsCustomScript] = useState(false);
  const [customScriptText, setCustomScriptText] = useState("");
  const [scrollSpeed, setScrollSpeed] = useState<ScrollSpeed>("normal");

  // Permission state
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Volume meter
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Preview playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const currentScript = isCustomScript
    ? customScriptText
    : SAMPLE_SCRIPTS[selectedScriptIndex]?.text || "";

  // ─── Cleanup ──────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Stop media tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Stop media recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    // Close audio context
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear intervals
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = null;
    }

    // Revoke object URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    // Stop preview audio
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, [audioUrl]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setRecordingState("idle");
      setRecordedBlob(null);
      setDurationSeconds(0);
      setAudioUrl(null);
      setVolumeLevel(0);
      setIsPlaying(false);
      setPlaybackProgress(0);
      setPermissionState("prompt");
      setPermissionError(null);
      audioChunksRef.current = [];
    }
    return () => {
      cleanup();
    };
  }, [isOpen, cleanup]);

  // ─── Volume Meter ─────────────────────────────────────────────
  const updateVolumeMeter = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average =
      dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
    const normalized = Math.min(1, average / 128);
    setVolumeLevel(normalized);
    animationFrameRef.current = requestAnimationFrame(updateVolumeMeter);
  }, []);

  // ─── Teleprompter Auto-scroll ─────────────────────────────────
  const startAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    const speed = SCROLL_SPEEDS[scrollSpeed];
    scrollIntervalRef.current = setInterval(() => {
      teleprompterRef.current?.scrollBy({
        top: speed.pxPerInterval,
        behavior: "auto",
      });
    }, speed.intervalMs);
  }, [scrollSpeed]);

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  // Restart auto-scroll when speed changes during recording
  useEffect(() => {
    if (recordingState === "recording") {
      startAutoScroll();
    }
    return () => stopAutoScroll();
  }, [scrollSpeed, recordingState, startAutoScroll, stopAutoScroll]);

  // Pause auto-scroll on user manual scroll
  const handleTeleprompterWheel = useCallback(() => {
    if (recordingState !== "recording") return;
    stopAutoScroll();
    if (userScrollTimeoutRef.current)
      clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      if (recordingState === "recording") startAutoScroll();
    }, 3000);
  }, [recordingState, startAutoScroll, stopAutoScroll]);

  // ─── Mic Access ───────────────────────────────────────────────
  const requestMicAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionState("granted");
      setPermissionError(null);

      // Set up Web Audio API for volume meter
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      return stream;
    } catch (err) {
      setPermissionState("denied");
      setPermissionError(
        err instanceof Error
          ? err.message
          : "Microphone access was denied. Please allow access in your browser settings."
      );
      return null;
    }
  }, []);

  // ─── Recording Controls ───────────────────────────────────────
  const startRecording = useCallback(async () => {
    let stream = streamRef.current;
    if (!stream) {
      stream = await requestMicAccess();
      if (!stream) return;
    }

    audioChunksRef.current = [];
    setRecordedBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDurationSeconds(0);
    setPlaybackProgress(0);

    // Find supported MIME type
    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "",
    ];
    let mimeType = "";
    for (const mt of mimeTypes) {
      if (mt === "" || MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setAudioUrl(url);
    };

    recorder.start(250);
    setRecordingState("recording");

    // Start timer
    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds((prev) => {
        if (prev + 1 >= MAX_DURATION) {
          stopRecording();
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);

    // Start volume meter
    updateVolumeMeter();

    // Start teleprompter auto-scroll
    startAutoScroll();

    // Reset teleprompter scroll position
    if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
  }, [requestMicAccess, audioUrl, updateVolumeMeter, startAutoScroll]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopAutoScroll();
    setRecordingState("paused");
  }, [stopAutoScroll]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds((prev) => {
        if (prev + 1 >= MAX_DURATION) {
          stopRecording();
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
    updateVolumeMeter();
    startAutoScroll();
    setRecordingState("recording");
  }, [updateVolumeMeter, startAutoScroll]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopAutoScroll();
    setVolumeLevel(0);
    setRecordingState("stopped");
  }, [stopAutoScroll]);

  const reRecord = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setRecordedBlob(null);
    setAudioUrl(null);
    setDurationSeconds(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
    setRecordingState("idle");
  }, [audioUrl]);

  const handleUseRecording = useCallback(() => {
    if (!recordedBlob) return;
    onRecordingComplete(recordedBlob, durationSeconds);
  }, [recordedBlob, durationSeconds, onRecordingComplete]);

  // ─── Preview Playback ─────────────────────────────────────────
  const togglePreviewPlayback = useCallback(() => {
    if (!audioUrl) return;

    if (isPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!previewAudioRef.current) {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPlaybackProgress(audio.currentTime / audio.duration);
        }
      };
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
      };
    }

    previewAudioRef.current.play().catch(() => {});
    setIsPlaying(true);
  }, [audioUrl, isPlaying]);

  // ─── Quality Badge ────────────────────────────────────────────
  const getQualityBadge = () => {
    if (durationSeconds < MIN_DURATION) {
      return {
        text: `Too short (min ${MIN_DURATION}s)`,
        color: "text-red-400 bg-red-500/10 border-red-500/20",
      };
    }
    if (durationSeconds < 30) {
      return {
        text: "Fair - record 30s+ for better results",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      };
    }
    if (durationSeconds < 120) {
      return {
        text: "Good quality",
        color: "text-green-400 bg-green-500/10 border-green-500/20",
        icon: true,
      };
    }
    return {
      text: "Best quality",
      color: "text-green-400 bg-green-500/10 border-green-500/20",
      star: true,
    };
  };

  // ─── Handle close safely ──────────────────────────────────────
  const handleClose = useCallback(() => {
    if (recordingState === "recording" || recordingState === "paused") {
      stopRecording();
    }
    onClose();
  }, [recordingState, stopRecording, onClose]);

  if (!isOpen) return null;

  const quality = getQualityBadge();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card backdrop-blur-xl border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ─── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Voice Recorder
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Read the script aloud to clone your voice
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ─── Body ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Permission denied state */}
              {permissionState === "denied" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center space-y-3"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                    <MicOff className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-foreground font-medium">
                    Microphone Access Required
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {permissionError ||
                      "Please allow microphone access in your browser settings to record your voice."}
                  </p>
                  <button
                    onClick={requestMicAccess}
                    className="px-5 py-2.5 rounded-full bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-all"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}

              {permissionState !== "denied" && (
                <>
                  {/* ─── Script Selection ─────────────────────── */}
                  {recordingState === "idle" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-500" />
                        Choose a Script
                      </label>
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="flex flex-wrap gap-2"
                      >
                        {SAMPLE_SCRIPTS.map((script, i) => (
                          <motion.button
                            key={i}
                            variants={staggerItem}
                            onClick={() => {
                              setSelectedScriptIndex(i);
                              setIsCustomScript(false);
                            }}
                            className={cn(
                              "px-4 py-2 rounded-full text-sm font-medium transition-all",
                              !isCustomScript && selectedScriptIndex === i
                                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                                : "bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {script.title}
                          </motion.button>
                        ))}
                        <motion.button
                          variants={staggerItem}
                          onClick={() => setIsCustomScript(true)}
                          className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all",
                            isCustomScript
                              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                              : "bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                          )}
                        >
                          Custom
                        </motion.button>
                      </motion.div>

                      {/* Custom script textarea */}
                      <AnimatePresence>
                        {isCustomScript && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <textarea
                              value={customScriptText}
                              onChange={(e) =>
                                setCustomScriptText(e.target.value)
                              }
                              placeholder="Paste or type your script here... (at least a few sentences for best results)"
                              rows={4}
                              className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-500/30 focus:border-transparent resize-none mt-2"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Script info */}
                      {currentScript && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {currentScript.split(/\s+/).filter(Boolean).length}{" "}
                            words
                          </span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                          <span>
                            ~
                            {Math.round(
                              currentScript.split(/\s+/).filter(Boolean)
                                .length / 2.5
                            )}
                            s to read
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ─── Teleprompter ─────────────────────────── */}
                  <div className="space-y-2">
                    <div className="relative bg-muted/50 border border-border rounded-2xl overflow-hidden">
                      {/* Gradient fade overlays */}
                      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-card/90 to-transparent z-10 pointer-events-none rounded-t-2xl" />
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card/90 to-transparent z-10 pointer-events-none rounded-b-2xl" />

                      <div
                        ref={teleprompterRef}
                        onWheel={handleTeleprompterWheel}
                        className="h-[200px] overflow-y-auto px-6 py-8 scroll-smooth"
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        {currentScript ? (
                          <p className="text-xl sm:text-2xl leading-relaxed font-medium text-foreground tracking-wide">
                            {currentScript}
                          </p>
                        ) : (
                          <p className="text-xl text-muted-foreground text-center mt-12">
                            Select or type a script above to begin
                          </p>
                        )}
                      </div>

                      {/* Recording overlay indicator */}
                      {recordingState === "recording" && (
                        <div className="absolute top-3 right-3 z-20">
                          <motion.div
                            animate={{
                              scale: [1, 1.15, 1],
                              opacity: [1, 0.7, 1],
                            }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30"
                          >
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-medium text-red-400">
                              REC
                            </span>
                          </motion.div>
                        </div>
                      )}

                      {recordingState === "paused" && (
                        <div className="absolute top-3 right-3 z-20">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-xs font-medium text-amber-400">
                              PAUSED
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Scroll speed controls */}
                    {(recordingState === "recording" ||
                      recordingState === "paused") && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <span className="text-xs text-muted-foreground mr-1">
                          Scroll:
                        </span>
                        {(
                          Object.keys(SCROLL_SPEEDS) as ScrollSpeed[]
                        ).map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setScrollSpeed(speed)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium transition-all",
                              scrollSpeed === speed
                                ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {SCROLL_SPEEDS[speed].label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* ─── Recording Controls ───────────────────── */}
                  <div className="bg-muted/50 border border-border rounded-2xl p-5 space-y-4">
                    {/* Timer + Volume Meter */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Timer */}
                        <span className="font-mono text-2xl text-foreground min-w-[70px]">
                          {formatTime(durationSeconds)}
                        </span>

                        {/* Max duration hint */}
                        {recordingState !== "idle" &&
                          recordingState !== "stopped" && (
                            <span className="text-xs text-muted-foreground">
                              / {formatTime(MAX_DURATION)}
                            </span>
                          )}
                      </div>

                      {/* Volume meter */}
                      {(recordingState === "recording" ||
                        recordingState === "paused") && (
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-muted-foreground" />
                          <div className="w-32 h-3 bg-muted rounded-full overflow-hidden border border-border">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                              animate={{ width: `${volumeLevel * 100}%` }}
                              transition={{ duration: 0.05 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quality badge */}
                    {durationSeconds > 0 && recordingState !== "idle" && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                          quality.color
                        )}
                      >
                        {quality.star && <Star className="w-3 h-3" />}
                        {quality.text}
                      </motion.div>
                    )}

                    {/* Control buttons */}
                    <div className="flex items-center justify-center gap-3">
                      <AnimatePresence mode="wait">
                        {recordingState === "idle" && (
                          <motion.button
                            key="start"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={startRecording}
                            disabled={!currentScript.trim()}
                            className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-brand-500 text-white font-medium hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Mic className="w-5 h-5" />
                            Start Recording
                          </motion.button>
                        )}

                        {recordingState === "recording" && (
                          <motion.div
                            key="recording-controls"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex items-center gap-3"
                          >
                            <button
                              onClick={pauseRecording}
                              className="flex items-center gap-2 px-5 py-3 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-medium hover:bg-amber-500/30 transition-all"
                            >
                              <Pause className="w-4 h-4" />
                              Pause
                            </button>
                            <button
                              onClick={stopRecording}
                              className="flex items-center gap-2 px-5 py-3 rounded-full bg-muted border border-border text-foreground font-medium hover:bg-accent transition-all"
                            >
                              <Square className="w-4 h-4" />
                              Stop
                            </button>
                          </motion.div>
                        )}

                        {recordingState === "paused" && (
                          <motion.div
                            key="paused-controls"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex items-center gap-3"
                          >
                            <button
                              onClick={resumeRecording}
                              className="flex items-center gap-2 px-5 py-3 rounded-full bg-brand-500 text-white font-medium hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                            >
                              <Mic className="w-4 h-4" />
                              Resume
                            </button>
                            <button
                              onClick={stopRecording}
                              className="flex items-center gap-2 px-5 py-3 rounded-full bg-muted border border-border text-foreground font-medium hover:bg-accent transition-all"
                            >
                              <Square className="w-4 h-4" />
                              Stop
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Warning at 4 minutes */}
                    {durationSeconds >= 240 &&
                      recordingState === "recording" && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Recording will auto-stop in{" "}
                          {MAX_DURATION - durationSeconds}s
                        </motion.div>
                      )}
                  </div>

                  {/* ─── Preview Section ──────────────────────── */}
                  <AnimatePresence>
                    {recordingState === "stopped" && recordedBlob && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="bg-muted/50 border border-border rounded-2xl p-5 space-y-4"
                      >
                        <h3 className="text-sm font-medium text-foreground">
                          Preview Recording
                        </h3>

                        {/* Mini player */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={togglePreviewPlayback}
                              className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 flex-shrink-0"
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4 text-white" />
                              ) : (
                                <Play className="w-4 h-4 text-white ml-0.5" />
                              )}
                            </button>

                            {/* Progress bar */}
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-brand-500"
                                style={{
                                  width: `${playbackProgress * 100}%`,
                                }}
                              />
                            </div>

                            <span className="text-xs text-muted-foreground font-mono min-w-[40px]">
                              {formatTime(durationSeconds)}
                            </span>
                          </div>

                          {/* File info */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Duration: {formatTime(durationSeconds)}</span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            <span>
                              Size: ~
                              {(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            <span>
                              {recordedBlob.type.split(";")[0]}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={reRecord}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all text-sm font-medium"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Re-record
                          </button>
                          <button
                            onClick={handleUseRecording}
                            disabled={durationSeconds < MIN_DURATION}
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Sparkles className="w-4 h-4" />
                            Use This Recording
                          </button>
                        </div>

                        {durationSeconds < MIN_DURATION && (
                          <p className="text-xs text-red-400 text-center">
                            Recording must be at least {MIN_DURATION} seconds to
                            use for voice cloning.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
