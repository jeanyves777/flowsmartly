"use client";

import { motion } from "framer-motion";
import { Megaphone, ExternalLink, DollarSign, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface SponsoredAd {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  mediaUrl: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
}

export interface PromotedPost {
  id: string;
  content: string;
  mediaUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  destinationUrl?: string | null;
  hasEarned?: boolean;
}

interface SponsoredSidebarProps {
  ads?: SponsoredAd[];
  promotedPosts?: PromotedPost[];
  /** Grid layout for mobile (2 cols) */
  grid?: boolean;
  /** Max items to show */
  limit?: number;
}

function MediaImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

export function SponsoredSidebar({ ads = [], promotedPosts = [], grid = false, limit }: SponsoredSidebarProps) {
  // Filter ads that have media
  const adsWithMedia = ads.filter((ad) => ad.mediaUrl);
  const hasContent = adsWithMedia.length > 0 || promotedPosts.length > 0;

  if (!hasContent) return null;

  const allAds = adsWithMedia.slice(0, limit);
  const allPosts = promotedPosts.slice(0, limit ? Math.max(limit - allAds.length, 0) : undefined);

  const containerClass = grid ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-3";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
            <Megaphone className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h3 className="font-semibold text-sm">Sponsored</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={containerClass}>
          {/* Ad campaign cards */}
          {allAds.map((ad, i) => {
            const Wrapper = ad.destinationUrl ? "a" : "div";
            const linkProps = ad.destinationUrl
              ? { href: ad.destinationUrl, target: "_blank" as const, rel: "noopener noreferrer" }
              : {};

            return (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Wrapper
                  {...linkProps}
                  className="block border rounded-lg p-2.5 hover:bg-muted/30 hover:border-brand-500/30 transition-colors cursor-pointer"
                >
                  {ad.mediaUrl && <MediaImage src={ad.mediaUrl} alt={ad.headline || ad.name} />}
                  <p className="text-sm font-medium line-clamp-1">{ad.headline || ad.name}</p>
                  {ad.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description}</p>
                  )}
                  {ad.destinationUrl && (
                    <span className="text-xs text-brand-500 mt-1 inline-flex items-center gap-1">
                      {ad.ctaText || "Learn more"} <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </Wrapper>
              </motion.div>
            );
          })}

          {/* Promoted posts */}
          {allPosts.map((post, i) => {
            const Wrapper = post.destinationUrl ? "a" : "div";
            const linkProps = post.destinationUrl
              ? { href: post.destinationUrl, target: "_blank" as const, rel: "noopener noreferrer" }
              : {};

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (allAds.length + i) * 0.08 }}
              >
                <Wrapper
                  {...linkProps}
                  className="block border rounded-lg p-2.5 hover:bg-muted/30 hover:border-brand-500/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={post.authorAvatar || undefined} />
                      <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium truncate">{post.authorName}</span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 ml-auto"
                    >
                      Boosted
                    </Badge>
                  </div>
                  {post.mediaUrl && <MediaImage src={post.mediaUrl} alt="" />}
                  <p className="text-xs line-clamp-2">{post.content}</p>
                  {post.hasEarned === false && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed">
                      <DollarSign className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[11px] font-medium text-green-600">Earn credits available</span>
                    </div>
                  )}
                  {post.hasEarned === true && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Earned</span>
                    </div>
                  )}
                </Wrapper>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
