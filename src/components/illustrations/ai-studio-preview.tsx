"use client";

import { motion } from "framer-motion";
import { Sparkles, PenSquare, Image as ImageIcon, Video, Wand2 } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const typingLines = [
  "Introducing our latest AI-powered features...",
  "Create stunning content in seconds with FlowAI.",
  "From blog posts to social media, we've got you covered.",
];

function TypingLine({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      className="flex items-start gap-2"
      initial={{ opacity: 0, width: 0 }}
      whileInView={{ opacity: 1, width: "100%" }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, delay, ease: "easeOut" }}
    >
      <div className="h-4 overflow-hidden text-sm text-muted-foreground whitespace-nowrap">
        {text}
      </div>
    </motion.div>
  );
}

export function AIStudioPreview() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-xl bg-card"
    >
      <div className="p-6">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold">FlowAI Content Studio</h4>
            <p className="text-xs text-muted-foreground">AI-powered content generation</p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Input area */}
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Prompt</label>
              <div className="text-sm">
                Write a social media post about our new AI content creation platform...
              </div>
              <div className="flex items-center gap-2 pt-2">
                <motion.button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate
                </motion.button>
                <span className="text-xs text-muted-foreground">~2 sec</span>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-2">
              {["Blog Post", "Tweet", "Caption", "Ad Copy"].map((type, i) => (
                <motion.span
                  key={type}
                  variants={fadeUp}
                  className={`px-2.5 py-1 rounded-full text-xs border ${
                    i === 0 ? "bg-brand-500/10 text-brand-500 border-brand-500/30" : "text-muted-foreground"
                  }`}
                >
                  {type}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {/* Output area */}
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs text-muted-foreground">AI Generated</span>
              </div>
              {typingLines.map((line, i) => (
                <TypingLine key={i} text={line} delay={0.8 + i * 0.6} />
              ))}
            </div>

            {/* Generated content types */}
            <motion.div variants={container} className="flex gap-2">
              {[
                { Icon: PenSquare, label: "Post", color: "text-brand-500" },
                { Icon: ImageIcon, label: "Image", color: "text-accent-purple" },
                { Icon: Video, label: "Video", color: "text-accent-gold" },
              ].map(({ Icon, label, color }) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  className="flex-1 flex items-center gap-2 p-2.5 rounded-lg border bg-card"
                >
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-medium">{label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Decorative sparkle particles */}
      {[
        { top: "10%", right: "5%", delay: 0 },
        { top: "60%", right: "15%", delay: 0.5 },
        { top: "30%", left: "8%", delay: 1 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-brand-500/40"
          style={{ top: pos.top, right: pos.right, left: pos.left }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: pos.delay,
          }}
        />
      ))}
    </motion.div>
  );
}
