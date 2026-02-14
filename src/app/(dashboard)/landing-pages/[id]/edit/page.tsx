"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Settings,
  Share2,
  Users,
} from "lucide-react";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  pageType: string;
  htmlContent: string;
  status: string;
  views: number;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const deviceIcons: Record<DeviceMode, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

export default function EditLandingPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;

  const [page, setPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [device, setDevice] = useState<DeviceMode>("desktop");

  // Submissions
  const [submissionCount, setSubmissionCount] = useState(0);
  const [recentSubmissions, setRecentSubmissions] = useState<Array<{ id: string; data: Record<string, unknown>; createdAt: string }>>([]);

  // Editable fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/landing-pages/${id}`);
      const json = await res.json();

      if (!json.success) {
        toast({ title: "Error", description: json.error?.message || "Failed to load page", variant: "destructive" });
        return;
      }

      const p = json.data.page as LandingPage;
      setPage(p);
      setTitle(p.title);
      setSlug(p.slug);
      setDescription(p.description || "");
    } catch {
      toast({ title: "Error", description: "Failed to load landing page", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Fetch submissions separately after page loads
  useEffect(() => {
    if (!page) return;
    fetch(`/api/landing-pages/${page.id}?include=submissions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.submissionCount !== undefined) {
          setSubmissionCount(data.data.submissionCount);
        }
        if (data.data?.recentSubmissions) {
          setRecentSubmissions(data.data.recentSubmissions);
        }
      })
      .catch(() => {});
  }, [page]);

  const handleSave = async () => {
    if (!page) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/landing-pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, description }),
      });
      const json = await res.json();

      if (!json.success) {
        toast({ title: "Save failed", description: json.error?.message || "Could not save changes", variant: "destructive" });
        return;
      }

      const updated = json.data.page as LandingPage;
      setPage(updated);
      setTitle(updated.title);
      setSlug(updated.slug);
      setDescription(updated.description || "");
      toast({ title: "Saved", description: "Landing page updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!page) return;
    try {
      setPublishing(true);
      const res = await fetch(`/api/landing-pages/${id}/publish`, { method: "POST" });
      const json = await res.json();

      if (!json.success) {
        toast({ title: "Error", description: json.error?.message || "Failed to update status", variant: "destructive" });
        return;
      }

      const updated = json.data.page as LandingPage;
      setPage(updated);
      const action = updated.status === "PUBLISHED" ? "published" : "unpublished";
      toast({ title: "Status updated", description: `Page ${action} successfully.` });
    } catch {
      toast({ title: "Error", description: "Failed to toggle publish status", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    try {
      setDeleting(true);
      const res = await fetch(`/api/landing-pages/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!json.success) {
        toast({ title: "Error", description: json.error?.message || "Failed to delete page", variant: "destructive" });
        return;
      }

      toast({ title: "Deleted", description: "Landing page deleted." });
      router.push("/landing-pages");
    } catch {
      toast({ title: "Error", description: "Failed to delete page", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${page?.slug || slug}` : "";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast({ title: "Copied", description: "URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy URL", variant: "destructive" });
    }
  };

  const isPublished = page?.status === "PUBLISHED";
  const hasChanges = page && (title !== page.title || slug !== page.slug || description !== (page.description || ""));

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-5 w-48" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex flex-1">
          <div className="w-[300px] border-r p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <EyeOff className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Page not found</h2>
            <p className="text-sm text-muted-foreground">
              The landing page you are looking for does not exist or you do not have access to it.
            </p>
            <Button asChild>
              <Link href="/landing-pages">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Landing Pages
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 border-b bg-background px-4 py-2"
      >
        <Button variant="ghost" size="icon" asChild>
          <Link href="/landing-pages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Hide settings" : "Show settings"}
        >
          <Settings className="h-4 w-4" />
        </Button>

        <div className="ml-1 flex items-center gap-2 overflow-hidden">
          <h1 className="truncate text-sm font-semibold">{page.title}</h1>
          <Badge variant={isPublished ? "success" : "secondary"} className="shrink-0">
            {isPublished ? "Published" : "Draft"}
          </Badge>
        </div>

        {/* Device toggle */}
        <div className="ml-4 flex items-center rounded-md border bg-muted/50 p-0.5">
          {(Object.keys(deviceWidths) as DeviceMode[]).map((mode) => {
            const Icon = deviceIcons[mode];
            return (
              <Button
                key={mode}
                variant={device === mode ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setDevice(mode)}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-1.5 h-4 w-4" />
          )}
          {confirmDelete ? "Confirm?" : "Delete"}
        </Button>

        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save
        </Button>

        <Button
          variant={isPublished ? "secondary" : "default"}
          size="sm"
          onClick={handlePublishToggle}
          disabled={publishing}
        >
          {publishing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isPublished ? (
            <EyeOff className="mr-1.5 h-4 w-4" />
          ) : (
            <Globe className="mr-1.5 h-4 w-4" />
          )}
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
      </motion.div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-[300px] shrink-0 overflow-y-auto border-r bg-muted/30"
          >
            <div className="space-y-5 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/p/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="my-page"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief page description..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Page Type</Label>
                <Input value={page.pageType} disabled className="bg-muted" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Status</Label>
                  <div>
                    <Badge variant={isPublished ? "success" : "secondary"}>
                      {isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Views</Label>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{page.views.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-xs text-muted-foreground">
                    {new Date(page.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Updated</Label>
                  <p className="text-xs text-muted-foreground">
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Public URL section */}
              {isPublished && (
                <Card className="border-green-200 dark:border-green-900">
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-green-600" />
                      <Label className="text-green-700 dark:text-green-400">Public URL</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        value={publicUrl}
                        readOnly
                        className="h-8 text-xs bg-muted"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyUrl}>
                        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Share section */}
              {isPublished && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    <Label>Share</Label>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleCopyUrl}>
                    {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                    {copied ? "Copied!" : "Copy URL"}
                  </Button>
                </div>
              )}

              {/* Submissions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Form Submissions
                  </Label>
                  <Badge variant="secondary">{submissionCount}</Badge>
                </div>

                {recentSubmissions.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recentSubmissions.map((sub) => {
                      const d = typeof sub.data === "string" ? JSON.parse(sub.data as string) : sub.data;
                      return (
                        <div key={sub.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                          <div className="font-medium truncate">{d.email || "No email"}</div>
                          {(d.firstName || d.lastName) && (
                            <div className="text-muted-foreground truncate">
                              {[d.firstName, d.lastName].filter(Boolean).join(" ")}
                            </div>
                          )}
                          <div className="text-muted-foreground mt-0.5">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No submissions yet</p>
                )}

                {submissionCount > 0 && (
                  <Link href="/contacts" className="text-xs text-brand-500 hover:underline">
                    View all contacts →
                  </Link>
                )}
              </div>

              {/* Refresh preview */}
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={fetchPage}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Refresh Preview
              </Button>
            </div>
          </motion.aside>
        )}

        {/* Preview area */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 overflow-auto bg-muted/20 p-4"
        >
          <div
            className="mx-auto h-full transition-all duration-300"
            style={{ maxWidth: deviceWidths[device] }}
          >
            <div
              className={`h-full rounded-lg border bg-white shadow-sm overflow-hidden ${
                device !== "desktop" ? "mx-auto" : ""
              }`}
            >
              <iframe
                srcDoc={page.htmlContent}
                className="h-full w-full border-0"
                title={`Preview: ${page.title}`}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
