"use client";

import { motion } from "framer-motion";
import { TrendingUp, Eye, Heart, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface TrendingPost {
  id: string;
  content: string;
  mediaUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

interface TrendingPostsProps {
  posts: TrendingPost[];
  onPostClick?: (post: TrendingPost) => void;
  /** Grid layout for mobile (2 cols) */
  grid?: boolean;
  /** Max items to show */
  limit?: number;
}

export function TrendingPosts({ posts, onPostClick, grid = false, limit }: TrendingPostsProps) {
  if (!posts || posts.length === 0) return null;

  const visiblePosts = limit ? posts.slice(0, limit) : posts;
  const containerClass = grid ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-3";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-brand-500/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <h3 className="font-semibold text-sm">Trending Posts</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={containerClass}>
          {visiblePosts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="border rounded-lg p-2.5 hover:bg-muted/30 hover:border-brand-500/30 transition-colors cursor-pointer"
              onClick={() => onPostClick?.(post)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={post.authorAvatar || undefined} />
                  <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{post.authorName}</span>
              </div>
              {post.mediaUrl && (
                <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
                  <img
                    src={post.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <p className="text-xs line-clamp-2">{post.content}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" /> {formatCount(post.viewCount || 0)}
                </span>
                <span className="flex items-center gap-0.5">
                  <Heart className="w-3 h-3" /> {formatCount(post.likeCount || 0)}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageCircle className="w-3 h-3" /> {formatCount(post.commentCount || 0)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
