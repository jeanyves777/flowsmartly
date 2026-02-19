"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  ImagePlus,
  Sparkles,
  Send,
  TrendingUp,
  Users,
  Loader2,
  X,
  AlertTriangle,
  RefreshCw,
  Check,
  Image,
  Video,
  ChevronLeft,
  ChevronRight,
  Link2,
  Mail,
  Eye,
  Reply,
  Trash2,
  ChevronDown,
  AtSign,
  ZoomIn,
  Megaphone,
  Rocket,
  DollarSign,
  Timer,
  CheckCircle2,
  Pause,
  ExternalLink,
  Shield,
  Pencil,
  Lightbulb,
  Upload,
  FolderOpen,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AITextAssistant } from "@/components/feed/ai-text-assistant";
import { AdCard } from "@/components/ads/ad-card";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Real social media SVG icons for sharing
function FacebookShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.462.342.342 0 00-.461 0c-.545.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.345.345 0 00-.206-.095z" />
    </svg>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
    </svg>
  );
}

const SHARE_PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: FacebookShareIcon, color: "#1877F2", getUrl: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: "twitter", label: "X", icon: XShareIcon, color: "#000000", getUrl: (url: string, text: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInShareIcon, color: "#0A66C2", getUrl: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon, color: "#25D366", getUrl: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(text + " " + url)}` },
  { id: "telegram", label: "Telegram", icon: TelegramIcon, color: "#26A5E4", getUrl: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: "reddit", label: "Reddit", icon: RedditIcon, color: "#FF4500", getUrl: (url: string, text: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
  { id: "pinterest", label: "Pinterest", icon: PinterestIcon, color: "#BD081C", getUrl: (url: string, text: string) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}` },
  { id: "email", label: "Email", icon: Mail, color: "#6B7280", getUrl: (url: string, text: string) => `mailto:?subject=${encodeURIComponent("Check this out")}&body=${encodeURIComponent(text + "\n\n" + url)}` },
];

interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewCount?: number;
  isLiked: boolean;
  isBookmarked: boolean;
  isPromoted: boolean;
  hasEarned: boolean;
  destinationUrl?: string | null;
  cpvCents?: number;
  createdAt: string;
}

interface AdCampaignItem {
  id: string;
  isAdCard: true;
  name: string;
  headline: string | null;
  description: string | null;
  mediaUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
  adType: string;
  adPage: { slug: string } | null;
}

type FeedItem = Post | AdCampaignItem;

interface CommentData {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  likesCount: number;
  repliesCount: number;
  createdAt: string;
  isLiked?: boolean;
  replies?: CommentData[];
  showReplies?: boolean;
}

interface MentionUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface TrendingTopic {
  tag: string;
  postCount: number;
}

interface SuggestedUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  followersCount: number;
  isFollowing: boolean;
}

interface MediaFile {
  id: string;
  url: string;
  originalName: string;
  type: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export default function FeedPage() {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [feedAds, setFeedAds] = useState<AdCampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [feedType, setFeedType] = useState<"feed" | "following" | "trending">("feed");
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Edit/Delete post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // AI post idea state
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);

  // Share panel state
  const [expandedSharePostId, setExpandedSharePostId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Comment section state
  const [expandedCommentPostId, setExpandedCommentPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentData[]>>({});
  const [commentLoadingMap, setCommentLoadingMap] = useState<Record<string, boolean>>({});
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string; username: string } | null>(null);
  const [postingCommentMap, setPostingCommentMap] = useState<Record<string, boolean>>({});

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionPostId, setMentionPostId] = useState<string | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Expanded post content state (for "more"/"less" toggle)
  const [expandedPostContent, setExpandedPostContent] = useState<Set<string>>(new Set());
  const POST_TRUNCATE_LENGTH = 280;

  // Media lightbox state
  const [lightboxMedia, setLightboxMedia] = useState<{ urls: string[]; index: number } | null>(null);

  // Media picker state
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<"upload" | "library">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current user info
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");

  // Brand identity for user avatar
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  // Boost dialog state
  const [showBoostDialog, setShowBoostDialog] = useState(false);
  const [boostPostId, setBoostPostId] = useState<string | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);
  const [boostConfig, setBoostConfig] = useState({
    budget: "50",
    duration: "7",
    objective: "ENGAGEMENT",
  });
  const [boostPlatforms, setBoostPlatforms] = useState<Set<string>>(new Set(["feed"]));

  // Ad viewing / Watch & Earn state
  const [activeAdView, setActiveAdView] = useState<{
    postId: string;
    viewId: string;
    startedAt: number;
    earnAmount: number;
  } | null>(null);
  const [adViewProgress, setAdViewProgress] = useState(0);
  const [adViewCompleted, setAdViewCompleted] = useState<string | null>(null); // postId of just-completed view
  const [adEarnedAmount, setAdEarnedAmount] = useState(0);
  const adViewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AD_VIEW_DURATION = 35; // seconds

  // Full-screen focus mode state
  const [adFocusPost, setAdFocusPost] = useState<Post | null>(null);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const focusedTimeRef = useRef(0); // accumulated focused seconds
  const focusPauseTimeRef = useRef(0); // timestamp when paused
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // External link redirect after ad completion
  const [adRedirectUrl, setAdRedirectUrl] = useState<string | null>(null);
  const [adRedirectCountdown, setAdRedirectCountdown] = useState(0);
  const adRedirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dismissed promoted posts (session-based)
  const [dismissedAds, setDismissedAds] = useState<Set<string>>(() => {
    try {
      const stored = typeof window !== "undefined" ? sessionStorage.getItem("dismissedPromotedPosts") : null;
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const promotedTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Trending data
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);

  // Fetch posts
  const fetchPosts = useCallback(async (cursor?: string) => {
    try {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const params = new URLSearchParams({ type: feedType, limit: "20" });
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`/api/posts?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch posts");
      }

      // Separate regular posts from ad campaign cards
      const allItems: FeedItem[] = data.data.posts;
      const regularPosts = allItems.filter((item): item is Post => !("isAdCard" in item));
      const adItems = allItems.filter((item): item is AdCampaignItem => "isAdCard" in item);

      if (cursor) {
        setPosts(prev => [...prev, ...regularPosts]);
      } else {
        setPosts(regularPosts);
        setFeedAds(adItems);
      }
      setNextCursor(data.data.nextCursor);
      setHasMore(data.data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [feedType]);

  // Fetch trending data
  const fetchTrending = useCallback(async () => {
    try {
      const response = await fetch("/api/feed/trending");
      const data = await response.json();

      if (data.success) {
        setTrendingTopics(data.data.trendingTopics || []);
        setSuggestedUsers(data.data.suggestedUsers || []);
      }
    } catch (err) {
      console.error("Failed to fetch trending:", err);
    }
  }, []);

  // Fetch current user + brand identity
  const fetchUserAndBrand = useCallback(async () => {
    try {
      const [userRes, brandRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/brand"),
      ]);
      const [userData, brandData] = await Promise.all([
        userRes.json(),
        brandRes.json(),
      ]);

      if (userData.success && userData.data?.user) {
        const user = userData.data.user;
        setCurrentUserId(user.id);
        setCurrentUserAvatar(user.avatarUrl);
        setCurrentUserName(user.name);
      }

      if (brandData.success && brandData.data?.brandKit) {
        const kit = brandData.data.brandKit;
        // Prefer icon logo for social avatars, fallback to full logo
        if (kit.iconLogo || kit.logo) setBrandLogo(kit.iconLogo || kit.logo);
      }
    } catch (err) {
      console.error("Failed to fetch user/brand:", err);
    }
  }, []);

  // Fetch media library files
  const fetchMediaFiles = useCallback(async () => {
    setIsLoadingMedia(true);
    try {
      const response = await fetch("/api/media?limit=50");
      const data = await response.json();
      if (data.success) {
        setMediaFiles(
          data.data.files.filter(
            (f: MediaFile) => f.type === "image" || f.type === "video" || f.type === "svg"
          )
        );
      }
    } catch (err) {
      console.error("Failed to fetch media:", err);
    } finally {
      setIsLoadingMedia(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchTrending();
    fetchUserAndBrand();
  }, [fetchPosts, fetchTrending, fetchUserAndBrand]);

  // Get avatar for a post author - use brand logo for own posts
  const getAuthorAvatar = (post: Post) => {
    if (post.author.avatarUrl) return post.author.avatarUrl;
    if (currentUserId && post.author.id === currentUserId && brandLogo) return brandLogo;
    return undefined;
  };

  // Get composer avatar - prefer brand logo, then user avatar
  const getComposerAvatar = () => {
    return brandLogo || currentUserAvatar || undefined;
  };

  // Like/Unlike post
  const handleLike = useCallback(async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
          : p
      )
    );

    try {
      const method = post.isLiked ? "DELETE" : "POST";
      const response = await fetch(`/api/posts/${postId}/like`, { method });
      const data = await response.json();

      if (!data.success) {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId ? { ...p, isLiked: post.isLiked, likesCount: post.likesCount } : p
          )
        );
        throw new Error(data.error?.message || "Failed to like post");
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to like post", variant: "destructive" });
    }
  }, [posts, toast]);

  // Bookmark post
  const handleBookmark = useCallback(async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    setPosts(prev =>
      prev.map(p => p.id === postId ? { ...p, isBookmarked: !p.isBookmarked } : p)
    );

    try {
      const method = post.isBookmarked ? "DELETE" : "POST";
      const response = await fetch(`/api/posts/${postId}/bookmark`, { method });
      const data = await response.json();

      if (!data.success) {
        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, isBookmarked: post.isBookmarked } : p)
        );
        throw new Error(data.error?.message || "Failed to bookmark post");
      }

      toast({ title: post.isBookmarked ? "Bookmark removed" : "Post bookmarked!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to bookmark post", variant: "destructive" });
    }
  }, [posts, toast]);

  // Boost post
  const handleBoostPost = async () => {
    if (!boostPostId) return;
    if (boostPlatforms.size === 0) {
      toast({ title: "Select at least one platform", variant: "destructive" });
      return;
    }
    setIsBoosting(true);
    try {
      const post = posts.find(p => p.id === boostPostId);
      const baseCredits = Math.round(parseFloat(boostConfig.budget) || 0);
      const totalCredits = baseCredits * Math.max(1, boostPlatforms.size);
      if (baseCredits < 1) {
        toast({ title: "Minimum boost is 1 credit per platform", variant: "destructive" });
        setIsBoosting(false);
        return;
      }
      const response = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Boost: ${post?.content?.substring(0, 50) || "Post"}...`,
          objective: boostConfig.objective,
          budget: totalCredits, // Total credits (per-platform × platform count)
          costPerView: 0.01,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + parseInt(boostConfig.duration) * 86400000).toISOString(),
          postId: boostPostId,
          targeting: { platforms: Array.from(boostPlatforms) },
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to boost post");

      // Update local state to reflect boosted status
      setPosts(prev => prev.map(p => p.id === boostPostId ? { ...p, isPromoted: true } : p));
      toast({ title: "Post boosted!", description: "Your campaign is now active." });
      setShowBoostDialog(false);
      setBoostPostId(null);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to boost post",
        variant: "destructive",
      });
    } finally {
      setIsBoosting(false);
    }
  };

  const openBoostDialog = (postId: string) => {
    setBoostPostId(postId);
    setBoostConfig({ budget: "50", duration: "7", objective: "ENGAGEMENT" });
    setBoostPlatforms(new Set(["feed"]));
    setShowBoostDialog(true);
  };

  const toggleBoostPlatform = (platformId: string) => {
    setBoostPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  };

  // Start watching an ad to earn (full-screen focus mode with visibility tracking)
  const handleStartAdView = async (postId: string) => {
    if (activeAdView) return; // Already watching an ad

    try {
      const response = await fetch("/api/ads/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", postId }),
      });
      const data = await response.json();

      if (!data.success) {
        toast({
          title: "Cannot view ad",
          description: data.error?.message || "Failed to start ad view",
          variant: "destructive",
        });
        return;
      }

      const { viewId, earnAmount } = data.data;
      const startedAt = Date.now();
      const post = posts.find(p => p.id === postId);

      setActiveAdView({ postId, viewId, startedAt, earnAmount });
      setAdViewProgress(0);
      setAdViewCompleted(null);
      setAdFocusPost(post || null);
      setIsFocusPaused(false);
      focusedTimeRef.current = 0;
      focusPauseTimeRef.current = 0;

      // Visibility-aware timer: only counts time when tab is focused
      let lastTickTime = Date.now();

      const interval = setInterval(() => {
        if (document.hidden) return; // Skip ticks when tab not visible

        const now = Date.now();
        const delta = (now - lastTickTime) / 1000;
        lastTickTime = now;

        // Only count time if delta is reasonable (< 1s means we're actively ticking)
        if (delta < 1.5) {
          focusedTimeRef.current += delta;
        }

        const progress = Math.min((focusedTimeRef.current / AD_VIEW_DURATION) * 100, 100);
        setAdViewProgress(progress);

        if (focusedTimeRef.current >= AD_VIEW_DURATION) {
          clearInterval(interval);
          handleCompleteAdView(viewId, postId, earnAmount);
        }
      }, 200);

      adViewTimerRef.current = interval;

      // Visibility change handler — pause/resume timer
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Tab lost focus — pause
          setIsFocusPaused(true);
          if (adViewTimerRef.current) {
            clearInterval(adViewTimerRef.current);
            adViewTimerRef.current = null;
          }
        } else {
          // Tab regained focus — resume
          setIsFocusPaused(false);
          lastTickTime = Date.now();
          const resumeInterval = setInterval(() => {
            if (document.hidden) return;
            const now = Date.now();
            const delta = (now - lastTickTime) / 1000;
            lastTickTime = now;
            if (delta < 1.5) {
              focusedTimeRef.current += delta;
            }
            const progress = Math.min((focusedTimeRef.current / AD_VIEW_DURATION) * 100, 100);
            setAdViewProgress(progress);
            if (focusedTimeRef.current >= AD_VIEW_DURATION) {
              clearInterval(resumeInterval);
              handleCompleteAdView(viewId, postId, earnAmount);
            }
          }, 200);
          adViewTimerRef.current = resumeInterval;
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      visibilityHandlerRef.current = handleVisibilityChange;
    } catch {
      toast({
        title: "Error",
        description: "Failed to start ad view",
        variant: "destructive",
      });
    }
  };

  // Complete ad view and earn money
  const handleCompleteAdView = async (viewId: string, postId: string, earnAmount: number) => {
    // Cleanup visibility handler
    if (visibilityHandlerRef.current) {
      document.removeEventListener("visibilitychange", visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }

    try {
      const response = await fetch("/api/ads/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", viewId }),
      });
      const data = await response.json();

      if (data.success) {
        // Use earnedCents as fallback to avoid floating point issues
        const earnedDollars = data.data.earned || (data.data.earnedCents ? data.data.earnedCents / 100 : 0);
        setAdEarnedAmount(earnedDollars);
        setAdViewCompleted(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, hasEarned: true } : p));
        toast({
          title: `You earned $${earnedDollars.toFixed(2)}!`,
          description: "Added to your balance",
        });

        // Check if ad has external link — start redirect countdown
        const post = posts.find(p => p.id === postId);
        if (post?.destinationUrl) {
          setAdRedirectUrl(post.destinationUrl);
          setAdRedirectCountdown(5);
          let countdown = 5;
          adRedirectTimerRef.current = setInterval(() => {
            countdown--;
            setAdRedirectCountdown(countdown);
            if (countdown <= 0) {
              if (adRedirectTimerRef.current) clearInterval(adRedirectTimerRef.current);
              adRedirectTimerRef.current = null;
              window.open(post.destinationUrl!, "_blank", "noopener,noreferrer");
              setAdRedirectUrl(null);
              setAdFocusPost(null);
            }
          }, 1000);
        } else {
          // No external link — close focus modal after short delay
          setTimeout(() => {
            setAdFocusPost(null);
          }, 2000);
        }
      } else {
        toast({
          title: "Earning failed",
          description: data.error?.message || "Could not process earning",
          variant: "destructive",
        });
        setAdFocusPost(null);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to process ad view earning",
        variant: "destructive",
      });
      setAdFocusPost(null);
    } finally {
      setActiveAdView(null);
      if (adViewTimerRef.current) {
        clearInterval(adViewTimerRef.current);
        adViewTimerRef.current = null;
      }
      // Clear the completed state after 5 seconds
      setTimeout(() => {
        setAdViewCompleted(null);
        setAdEarnedAmount(0);
      }, 5000);
    }
  };

  // Cancel ad view
  const handleCancelAdView = () => {
    if (adViewTimerRef.current) {
      clearInterval(adViewTimerRef.current);
      adViewTimerRef.current = null;
    }
    if (visibilityHandlerRef.current) {
      document.removeEventListener("visibilitychange", visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
    if (adRedirectTimerRef.current) {
      clearInterval(adRedirectTimerRef.current);
      adRedirectTimerRef.current = null;
    }
    setActiveAdView(null);
    setAdViewProgress(0);
    setAdFocusPost(null);
    setIsFocusPaused(false);
    setAdRedirectUrl(null);
    focusedTimeRef.current = 0;
  };

  // Dismiss a promoted ad (push it down the feed)
  const dismissPromotedPost = useCallback((postId: string) => {
    setDismissedAds(prev => {
      const next = new Set(prev);
      next.add(postId);
      try { sessionStorage.setItem("dismissedPromotedPosts", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Track promoted post visibility (no auto-dismiss — ads stay until user interacts)
  const handlePromotedPostVisible = useCallback((_postId: string, _isInView: boolean) => {
    // No-op: promoted posts persist in feed until user earns or manually dismisses
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (adViewTimerRef.current) clearInterval(adViewTimerRef.current);
      if (adRedirectTimerRef.current) clearInterval(adRedirectTimerRef.current);
      if (visibilityHandlerRef.current) {
        document.removeEventListener("visibilitychange", visibilityHandlerRef.current);
      }
      promotedTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Toggle inline share panel
  const toggleSharePanel = useCallback((postId: string) => {
    setExpandedSharePostId(prev => prev === postId ? null : postId);
    setCopiedLink(false);
  }, []);

  // Handle sharing to a platform
  const handlePlatformShare = useCallback(async (postId: string, platform: typeof SHARE_PLATFORMS[number]) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const postUrl = `${window.location.origin}/post/${postId}`;
    const shareText = post.content.length > 100 ? post.content.substring(0, 97) + "..." : post.content;

    const shareUrl = platform.getUrl(postUrl, shareText);
    window.open(shareUrl, "_blank", "width=600,height=400,noopener,noreferrer");

    try {
      const response = await fetch(`/api/posts/${postId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.id }),
      });
      const data = await response.json();
      if (data.success) {
        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, sharesCount: data.data.shareCount } : p)
        );
      }
    } catch {
      // Silently fail - sharing still happened
    }

    toast({ title: `Shared to ${platform.label}!` });
  }, [posts, toast]);

  // Copy link for sharing
  const handleCopyShareLink = useCallback(async (postId: string) => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopiedLink(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopiedLink(false), 2000);

      try {
        const response = await fetch(`/api/posts/${postId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: "copy_link" }),
        });
        const data = await response.json();
        if (data.success) {
          setPosts(prev =>
            prev.map(p => p.id === postId ? { ...p, sharesCount: data.data.shareCount } : p)
          );
        }
      } catch {
        // Silently fail
      }
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  }, [toast]);

  // =========================================
  // COMMENT FUNCTIONALITY
  // =========================================

  // Toggle comment section for a post
  const toggleCommentSection = useCallback(async (postId: string) => {
    if (expandedCommentPostId === postId) {
      setExpandedCommentPostId(null);
      setReplyingTo(null);
      return;
    }

    setExpandedCommentPostId(postId);
    setReplyingTo(null);

    // Fetch comments if not already loaded
    if (!commentsMap[postId]) {
      setCommentLoadingMap(prev => ({ ...prev, [postId]: true }));
      try {
        const response = await fetch(`/api/posts/${postId}/comment?limit=10`);
        const data = await response.json();
        if (data.success) {
          setCommentsMap(prev => ({ ...prev, [postId]: data.data.comments }));
        }
      } catch {
        toast({ title: "Failed to load comments", variant: "destructive" });
      } finally {
        setCommentLoadingMap(prev => ({ ...prev, [postId]: false }));
      }
    }

    // Focus input after expansion
    setTimeout(() => {
      commentInputRefs.current[postId]?.focus();
    }, 200);
  }, [expandedCommentPostId, commentsMap, toast]);

  // Post a comment
  const handlePostComment = useCallback(async (postId: string) => {
    const content = commentInputMap[postId]?.trim();
    if (!content) return;

    setPostingCommentMap(prev => ({ ...prev, [postId]: true }));

    try {
      const body: { content: string; parentId?: string } = { content };
      if (replyingTo && replyingTo.postId === postId) {
        body.parentId = replyingTo.commentId;
      }

      const response = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to post comment");
      }

      const newComment: CommentData = data.data.comment;

      if (replyingTo && replyingTo.postId === postId) {
        // Add reply to the parent comment
        setCommentsMap(prev => {
          const postComments = [...(prev[postId] || [])];
          const addReplyToComment = (comments: CommentData[]): CommentData[] => {
            return comments.map(c => {
              if (c.id === replyingTo.commentId) {
                return {
                  ...c,
                  repliesCount: c.repliesCount + 1,
                  showReplies: true,
                  replies: [...(c.replies || []), newComment],
                };
              }
              if (c.replies) {
                return { ...c, replies: addReplyToComment(c.replies) };
              }
              return c;
            });
          };
          return { ...prev, [postId]: addReplyToComment(postComments) };
        });
        setReplyingTo(null);
      } else {
        // Add to top-level comments
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [newComment, ...(prev[postId] || [])],
        }));
      }

      // Update post comment count
      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)
      );

      // Clear input
      setCommentInputMap(prev => ({ ...prev, [postId]: "" }));
      setShowMentionDropdown(false);

      toast({ title: replyingTo ? "Reply posted!" : "Comment posted!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to post comment", variant: "destructive" });
    } finally {
      setPostingCommentMap(prev => ({ ...prev, [postId]: false }));
    }
  }, [commentInputMap, replyingTo, toast]);

  // Delete a comment
  const handleDeleteComment = useCallback(async (postId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/comment?commentId=${commentId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete comment");
      }

      // Remove from state
      const removeComment = (comments: CommentData[]): CommentData[] => {
        return comments
          .filter(c => c.id !== commentId)
          .map(c => c.replies ? { ...c, replies: removeComment(c.replies) } : c);
      };

      setCommentsMap(prev => ({
        ...prev,
        [postId]: removeComment(prev[postId] || []),
      }));

      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p)
      );

      toast({ title: "Comment deleted" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to delete comment", variant: "destructive" });
    }
  }, [toast]);

  // Like/Unlike a comment
  const handleCommentLike = useCallback(async (postId: string, commentId: string, isLiked: boolean) => {
    // Optimistic update
    const updateLike = (comments: CommentData[]): CommentData[] => {
      return comments.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            isLiked: !isLiked,
            likesCount: isLiked ? c.likesCount - 1 : c.likesCount + 1,
          };
        }
        if (c.replies) {
          return { ...c, replies: updateLike(c.replies) };
        }
        return c;
      });
    };

    setCommentsMap(prev => ({
      ...prev,
      [postId]: updateLike(prev[postId] || []),
    }));

    try {
      if (isLiked) {
        const response = await fetch(`/api/posts/${postId}/comment/like?commentId=${commentId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message);
      } else {
        const response = await fetch(`/api/posts/${postId}/comment/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message);
      }
    } catch {
      // Revert on failure
      setCommentsMap(prev => ({
        ...prev,
        [postId]: updateLike(prev[postId] || []),
      }));
    }
  }, []);

  // Load replies for a comment
  const handleLoadReplies = useCallback(async (postId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/comment?parentId=${commentId}&limit=10`);
      const data = await response.json();

      if (data.success) {
        setCommentsMap(prev => {
          const postComments = [...(prev[postId] || [])];
          const addReplies = (comments: CommentData[]): CommentData[] => {
            return comments.map(c => {
              if (c.id === commentId) {
                return { ...c, replies: data.data.comments, showReplies: true };
              }
              if (c.replies) {
                return { ...c, replies: addReplies(c.replies) };
              }
              return c;
            });
          };
          return { ...prev, [postId]: addReplies(postComments) };
        });
      }
    } catch {
      toast({ title: "Failed to load replies", variant: "destructive" });
    }
  }, [toast]);

  // @mention search
  const handleCommentInputChange = useCallback((postId: string, value: string) => {
    setCommentInputMap(prev => ({ ...prev, [postId]: value }));

    // Check for @mention trigger
    const cursorPos = commentInputRefs.current[postId]?.selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionPostId(postId);

      if (query.length >= 1) {
        // Search users
        fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setMentionResults(data.data.users);
              setShowMentionDropdown(data.data.users.length > 0);
            }
          })
          .catch(() => setShowMentionDropdown(false));
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  }, []);

  // Insert @mention
  const handleInsertMention = useCallback((postId: string, user: MentionUser) => {
    const currentValue = commentInputMap[postId] || "";
    const cursorPos = commentInputRefs.current[postId]?.selectionStart || currentValue.length;
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const textAfterCursor = currentValue.substring(cursorPos);

    // Replace @query with @username
    const newBefore = textBeforeCursor.replace(/@\w*$/, `@${user.username} `);
    const newValue = newBefore + textAfterCursor;

    setCommentInputMap(prev => ({ ...prev, [postId]: newValue }));
    setShowMentionDropdown(false);
    setMentionResults([]);

    // Focus back on input
    setTimeout(() => {
      const input = commentInputRefs.current[postId];
      if (input) {
        input.focus();
        input.setSelectionRange(newBefore.length, newBefore.length);
      }
    }, 0);
  }, [commentInputMap]);

  // Create post
  const handlePost = async () => {
    if (!newPostContent.trim() && selectedMedia.length === 0) return;

    setIsPosting(true);
    try {
      const mediaUrls = selectedMedia.map(m => m.url);
      const hasVideo = selectedMedia.some(m => m.type === "video");

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newPostContent,
          mediaUrls,
          mediaType: hasVideo ? "video" : mediaUrls.length > 0 ? "image" : undefined,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to create post");
      }

      const newPost = data.data.post;
      newPost.isPromoted = newPost.isPromoted ?? false;
      newPost.hasEarned = false;
      if (!newPost.author.avatarUrl && brandLogo) {
        newPost.author.avatarUrl = brandLogo;
      } else if (!newPost.author.avatarUrl && currentUserAvatar) {
        newPost.author.avatarUrl = currentUserAvatar;
      }

      setPosts(prev => [newPost, ...prev]);
      setNewPostContent("");
      setSelectedMedia([]);
      setIsComposerExpanded(false);
      setShowAIAssistant(false);
      toast({ title: "Post published successfully!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create post", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to delete post");
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: "Post deleted" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to delete post", variant: "destructive" });
    } finally {
      setDeletingPostId(null);
    }
  };

  // Save edited post
  const handleSaveEdit = async (postId: string) => {
    if (!editingContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingContent }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to update post");
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editingContent } : p));
      setEditingPostId(null);
      setEditingContent("");
      toast({ title: "Post updated" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to update post", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Generate AI post idea
  const handleGenerateIdea = async () => {
    setIsGeneratingIdea(true);
    if (!isComposerExpanded) expandComposer();
    try {
      const brandRes = await fetch("/api/brand");
      const brandData = await brandRes.json();
      const brand = brandData.success ? brandData.data?.brandKit : null;

      const response = await fetch("/api/ai/generate/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: ["facebook"],
          topic: brand?.niche
            ? `Engaging post about ${brand.niche} for ${brand.name || "my brand"}`
            : "An engaging, creative social media post that sparks conversation",
          tone: "casual",
          length: "medium",
          includeHashtags: true,
          includeEmojis: true,
          includeCTA: false,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to generate idea");

      const generatedText = data.data?.posts?.[0]?.content || data.data?.content || "";
      if (generatedText) {
        setNewPostContent(generatedText);
        // Save to content library for history
        fetch("/api/content-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "post_ideas", content: generatedText, prompt: "Feed post idea" }),
        }).catch(() => {});
      }
      toast({ title: "AI idea generated!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to generate idea", variant: "destructive" });
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  // Follow user
  const handleFollow = useCallback(async (userId: string) => {
    const user = suggestedUsers.find(u => u.id === userId);
    if (!user) return;

    setSuggestedUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, isFollowing: !u.isFollowing } : u)
    );

    try {
      const method = user.isFollowing ? "DELETE" : "POST";
      const response = await fetch(`/api/users/${userId}/follow`, { method });
      const data = await response.json();

      if (!data.success) {
        setSuggestedUsers(prev =>
          prev.map(u => u.id === userId ? { ...u, isFollowing: user.isFollowing } : u)
        );
        throw new Error(data.error?.message || "Failed to follow user");
      }

      toast({ title: user.isFollowing ? "Unfollowed" : "Following!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to follow user", variant: "destructive" });
    }
  }, [suggestedUsers, toast]);

  // Open media picker
  const handleOpenMediaPicker = () => {
    if (mediaFiles.length === 0) fetchMediaFiles();
    setShowMediaPicker(true);
  };

  // Toggle media selection
  const toggleMediaSelection = (file: MediaFile) => {
    setSelectedMedia(prev => {
      const exists = prev.find(m => m.id === file.id);
      if (exists) return prev.filter(m => m.id !== file.id);
      return [...prev, file];
    });
  };

  // Direct file upload in media picker
  const handleDirectUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/media", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success && data.data) {
          const uploaded: MediaFile = {
            id: data.data.id,
            url: data.data.url,
            originalName: data.data.originalName || file.name,
            type: file.type.startsWith("video/") ? "video" : "image",
            mimeType: file.type,
            width: data.data.width || null,
            height: data.data.height || null,
          };
          setMediaFiles(prev => [uploaded, ...prev]);
          setSelectedMedia(prev => [...prev, uploaded]);
        } else {
          toast({ title: data.error?.message || "Upload failed", variant: "destructive" });
        }
      }
      toast({ title: "Upload complete!" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Expand composer
  const expandComposer = () => {
    setIsComposerExpanded(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Render hashtags and mentions in content
  const renderContent = (content: string) => {
    const parts = content.split(/(#\w+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("#")) {
        return (
          <span key={i} className="text-brand-500 hover:text-brand-600 cursor-pointer font-medium">
            {part}
          </span>
        );
      }
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-blue-500 hover:text-blue-600 cursor-pointer font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Render a single comment
  const renderComment = (comment: CommentData, postId: string, depth: number = 0) => {
    const isOwn = currentUserId === comment.author.id;
    const maxDepth = 2;

    return (
      <motion.div
        key={comment.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={depth > 0 ? "ml-8 mt-2" : "mt-3"}
      >
        <div className="flex gap-2.5">
          <Avatar className="w-7 h-7 flex-shrink-0">
            <AvatarImage src={comment.author.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px] bg-muted font-medium">
              {comment.author.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Comment bubble */}
            <div className="bg-muted/60 rounded-2xl px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold">{comment.author.name}</span>
                <span className="text-[11px] text-muted-foreground">@{comment.author.username}</span>
              </div>
              <p className="text-[13px] leading-relaxed mt-0.5 whitespace-pre-wrap">
                {renderContent(comment.content)}
              </p>
            </div>

            {/* Comment actions */}
            <div className="flex items-center gap-3 mt-1 ml-2">
              <span className="text-[11px] text-muted-foreground">{formatTimeAgo(comment.createdAt)}</span>
              <button
                onClick={() => handleCommentLike(postId, comment.id, !!comment.isLiked)}
                className={`text-[11px] font-medium hover:text-red-500 transition-colors ${
                  comment.isLiked ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {comment.likesCount > 0 ? `${formatCount(comment.likesCount)} ` : ""}Like
              </button>
              {depth < maxDepth && (
                <button
                  onClick={() => {
                    setReplyingTo({ postId, commentId: comment.id, username: comment.author.username });
                    setTimeout(() => commentInputRefs.current[postId]?.focus(), 100);
                  }}
                  className="text-[11px] font-medium text-muted-foreground hover:text-blue-500 transition-colors"
                >
                  Reply
                </button>
              )}
              {isOwn && (
                <button
                  onClick={() => handleDeleteComment(postId, comment.id)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

            {/* Replies */}
            {comment.repliesCount > 0 && !comment.showReplies && (
              <button
                onClick={() => handleLoadReplies(postId, comment.id)}
                className="flex items-center gap-1 mt-2 ml-2 text-[12px] font-medium text-brand-500 hover:text-brand-600 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                View {comment.repliesCount} {comment.repliesCount === 1 ? "reply" : "replies"}
              </button>
            )}

            {comment.showReplies && comment.replies && comment.replies.length > 0 && (
              <div>
                {comment.replies.map(reply => renderComment(reply, postId, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (error && posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchPosts()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Merge posts for feed display — promoted posts stay in their original position
  const feedItems: FeedItem[] = useMemo(() => {
    return [...posts];
  }, [posts]);

  // IntersectionObserver for auto-dismissing promoted posts after 10s in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const postId = (entry.target as HTMLElement).dataset.promotedPostId;
          if (postId) {
            handlePromotedPostVisible(postId, entry.isIntersecting);
          }
        });
      },
      { threshold: 0.5 }
    );

    const elements = document.querySelectorAll("[data-promoted-post-id]");
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [feedItems, handlePromotedPostVisible]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto"
    >
      {/* Feed Type Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "feed", label: "For You" },
          { value: "following", label: "Following" },
          { value: "trending", label: "Trending" },
        ].map(tab => (
          <Button
            key={tab.value}
            variant={feedType === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFeedType(tab.value as typeof feedType);
              setPosts([]);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Main Feed */}
        <div className="space-y-4">
          {/* Inline Post Composer */}
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar className="w-10 h-10 ring-2 ring-brand-500/20">
                  <AvatarImage src={getComposerAvatar()} />
                  <AvatarFallback className="bg-brand-500/10 text-brand-600 font-semibold">
                    {currentUserName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>

                {!isComposerExpanded ? (
                  <div className="flex-1 cursor-text" onClick={expandComposer}>
                    <div className="bg-muted/50 rounded-full px-4 py-2.5 text-muted-foreground hover:bg-muted transition-colors">
                      What&apos;s on your mind?
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    {/* AI Idea bar */}
                    <div className="flex items-center gap-1 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-brand-500/30 text-brand-600 hover:bg-brand-500/10"
                        onClick={handleGenerateIdea}
                        disabled={isGeneratingIdea}
                      >
                        {isGeneratingIdea ? <AISpinner className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}
                        AI Idea
                      </Button>
                      <AIIdeasHistory
                        contentType="post_ideas"
                        onSelect={(idea) => setNewPostContent(idea)}
                        mode="single"
                        className="h-7"
                      />
                    </div>
                    {isGeneratingIdea ? (
                      <div className="w-full min-h-[100px] flex items-center justify-center">
                        <AIGenerationLoader
                          currentStep="Generating post idea..."
                          subtitle="Crafting something creative for you"
                          compact
                        />
                      </div>
                    ) : (
                      <textarea
                        ref={textareaRef}
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="What's on your mind?"
                        className="w-full min-h-[100px] bg-transparent text-sm resize-none focus:outline-none"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Selected Media Preview */}
              {selectedMedia.length > 0 && (
                <div className="mt-3 pl-[52px]">
                  <div className="flex gap-2 flex-wrap">
                    {selectedMedia.map((file) => (
                      <div key={file.id} className="relative group">
                        {file.type === "video" ? (
                          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border">
                            <Video className="w-6 h-6 text-muted-foreground" />
                          </div>
                        ) : (
                          <img
                            src={file.url}
                            alt={file.originalName}
                            className="w-20 h-20 rounded-lg object-cover border"
                          />
                        )}
                        <button
                          onClick={() => setSelectedMedia(prev => prev.filter(m => m.id !== file.id))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Text Assistant — hidden for now */}
              {false && showAIAssistant && isComposerExpanded && (
                <div className="mt-4 pl-[52px]">
                  <AITextAssistant
                    onInsert={(content) => {
                      setNewPostContent(prev => prev ? prev + "\n\n" + content : content);
                    }}
                    onClose={() => setShowAIAssistant(false)}
                  />
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between mt-3 pl-[52px]">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      if (!isComposerExpanded) expandComposer();
                      handleOpenMediaPicker();
                    }}
                  >
                    <ImagePlus className="w-4 h-4 mr-2" />
                    Media
                    {selectedMedia.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                        {selectedMedia.length}
                      </Badge>
                    )}
                  </Button>
                  {/* AI Generate button — hidden for now, replaced by AI Idea above */}
                </div>

                {isComposerExpanded && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsComposerExpanded(false);
                        setNewPostContent("");
                        setSelectedMedia([]);
                        setShowAIAssistant(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePost}
                      disabled={(!newPostContent.trim() && selectedMedia.length === 0) || isPosting}
                      size="sm"
                    >
                      {isPosting ? (
                        <>
                          <AISpinner className="w-4 h-4 mr-2" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Post
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/content/posts">
                        <Zap className="w-4 h-4 mr-2" />
                        Automation
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Posts */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="flex gap-3">
                      <Skeleton className="w-11 h-11 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full mt-3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No posts yet</p>
                <p className="text-sm mt-1">Be the first to share something!</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence mode="popLayout">
              {feedItems.map((item, index) => {
                if ("isAdCard" in item && item.isAdCard) {
                  return (
                    <motion.div
                      key={`ad-${item.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <AdCard
                        campaign={item}
                        currentUserId={currentUserId}
                      />
                    </motion.div>
                  );
                }
                const post = item as Post;
                return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  {...(post.isPromoted && !post.hasEarned && !dismissedAds.has(post.id)
                    ? { "data-promoted-post-id": post.id }
                    : {})}
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow relative">
                      {/* Ad View Progress Bar - shown on top of promoted posts while watching */}
                      {post.isPromoted && activeAdView?.postId === post.id && (
                        <div className="relative h-1.5 bg-muted overflow-hidden">
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-emerald-500"
                            style={{ width: `${adViewProgress}%` }}
                          />
                        </div>
                      )}

                      {/* Earned completion banner */}
                      <AnimatePresence>
                        {adViewCompleted === post.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-500/20 px-4 py-2 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-600">
                              You earned ${adEarnedAmount.toFixed(2)}!
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    <CardContent className="p-5">
                      {/* Author Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <a href={`/profile/${post.author.username}`} className="shrink-0">
                            <Avatar className="w-11 h-11 hover:ring-2 hover:ring-brand-500/40 transition-all cursor-pointer">
                              <AvatarImage src={getAuthorAvatar(post) || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-brand-500 to-purple-500 text-white font-semibold">
                                {post.author.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </a>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <a href={`/profile/${post.author.username}`} className="font-semibold text-[15px] hover:underline">{post.author.name}</a>
                              {post.author.isVerified && (
                                <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                              <span>@{post.author.username}</span>
                              <span className="text-[10px]">&bull;</span>
                              <span>{formatTimeAgo(post.createdAt)}</span>
                              {post.isPromoted && (
                                <>
                                  <span className="text-[10px]">&bull;</span>
                                  <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                                    <Megaphone className="w-3 h-3" />
                                    Sponsored
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {post.author.id === currentUserId && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingPostId(post.id);
                                    setEditingContent(post.content);
                                  }}
                                >
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit post
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeletePost(post.id)}
                                  disabled={deletingPostId === post.id}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {deletingPostId === post.id ? "Deleting..." : "Delete post"}
                                </DropdownMenuItem>
                              </>
                            )}
                            {post.author.id !== currentUserId && (
                              <DropdownMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/feed?post=${post.id}`);
                                  toast({ title: "Link copied" });
                                }}
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                Copy link
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Content - with truncation or inline edit */}
                      {editingPostId === post.id ? (
                        <div className="mb-3 space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full min-h-[80px] text-[15px] leading-relaxed bg-muted/50 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 border"
                            autoFocus
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingPostId(null); setEditingContent(""); }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(post.id)}
                              disabled={isSavingEdit || !editingContent.trim()}
                            >
                              {isSavingEdit ? <><AISpinner className="w-4 h-4 mr-2" /> Saving...</> : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap mb-3">
                          {post.content.length > POST_TRUNCATE_LENGTH && !expandedPostContent.has(post.id) ? (
                            <>
                              {renderContent(post.content.substring(0, POST_TRUNCATE_LENGTH).trimEnd())}
                              <span className="text-muted-foreground">... </span>
                              <button
                                onClick={() => setExpandedPostContent(prev => new Set(prev).add(post.id))}
                                className="text-brand-500 hover:text-brand-600 font-medium text-[14px]"
                              >
                                more
                              </button>
                            </>
                          ) : (
                            <>
                              {renderContent(post.content)}
                              {post.content.length > POST_TRUNCATE_LENGTH && (
                                <button
                                  onClick={() => setExpandedPostContent(prev => {
                                    const next = new Set(prev);
                                    next.delete(post.id);
                                    return next;
                                  })}
                                  className="text-muted-foreground hover:text-foreground font-medium text-[14px] ml-1"
                                >
                                  less
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Media */}
                      {post.mediaUrls.length > 0 && (
                        <PostMediaGallery
                          mediaUrls={post.mediaUrls}
                          onMediaClick={(index) => setLightboxMedia({ urls: post.mediaUrls, index })}
                        />
                      )}

                      {/* Engagement stats bar */}
                      {(post.likesCount > 0 || post.commentsCount > 0 || post.sharesCount > 0) && (
                        <div className="flex items-center gap-4 py-2 text-xs text-muted-foreground">
                          {post.likesCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 fill-red-400 text-red-400" />
                              {formatCount(post.likesCount)}
                            </span>
                          )}
                          {post.commentsCount > 0 && (
                            <span>{formatCount(post.commentsCount)} comment{post.commentsCount !== 1 ? "s" : ""}</span>
                          )}
                          {post.sharesCount > 0 && (
                            <span>{formatCount(post.sharesCount)} share{post.sharesCount !== 1 ? "s" : ""}</span>
                          )}
                          {post.viewCount && post.viewCount > 0 && (
                            <span className="ml-auto flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {formatCount(post.viewCount)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Watch & Earn CTA for promoted posts (visible to non-owners) */}
                      {post.isPromoted && post.author.id !== currentUserId && (
                        <div className="mb-2">
                          {activeAdView?.postId === post.id ? (
                            // Watching in progress - countdown timer
                            <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-green-500/5 to-emerald-500/5 border border-green-500/20 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Timer className="w-4 h-4 text-green-500 animate-pulse" />
                                <span className="text-sm font-medium text-green-600">
                                  Watching... {Math.max(0, Math.ceil(AD_VIEW_DURATION - (adViewProgress / 100) * AD_VIEW_DURATION))}s
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                onClick={handleCancelAdView}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          ) : post.hasEarned ? (
                            // Already earned
                            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-muted-foreground">Earned from this ad</span>
                            </div>
                          ) : (
                            // Watch & Earn button
                            <button
                              onClick={() => handleStartAdView(post.id)}
                              disabled={activeAdView !== null}
                              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 border border-green-500/20 px-3 py-2 transition-colors disabled:opacity-50"
                            >
                              <DollarSign className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-medium text-green-600">
                                Watch & Earn
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">
                                (35s)
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-0.5 -ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1.5 rounded-lg px-3 ${post.isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"}`}
                            onClick={() => handleLike(post.id)}
                          >
                            <Heart className={`w-[18px] h-[18px] ${post.isLiked ? "fill-current" : ""}`} />
                            <span className="text-xs font-medium">Like</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1.5 rounded-lg px-3 ${expandedCommentPostId === post.id ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground hover:text-blue-500"}`}
                            onClick={() => toggleCommentSection(post.id)}
                          >
                            <MessageCircle className={`w-[18px] h-[18px] ${expandedCommentPostId === post.id ? "fill-blue-500/20" : ""}`} />
                            <span className="text-xs font-medium">Comment</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1.5 rounded-lg px-3 ${expandedSharePostId === post.id ? "text-brand-500 bg-brand-500/10" : "text-muted-foreground hover:text-green-500"}`}
                            onClick={() => toggleSharePanel(post.id)}
                          >
                            <Share2 className="w-[18px] h-[18px]" />
                            <span className="text-xs font-medium">Share</span>
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          {post.author.id === currentUserId && (
                            post.isPromoted ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 rounded-lg px-3 text-amber-500 cursor-default"
                                disabled
                              >
                                <Rocket className="w-[18px] h-[18px] fill-current" />
                                <span className="text-xs font-medium">Boosted</span>
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 rounded-lg px-3 text-muted-foreground hover:text-amber-500"
                                onClick={() => openBoostDialog(post.id)}
                              >
                                <Rocket className="w-[18px] h-[18px]" />
                                <span className="text-xs font-medium">Boost</span>
                              </Button>
                            )
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`rounded-lg ${post.isBookmarked ? "text-brand-500 hover:text-brand-600" : "text-muted-foreground"}`}
                            onClick={() => handleBookmark(post.id)}
                          >
                            <Bookmark className={`w-[18px] h-[18px] ${post.isBookmarked ? "fill-current" : ""}`} />
                          </Button>
                        </div>
                      </div>

                      {/* Inline Share Panel */}
                      <AnimatePresence>
                        {expandedSharePostId === post.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 pb-1">
                              <p className="text-xs text-muted-foreground mb-2.5 font-medium">Share to</p>
                              <div className="flex flex-wrap gap-2">
                                {SHARE_PLATFORMS.map((platform) => {
                                  const Icon = platform.icon;
                                  return (
                                    <button
                                      key={platform.id}
                                      onClick={() => handlePlatformShare(post.id, platform)}
                                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/70 transition-colors min-w-[56px]"
                                      title={platform.label}
                                    >
                                      <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: platform.color + "18" }}
                                      >
                                        <Icon className="w-4 h-4" style={{ color: platform.color }} />
                                      </div>
                                      <span className="text-[10px] text-muted-foreground font-medium">{platform.label}</span>
                                    </button>
                                  );
                                })}
                                <button
                                  onClick={() => handleCopyShareLink(post.id)}
                                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/70 transition-colors min-w-[56px]"
                                  title="Copy Link"
                                >
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-muted">
                                    {copiedLink ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Link2 className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    {copiedLink ? "Copied!" : "Copy"}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Inline Comment Section */}
                      <AnimatePresence>
                        {expandedCommentPostId === post.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 border-t mt-1">
                              {/* Comment Input */}
                              <div className="flex gap-2.5 items-start">
                                <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                                  <AvatarImage src={getComposerAvatar()} />
                                  <AvatarFallback className="text-[10px] bg-brand-500/10 text-brand-600 font-medium">
                                    {currentUserName?.charAt(0) || "U"}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 relative">
                                  {/* Reply indicator */}
                                  {replyingTo && replyingTo.postId === post.id && (
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-blue-500">
                                      <Reply className="w-3 h-3" />
                                      <span>Replying to @{replyingTo.username}</span>
                                      <button
                                        onClick={() => setReplyingTo(null)}
                                        className="text-muted-foreground hover:text-foreground ml-1"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 bg-muted/50 rounded-full pl-3 pr-1 py-1 focus-within:ring-2 focus-within:ring-brand-500/30 transition-all">
                                    <input
                                      ref={(el) => { commentInputRefs.current[post.id] = el; }}
                                      type="text"
                                      value={commentInputMap[post.id] || ""}
                                      onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          handlePostComment(post.id);
                                        }
                                        if (e.key === "Escape") {
                                          setShowMentionDropdown(false);
                                          setReplyingTo(null);
                                        }
                                      }}
                                      placeholder={replyingTo && replyingTo.postId === post.id ? `Reply to @${replyingTo.username}...` : "Write a comment..."}
                                      className="flex-1 bg-transparent text-[13px] focus:outline-none placeholder:text-muted-foreground/60"
                                    />
                                    <button
                                      onClick={() => {
                                        const currentVal = commentInputMap[post.id] || "";
                                        setCommentInputMap(prev => ({ ...prev, [post.id]: currentVal + "@" }));
                                        commentInputRefs.current[post.id]?.focus();
                                      }}
                                      className="p-1.5 rounded-full text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                                      title="Mention someone"
                                    >
                                      <AtSign className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handlePostComment(post.id)}
                                      disabled={!(commentInputMap[post.id]?.trim()) || postingCommentMap[post.id]}
                                      className="p-1.5 rounded-full bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-600 transition-colors"
                                    >
                                      {postingCommentMap[post.id] ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Send className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>

                                  {/* @mention dropdown */}
                                  {showMentionDropdown && mentionPostId === post.id && mentionResults.length > 0 && (
                                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-xl shadow-lg overflow-hidden z-50">
                                      {mentionResults.map((user) => (
                                        <button
                                          key={user.id}
                                          onClick={() => handleInsertMention(post.id, user)}
                                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/70 transition-colors text-left"
                                        >
                                          <Avatar className="w-6 h-6">
                                            <AvatarImage src={user.avatarUrl || undefined} />
                                            <AvatarFallback className="text-[9px]">{user.name.charAt(0)}</AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-medium truncate">{user.name}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Comments list */}
                              {commentLoadingMap[post.id] ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : (
                                <div className="mt-1">
                                  {(commentsMap[post.id] || []).length === 0 ? (
                                    <p className="text-[12px] text-muted-foreground text-center py-4">
                                      No comments yet. Be the first to comment!
                                    </p>
                                  ) : (
                                    (commentsMap[post.id] || []).map(comment =>
                                      renderComment(comment, post.id)
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Load More */}
          {hasMore && !isLoading && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => fetchPosts(nextCursor || undefined)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <AISpinner className="w-4 h-4 mr-2" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 hidden lg:block">
          {/* Sponsored Ads — ad campaigns + promoted posts */}
          {(() => {
            const promotedPosts = posts.filter(p => p.isPromoted && p.author.id !== currentUserId);
            const hasAds = feedAds.length > 0 || promotedPosts.length > 0;
            if (!hasAds) return null;
            return (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold">Sponsored</h3>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Ad campaign cards */}
                  {feedAds.map((ad) => {
                    const CardWrapper = ad.destinationUrl ? "a" : "div";
                    const linkProps = ad.destinationUrl ? { href: ad.destinationUrl, target: "_blank", rel: "noopener noreferrer" } : {};
                    return (
                      <CardWrapper key={ad.id} {...linkProps} className="block border rounded-lg p-3 hover:bg-muted/30 hover:border-brand-500/30 transition-colors cursor-pointer">
                        {ad.mediaUrl && (
                          <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                            <img src={ad.mediaUrl} alt={ad.headline || ad.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <p className="text-sm font-medium line-clamp-1">{ad.headline || ad.name}</p>
                        {ad.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description}</p>}
                        {ad.destinationUrl && (
                          <span className="text-xs text-brand-500 mt-1 inline-flex items-center gap-1">
                            {ad.ctaText || "Learn more"} <ExternalLink className="w-3 h-3" />
                          </span>
                        )}
                      </CardWrapper>
                    );
                  })}
                  {/* Promoted posts */}
                  {promotedPosts.slice(0, 3).map((post) => {
                    const hasLink = !!post.destinationUrl;
                    const CardWrapper = hasLink ? "a" : "div";
                    const linkProps = hasLink ? { href: post.destinationUrl!, target: "_blank", rel: "noopener noreferrer" } : {};
                    return (
                      <CardWrapper key={post.id} {...linkProps} className="block border rounded-lg p-3 hover:bg-muted/30 hover:border-brand-500/30 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={post.author.avatarUrl || undefined} />
                            <AvatarFallback className="text-[10px]">{post.author.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate">{post.author.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 ml-auto">Boosted</Badge>
                        </div>
                        {post.mediaUrls.length > 0 && (
                          <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                            <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <p className="text-xs line-clamp-2">{post.content}</p>
                        {hasLink && (
                          <span className="text-xs text-brand-500 mt-1 inline-flex items-center gap-1">
                            Visit <ExternalLink className="w-3 h-3" />
                          </span>
                        )}
                        {/* Credit availability indicator */}
                        {!post.hasEarned && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed">
                            <DollarSign className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[11px] font-medium text-green-600">Earn credits available</span>
                          </div>
                        )}
                        {post.hasEarned && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed">
                            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">Earned</span>
                          </div>
                        )}
                      </CardWrapper>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}

          {/* Trending Topics */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-500" />
                <h3 className="font-semibold">Trending Topics</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {trendingTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trending topics yet</p>
              ) : (
                <div className="space-y-3">
                  {trendingTopics.map((topic, index) => (
                    <div
                      key={topic.tag}
                      className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{topic.tag}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCount(topic.postCount)} posts
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggested Users */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-500" />
                <h3 className="font-semibold">Suggested Creators</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {suggestedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suggestions yet</p>
              ) : (
                <div className="space-y-3">
                  {suggestedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCount(user.followersCount)} followers
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={user.isFollowing ? "secondary" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => handleFollow(user.id)}
                      >
                        {user.isFollowing ? "Following" : "Follow"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full-Screen Ad Focus Modal */}
      <AnimatePresence>
        {adFocusPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center"
          >
            {/* Close / Cancel button */}
            {!adViewCompleted && (
              <button
                onClick={handleCancelAdView}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="w-full max-w-lg mx-4 flex flex-col items-center">
              {/* Sponsored label */}
              <div className="flex items-center gap-2 mb-4">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Sponsored Ad</span>
              </div>

              {/* Ad Content Card */}
              <div className="w-full bg-card rounded-2xl overflow-hidden border shadow-2xl">
                {/* Media */}
                {adFocusPost.mediaUrls.length > 0 && (
                  <div className="max-h-[40vh] overflow-hidden">
                    {(() => {
                      const url = adFocusPost.mediaUrls[0];
                      const isVideo = url.match(/\.(mp4|webm|mov)(\?|#|$)/i) || url.includes("video");
                      return isVideo ? (
                        <video src={url} controls autoPlay muted className="w-full max-h-[40vh] object-contain bg-black" />
                      ) : (
                        <img src={url} alt="Ad" className="w-full max-h-[40vh] object-contain" />
                      );
                    })()}
                  </div>
                )}

                {/* Author & Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={adFocusPost.author.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-brand-500 to-purple-500 text-white font-semibold">
                        {adFocusPost.author.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-semibold text-sm">{adFocusPost.author.name}</span>
                      <p className="text-xs text-muted-foreground">@{adFocusPost.author.username}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {adFocusPost.content.length > 300 ? adFocusPost.content.substring(0, 300) + "..." : adFocusPost.content}
                  </p>
                </div>
              </div>

              {/* Progress & Status */}
              <div className="w-full mt-6">
                {adViewCompleted === adFocusPost.id ? (
                  // Completed state
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold">You earned ${adEarnedAmount.toFixed(2)}!</span>
                    </div>

                    {/* External link redirect */}
                    {adRedirectUrl && (
                      <div className="space-y-3">
                        <p className="text-sm text-white/70">
                          Redirecting in {adRedirectCountdown}s...
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white hover:bg-white/10"
                            onClick={() => {
                              window.open(adRedirectUrl, "_blank", "noopener,noreferrer");
                              if (adRedirectTimerRef.current) clearInterval(adRedirectTimerRef.current);
                              setAdRedirectUrl(null);
                              setAdFocusPost(null);
                            }}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Visit Now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/50 hover:text-white hover:bg-white/10"
                            onClick={() => {
                              if (adRedirectTimerRef.current) clearInterval(adRedirectTimerRef.current);
                              setAdRedirectUrl(null);
                              setAdFocusPost(null);
                            }}
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Close if no redirect */}
                    {!adRedirectUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/50 hover:text-white hover:bg-white/10"
                        onClick={() => setAdFocusPost(null)}
                      >
                        Close
                      </Button>
                    )}
                  </motion.div>
                ) : (
                  // Watching state
                  <div className="space-y-4">
                    {/* Circular progress */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                          <circle
                            cx="40" cy="40" r="36" fill="none" stroke="url(#adProgressGradient)" strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 36}`}
                            strokeDashoffset={`${2 * Math.PI * 36 * (1 - adViewProgress / 100)}`}
                            className="transition-all duration-200"
                          />
                          <defs>
                            <linearGradient id="adProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#4ade80" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isFocusPaused ? (
                            <Pause className="w-6 h-6 text-amber-400" />
                          ) : (
                            <span className="text-lg font-bold text-white">
                              {Math.max(0, Math.ceil(AD_VIEW_DURATION - focusedTimeRef.current))}
                            </span>
                          )}
                        </div>
                      </div>

                      {isFocusPaused ? (
                        <div className="text-center space-y-1">
                          <p className="text-amber-400 font-medium text-sm">Paused</p>
                          <p className="text-white/50 text-xs">Return to this tab to continue earning</p>
                        </div>
                      ) : (
                        <div className="text-center space-y-1">
                          <p className="text-white/70 text-sm flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-green-400" />
                            Focus tracking active
                          </p>
                          <p className="text-white/40 text-xs">
                            Keep this tab in focus to earn ${activeAdView?.earnAmount?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                        style={{ width: `${adViewProgress}%` }}
                      />
                    </div>

                    <div className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/40 hover:text-white hover:bg-white/10 text-xs"
                        onClick={handleCancelAdView}
                      >
                        Cancel viewing
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Lightbox */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxMedia(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxMedia(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Counter */}
            {lightboxMedia.urls.length > 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full font-medium">
                {lightboxMedia.index + 1} / {lightboxMedia.urls.length}
              </div>
            )}

            {/* Navigation arrows */}
            {lightboxMedia.urls.length > 1 && lightboxMedia.index > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxMedia(prev => prev ? { ...prev, index: prev.index - 1 } : null);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {lightboxMedia.urls.length > 1 && lightboxMedia.index < lightboxMedia.urls.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxMedia(prev => prev ? { ...prev, index: prev.index + 1 } : null);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Media content */}
            <div
              className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const url = lightboxMedia.urls[lightboxMedia.index];
                const isVideo = url.match(/\.(mp4|webm|mov)(\?|#|$)/i) || url.includes("video");
                return isVideo ? (
                  <video
                    src={url}
                    controls
                    autoPlay
                    className="max-w-[90vw] max-h-[90vh] rounded-lg"
                  />
                ) : (
                  <img
                    src={url}
                    alt="Media"
                    className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                  />
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Picker Dialog */}
      <Dialog open={showMediaPicker} onOpenChange={setShowMediaPicker}>
        <DialogContent className="max-w-2xl w-[90vw] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-brand-500" />
              Add Media
              {selectedMedia.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedMedia.length} selected
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={() => setMediaPickerTab("upload")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mediaPickerTab === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button
              onClick={() => {
                setMediaPickerTab("library");
                if (mediaFiles.length === 0) fetchMediaFiles();
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mediaPickerTab === "library"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Library
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
            {mediaPickerTab === "upload" ? (
              <div className="space-y-4">
                {/* Upload area */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm"
                  multiple
                  className="hidden"
                  onChange={(e) => handleDirectUpload(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-brand-500/50 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 transition-colors"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <AISpinner className="w-8 h-8" />
                      <p className="text-sm font-medium">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-brand-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Click to upload files</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPEG, WebP, SVG, MP4, WebM
                        </p>
                      </div>
                    </div>
                  )}
                </button>

                {/* Show selected files preview */}
                {selectedMedia.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Selected files</p>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedMedia.map((file) => (
                        <div key={file.id} className="relative aspect-square rounded-lg overflow-hidden border border-border/60">
                          {file.type === "video" ? (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Video className="w-6 h-6 text-muted-foreground" />
                            </div>
                          ) : (
                            <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => toggleMediaSelection(file)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Library tab */
              isLoadingMedia ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : mediaFiles.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="font-medium">No media files</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload files first using the Upload tab
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                  {mediaFiles.map((file) => {
                    const isSelected = selectedMedia.some(m => m.id === file.id);
                    return (
                      <button
                        key={file.id}
                        onClick={() => toggleMediaSelection(file)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border-brand-500 ring-2 ring-brand-500/20"
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                      >
                        {file.type === "video" ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <img
                            src={file.url}
                            alt={file.originalName}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5">
                          <p className="text-[10px] text-white truncate">
                            {file.originalName}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {selectedMedia.length > 0
                ? `${selectedMedia.length} file${selectedMedia.length > 1 ? "s" : ""} selected`
                : mediaPickerTab === "upload" ? "Upload files to attach" : "Click images to select them"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMediaPicker(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setShowMediaPicker(false)}
                disabled={selectedMedia.length === 0}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Boost Post Dialog */}
      <Dialog open={showBoostDialog} onOpenChange={setShowBoostDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-amber-500" />
              Boost Post
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Select platforms and set credits per platform. More platforms &amp; credits = more reach.
            </p>

            {/* Platform Selection */}
            <div className="space-y-2">
              <Label>Boost on</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "feed", name: "Feed", color: "#8B5CF6" },
                  { id: "instagram", name: "Instagram", color: "#E4405F" },
                  { id: "facebook", name: "Facebook", color: "#1877F2" },
                  { id: "twitter", name: "X", color: "#000000" },
                  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
                  { id: "tiktok", name: "TikTok", color: "#000000" },
                ].map((platform) => {
                  const isSelected = boostPlatforms.has(platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => toggleBoostPlatform(platform.id)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        isSelected
                          ? "border-2 bg-muted"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      style={isSelected ? { borderColor: platform.color, color: platform.color } : undefined}
                    >
                      {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                      {platform.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {boostPlatforms.size} platform{boostPlatforms.size !== 1 ? "s" : ""} selected
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="boost-objective">Goal</Label>
              <select
                id="boost-objective"
                value={boostConfig.objective}
                onChange={(e) => setBoostConfig(prev => ({ ...prev, objective: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="ENGAGEMENT">More Engagement</option>
                <option value="AWARENESS">Brand Awareness</option>
                <option value="TRAFFIC">Website Traffic</option>
                <option value="CONVERSIONS">Conversions</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="boost-budget">Credits per platform</Label>
                <Input
                  id="boost-budget"
                  type="number"
                  min="1"
                  step="1"
                  value={boostConfig.budget}
                  onChange={(e) => setBoostConfig(prev => ({ ...prev, budget: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="boost-duration">Duration (days)</Label>
                <Input
                  id="boost-duration"
                  type="number"
                  min="1"
                  max="30"
                  value={boostConfig.duration}
                  onChange={(e) => setBoostConfig(prev => ({ ...prev, duration: e.target.value }))}
                />
              </div>
            </div>

            {(() => {
              const baseCredits = Math.round(parseFloat(boostConfig.budget || "0"));
              const platCount = Math.max(1, boostPlatforms.size);
              const totalCredits = baseCredits * platCount;
              const totalCents = totalCredits * 5;
              const totalDollars = totalCents / 100;
              const estViews = Math.floor(totalCents / 1);
              return (
                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                  {platCount > 1 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Per platform</span>
                      <span className="font-medium">{baseCredits} credits &times; {platCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total credits</span>
                    <span className="font-semibold">{totalCredits} credits (${totalDollars.toFixed(2)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost per view</span>
                    <span className="font-medium">$0.01</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated views</span>
                    <span className="font-medium">{estViews.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated reach</span>
                    <span className="font-medium">{(estViews * 2).toLocaleString()} - {(estViews * 5).toLocaleString()} people</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowBoostDialog(false)} disabled={isBoosting}>
                Cancel
              </Button>
              <Button onClick={handleBoostPost} disabled={isBoosting || boostPlatforms.size === 0} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                {isBoosting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Boosting...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Boost ({Math.round(parseFloat(boostConfig.budget || "0")) * Math.max(1, boostPlatforms.size)} credits)
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/** Displays 1+ media items with carousel navigation and click-to-enlarge */
function MediaImage({ url, className, alt, onClick }: { url: string; className?: string; alt?: string; onClick?: (e: React.MouseEvent) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [url]);

  // Check if already loaded (cached images fire load before useEffect)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [url]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 text-muted-foreground ${className || ""}`} style={{ minHeight: 200 }}>
        <div className="text-center p-4">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Media unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className={`animate-pulse bg-muted/40 ${className || ""}`} style={{ minHeight: 200 }} />
      )}
      <img
        ref={imgRef}
        src={url}
        alt={alt || "Post media"}
        loading="lazy"
        className={`${className || ""} ${loaded ? "" : "absolute opacity-0 pointer-events-none"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        onClick={onClick}
      />
    </>
  );
}

function MediaVideo({ url, className, onClick }: { url: string; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [url]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 text-muted-foreground ${className || ""}`} style={{ minHeight: 200 }}>
        <div className="text-center p-4">
          <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Video unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <video
      src={url}
      controls
      preload="metadata"
      className={className}
      onError={() => setError(true)}
      onClick={onClick}
    />
  );
}

function PostMediaGallery({ mediaUrls, onMediaClick }: { mediaUrls: string[]; onMediaClick?: (index: number) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (mediaUrls.length === 0) return null;

  if (mediaUrls.length === 1) {
    const url = mediaUrls[0];
    const isVideo = url.match(/\.(mp4|webm|mov)(\?|#|$)/i) || url.includes("video");
    return (
      <div
        className="mb-3 rounded-xl overflow-hidden border bg-muted/20 relative group cursor-pointer"
        onClick={() => onMediaClick?.(0)}
      >
        {isVideo ? (
          <MediaVideo url={url} className="w-full max-h-[480px] object-contain" onClick={(e) => e.stopPropagation()} />
        ) : (
          <MediaImage url={url} className="w-full max-h-[480px] object-contain" />
        )}
        {/* Zoom overlay on hover (images only) */}
        {!isVideo && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const url = mediaUrls[activeIndex];
  const isVideo = url.match(/\.(mp4|webm|mov)(\?|#|$)/i) || url.includes("video");

  return (
    <div className="mb-3 rounded-xl overflow-hidden relative group border bg-muted/20">
      <div
        className="cursor-pointer"
        onClick={() => onMediaClick?.(activeIndex)}
      >
        {isVideo ? (
          <MediaVideo url={url} className="w-full max-h-[480px] object-contain" onClick={(e) => e.stopPropagation()} />
        ) : (
          <MediaImage url={url} className="w-full max-h-[480px] object-contain" />
        )}
        {/* Zoom overlay on hover (images only) */}
        {!isVideo && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {activeIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setActiveIndex(prev => prev - 1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {activeIndex < mediaUrls.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setActiveIndex(prev => prev + 1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Dots indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {mediaUrls.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === activeIndex ? "bg-white scale-125" : "bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full font-medium z-10">
        {activeIndex + 1} / {mediaUrls.length}
      </div>
    </div>
  );
}
