"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Globe, Edit3, Trash2, Eye, FileText, ExternalLink } from "lucide-react";

interface Website {
  id: string;
  name: string;
  slug: string;
  status: string;
  pageCount: number;
  totalViews: number;
  customDomain?: string;
  updatedAt: string;
  pages: Array<{ id: string; title: string; slug: string; isHomePage: boolean }>;
}

export default function WebsitesPage() {
  const router = useRouter();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/websites")
      .then((r) => r.json())
      .then((d) => { setWebsites(d.websites || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this website?")) return;
    await fetch(`/api/websites/${id}`, { method: "DELETE" });
    setWebsites((w) => w.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Website Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Build and manage your websites with AI</p>
        </div>
        <button
          onClick={() => router.push("/websites/create")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Website
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : websites.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No websites yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Create your first website with AI in minutes. Just answer a few questions and we'll build it for you.
          </p>
          <button
            onClick={() => router.push("/websites/create")}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all"
          >
            Create Your First Website
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {websites.map((site) => (
            <div key={site.id} className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
              {/* Preview Area */}
              <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <Globe className="w-12 h-12 text-primary/30" />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{site.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {site.customDomain || `flowsmartly.com/sites/${site.slug}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    site.status === "PUBLISHED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {site.status === "PUBLISHED" ? "Live" : "Draft"}
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{site.pageCount} pages</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{site.totalViews} views</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <button
                    onClick={() => router.push(`/websites/${site.id}/editor`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <a
                    href={`/sites/${site.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
