"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Globe, Edit3, Trash2, Eye, ExternalLink, RefreshCw, Loader2, AlertCircle, Check, BarChart3 } from "lucide-react";

interface Website {
  id: string;
  name: string;
  slug: string;
  status: string;
  buildStatus: string;
  pageCount: number;
  totalViews: number;
  customDomain?: string;
  updatedAt: string;
  lastBuildAt?: string;
  lastBuildError?: string;
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
    if (!confirm("Delete this website and all its files?")) return;
    await fetch(`/api/websites/${id}`, { method: "DELETE" });
    setWebsites((w) => w.filter((s) => s.id !== id));
  };

  const handleRebuild = async (id: string) => {
    await fetch(`/api/websites/${id}/rebuild`, { method: "POST" });
    // Refresh list
    const res = await fetch("/api/websites");
    const data = await res.json();
    setWebsites(data.websites || []);
  };

  const getBuildStatusBadge = (site: Website) => {
    if (site.buildStatus === "building") return <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"><Loader2 className="w-3 h-3 animate-spin" />Building</span>;
    if (site.buildStatus === "error") return <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle className="w-3 h-3" />Error</span>;
    if (site.buildStatus === "built" && site.status === "PUBLISHED") return <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><Check className="w-3 h-3" />Live</span>;
    return <span className="text-xs text-amber-600 dark:text-amber-400">Draft</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Website Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Build professional websites with AI — real Next.js sites with animations</p>
        </div>
        {websites.length === 0 && (
          <button onClick={() => router.push("/websites/create")} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all">
            <Plus className="w-4 h-4" />
            Create Website
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : websites.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No websites yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Create your first professional website. AI builds a complete site with animations, dark mode, and responsive design.
          </p>
          <button onClick={() => router.push("/websites/create")} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all">
            Create Your First Website
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {websites.map((site) => (
            <div key={site.id} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <Globe className="w-12 h-12 text-primary/30" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold truncate flex-1">{site.name}</h3>
                  {getBuildStatusBadge(site)}
                </div>
                <p className="text-xs text-muted-foreground">{site.customDomain || `/sites/${site.slug}`}</p>

                {site.buildStatus === "error" && site.lastBuildError && (
                  <p className="text-xs text-red-500 mt-2 line-clamp-2">{site.lastBuildError}</p>
                )}

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <button onClick={() => router.push(`/websites/${site.id}/edit`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => router.push(`/websites/${site.id}/analytics`)} className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors" title="Analytics">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                  {site.buildStatus === "built" && (
                    <a href={`/sites/${site.slug}/`} target="_blank" className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors" title="View Site">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => handleRebuild(site.id)} className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors" title="Rebuild">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(site.id)} className="px-3 py-1.5 border border-border rounded-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors">
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
