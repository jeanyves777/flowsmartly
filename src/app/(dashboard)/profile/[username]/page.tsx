"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  MapPin,
  Globe,
  Calendar,
  Mail,
  Edit2,
  FileText,
  Users,
  UserPlus,
  Sparkles,
  Crown,
  Star,
  AlertCircle,
  ExternalLink,
  Camera,
  Heart,
  MessageCircle,
  Share2,
  ImageIcon,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  website: string | null;
  plan: string;
  aiCredits: number;
  balance: number;
  timezone: string;
  emailVerified: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  mediaType: string | null;
  hashtags: string[];
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
  viewCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  createdAt: string;
}

const planConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  STARTER: {
    label: "Starter",
    icon: Star,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  },
  PRO: {
    label: "Pro",
    icon: Sparkles,
    color: "text-brand-500",
    bgColor: "bg-brand-500/10",
  },
  BUSINESS: {
    label: "Business",
    icon: Crown,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
};

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { toast } = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users/profile");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch profile");
      }

      const user = data.data.user as UserProfile;
      setProfile(user);
      setIsOwnProfile(
        user.username?.toLowerCase() === username?.toLowerCase()
      );
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [username, toast]);

  const fetchPosts = useCallback(async (userId: string) => {
    try {
      setIsLoadingPosts(true);
      const response = await fetch(`/api/posts?userId=${userId}&limit=6`);
      const data = await response.json();
      if (data.success) {
        setPosts(data.data.posts || []);
      }
    } catch {
      // Silent fail for posts
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile?.id) {
      fetchPosts(profile.id);
    }
  }, [profile?.id, fetchPosts]);

  const handleCoverUpload = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }

    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "cover");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error?.message || "Upload failed");

      const url = uploadData.data.url;

      // Save to profile
      const saveRes = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImageUrl: url }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error?.message || "Failed to save");

      setProfile((prev) => prev ? { ...prev, coverImageUrl: url } : prev);
      toast({ title: "Cover photo updated!" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }, [toast]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatPostDate = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col pb-8">
        <div className="w-full space-y-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <div className="flex items-end gap-6 -mt-16 px-6">
            <Skeleton className="w-32 h-32 rounded-full border-4 border-background" />
            <div className="space-y-2 pb-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 px-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6 px-6">
            <Skeleton className="h-40 lg:col-span-2 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The user @{username} could not be found.
          </p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const planInfo = planConfig[profile.plan] || planConfig.STARTER;
  const PlanIcon = planInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col pb-8"
    >
      <div className="w-full">
        {/* Cover / Banner */}
        <div className="h-56 rounded-xl relative overflow-hidden group">
          {profile.coverImageUrl ? (
            <Image
              src={profile.coverImageUrl}
              alt="Cover"
              fill
              className="object-cover"
              priority
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 via-purple-500/20 to-pink-500/20" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent_70%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_60%)]" />
            </>
          )}

          {/* Cover upload button */}
          {isOwnProfile && (
            <div className="absolute bottom-3 right-3 z-10">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverUpload(file);
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  coverInputRef.current?.click();
                }}
                disabled={isUploadingCover}
                className="bg-black/60 hover:bg-black/80 text-white border-0 shadow-lg"
              >
                {isUploadingCover ? (
                  <AISpinner className="w-4 h-4 mr-1.5" />
                ) : (
                  <Camera className="w-4 h-4 mr-1.5" />
                )}
                {isUploadingCover ? "Uploading..." : profile.coverImageUrl ? "Change Cover" : "Add Cover"}
              </Button>
            </div>
          )}
        </div>

        {/* Profile header */}
        <div className="px-6 -mt-16 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
            {/* Avatar */}
            <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-brand-500 to-purple-500 text-white">
                {getInitials(profile.name || profile.username || "U")}
              </AvatarFallback>
            </Avatar>

            {/* Name + actions */}
            <div className="flex-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl font-bold">{profile.name}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "gap-1",
                    planInfo.bgColor,
                    planInfo.color,
                    "border-0"
                  )}
                  variant="outline"
                >
                  <PlanIcon className="w-3 h-3" />
                  {planInfo.label}
                </Badge>

                {isOwnProfile && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/settings">
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      Edit Profile
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 px-6 mt-6">
          {[
            {
              label: "Posts",
              value: profile.postsCount,
              icon: FileText,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Followers",
              value: profile.followersCount,
              icon: Users,
              color: "text-green-500",
              bg: "bg-green-500/10",
            },
            {
              label: "Following",
              value: profile.followingCount,
              icon: UserPlus,
              color: "text-purple-500",
              bg: "bg-purple-500/10",
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    stat.bg
                  )}
                >
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bio + Details + Posts */}
        <div className="grid lg:grid-cols-3 gap-6 px-6 mt-6">
          {/* Left: About + Posts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bio */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-500" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.bio ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {isOwnProfile
                      ? "You haven't added a bio yet. Go to Settings to add one."
                      : "This user hasn't added a bio yet."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Posts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-500" />
                    Recent Posts
                  </CardTitle>
                  {posts.length > 0 && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/feed" className="text-xs text-muted-foreground hover:text-foreground">
                        View all
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPosts ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {isOwnProfile
                        ? "You haven't created any posts yet."
                        : "No posts yet."}
                    </p>
                    {isOwnProfile && (
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <Link href="/content/posts">Create your first post</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Post media thumbnail */}
                          {post.mediaUrls.length > 0 && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                              {post.mediaType === "VIDEO" ? (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <Video className="w-6 h-6 text-muted-foreground" />
                                </div>
                              ) : (
                                <Image
                                  src={post.mediaUrls[0]}
                                  alt=""
                                  fill
                                  className="object-cover"
                                />
                              )}
                              {post.mediaUrls.length > 1 && (
                                <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded text-[10px] text-white px-1">
                                  +{post.mediaUrls.length - 1}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Post content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-2 mb-2">
                              {post.content || "No caption"}
                            </p>

                            {/* Hashtags */}
                            {post.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {post.hashtags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs text-brand-500"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {post.hashtags.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{post.hashtags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Post stats */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Heart className={cn("w-3.5 h-3.5", post.isLiked && "fill-red-500 text-red-500")} />
                                {post.likesCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3.5 h-3.5" />
                                {post.commentsCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Share2 className="w-3.5 h-3.5" />
                                {post.sharesCount}
                              </span>
                              <span className="ml-auto">
                                {formatPostDate(post.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Info sidebar */}
          <div className="space-y-6">
            {/* Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.website && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a
                      href={
                        profile.website.startsWith("http")
                          ? profile.website
                          : `https://${profile.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-500 hover:underline truncate flex items-center gap-1"
                    >
                      {profile.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}

                {isOwnProfile && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{profile.email}</span>
                    {profile.emailVerified && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 shrink-0"
                      >
                        Verified
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{profile.timezone}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    Joined {formatDate(profile.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Credits & Plan (own profile only) */}
            {isOwnProfile && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-500" />
                    Credits & Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge
                      className={cn(
                        "gap-1",
                        planInfo.bgColor,
                        planInfo.color,
                        "border-0"
                      )}
                      variant="outline"
                    >
                      <PlanIcon className="w-3 h-3" />
                      {planInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      AI Credits
                    </span>
                    <span className="text-sm font-bold">
                      {profile.aiCredits.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Balance
                    </span>
                    <span className="text-sm font-bold">
                      ${profile.balance.toFixed(2)}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    asChild
                  >
                    <Link href="/settings?tab=billing">Manage Billing</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
