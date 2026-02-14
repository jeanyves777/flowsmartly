"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Search,
  Image,
  Video,
  FileText,
  File,
  Trash2,
  Download,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminMediaFile {
  id: string;
  originalName: string;
  url: string;
  type: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  folder: { id: string; name: string } | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  tags: string[];
  createdAt: string;
}

interface MediaStats {
  totalFiles: number;
  totalSize: number;
  typeBreakdown: { type: string; count: number }[];
}

const typeIcons: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  document: FileText,
  svg: File,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

export default function AdminMediaPage() {
  const [files, setFiles] = useState<AdminMediaFile[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/admin/media?${params}`);
      const data = await res.json();

      if (data.success) {
        setFiles(data.data.files);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch admin media:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="w-6 h-6" />
          Media Management
        </h1>
        <p className="text-muted-foreground mt-1">View and manage all user media files</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stats.totalFiles}</p>
              <p className="text-xs text-muted-foreground">Total Files</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
              <p className="text-xs text-muted-foreground">Total Storage</p>
            </CardContent>
          </Card>
          {stats.typeBreakdown.map((tb) => (
            <Card key={tb.type}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{tb.count}</p>
                <p className="text-xs text-muted-foreground capitalize">{tb.type}s</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {[null, "image", "video", "svg", "document"].map((type) => (
            <Button
              key={type || "all"}
              variant={typeFilter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(type)}
            >
              {type ? type.charAt(0).toUpperCase() + type.slice(1) : "All"}
            </Button>
          ))}
        </div>
      </div>

      {/* Files Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {files.map((file) => {
                const TypeIcon = typeIcons[file.type] || File;
                return (
                  <div key={file.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {file.type === "image" || file.type === "svg" ? (
                        <img src={file.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <TypeIcon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} - {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-xs">{file.user.name}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{file.type}</Badge>
                    {file.tags.length > 0 && (
                      <div className="flex gap-1 hidden md:flex">
                        {file.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {files.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No media files found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
