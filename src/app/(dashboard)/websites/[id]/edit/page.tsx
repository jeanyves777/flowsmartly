"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle } from "lucide-react";

interface Website {
  id: string;
  name: string;
  slug: string;
  status: string;
  buildStatus: string;
  lastBuildAt?: string;
  lastBuildError?: string;
  siteData: string;
}

export default function WebsiteEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}`)
      .then((r) => r.json())
      .then((d) => { setWebsite(d.website); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await fetch(`/api/websites/${id}/rebuild`, { method: "POST" });
      // Poll for completion
      const poll = setInterval(async () => {
        const res = await fetch(`/api/websites/${id}`);
        const data = await res.json();
        setWebsite(data.website);
        if (data.website.buildStatus !== "building") {
          clearInterval(poll);
          setRebuilding(false);
        }
      }, 3000);
    } catch {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Website not found</p>
        <button onClick={() => router.push("/websites")} className="mt-4 text-sm text-primary hover:underline">Back to websites</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/websites")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{website.name}</h1>
            <p className="text-xs text-muted-foreground">/sites/{website.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {website.buildStatus === "built" && (
            <a href={`/sites/${website.slug}`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> View Site
            </a>
          )}
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild</>}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {website.buildStatus === "built" ? (
              <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Built & Live</span>
            ) : website.buildStatus === "building" ? (
              <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
            ) : website.buildStatus === "error" ? (
              <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Build Error</span>
            ) : (
              <span className="text-sm text-muted-foreground">Draft</span>
            )}
          </div>
          {website.lastBuildAt && (
            <span className="text-xs text-muted-foreground">Last built: {new Date(website.lastBuildAt).toLocaleString()}</span>
          )}
        </div>
        {website.lastBuildError && (
          <pre className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-lg overflow-auto max-h-40">
            {website.lastBuildError}
          </pre>
        )}
      </div>

      {/* Preview */}
      {website.buildStatus === "built" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <span className="text-xs text-muted-foreground flex-1 text-center">{website.name}</span>
          </div>
          <iframe
            src={`/sites/${website.slug}`}
            className="w-full h-[70vh] border-0"
            title="Website Preview"
          />
        </div>
      )}

      {website.buildStatus !== "built" && (
        <div className="text-center py-20 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground mb-4">Your website hasn't been built yet.</p>
          <button onClick={handleRebuild} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Build Now
          </button>
        </div>
      )}
    </div>
  );
}
