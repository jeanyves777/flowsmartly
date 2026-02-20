"use client";

import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TrendingTopic {
  tag: string;
  postCount: number;
}

interface TrendingTopicsProps {
  topics: TrendingTopic[];
  /** "bars" = sidebar list with animated gradient bars, "badges" = compact horizontal wrap */
  variant?: "bars" | "badges";
  onTopicClick?: (tag: string) => void;
}

const COLORS = [
  { bar: "from-brand-500/20 to-brand-500/5", text: "text-brand-600", badge: "bg-brand-500/10 text-brand-600 border-brand-500/20" },
  { bar: "from-violet-500/20 to-violet-500/5", text: "text-violet-600", badge: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  { bar: "from-blue-500/20 to-blue-500/5", text: "text-blue-600", badge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { bar: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-600", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { bar: "from-amber-500/20 to-amber-500/5", text: "text-amber-600", badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
];

export function TrendingTopics({ topics, variant = "bars", onTopicClick }: TrendingTopicsProps) {
  if (!topics || topics.length === 0) return null;

  const maxCount = Math.max(...topics.map((t) => t.postCount), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
            <Hash className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <h3 className="font-semibold text-sm">Trending Topics</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {variant === "badges" ? (
          <div className="flex flex-wrap gap-2">
            {topics.map((topic, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <motion.div
                  key={topic.tag}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                >
                  <Badge
                    variant="outline"
                    className={`${color.badge} px-2.5 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => onTopicClick?.(topic.tag)}
                  >
                    <Hash className="w-3 h-3 mr-0.5" />
                    {topic.tag.replace(/^#/, "")}
                    <span className="ml-1.5 text-[10px] opacity-70">{topic.postCount}</span>
                  </Badge>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {topics.map((topic, i) => {
              const color = COLORS[i % COLORS.length];
              const barWidth = Math.max((topic.postCount / maxCount) * 100, 12);

              return (
                <motion.div
                  key={topic.tag}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onTopicClick?.(topic.tag)}
                >
                  <motion.div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color.bar} rounded-lg`}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: "easeOut" }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold ${color.text} w-4 shrink-0`}>{i + 1}</span>
                      <p className="text-sm font-medium truncate">{topic.tag}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 ml-2">
                      {topic.postCount} {topic.postCount === 1 ? "post" : "posts"}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
