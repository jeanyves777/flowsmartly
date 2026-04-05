"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle, Globe, Palette, FileText, Users, Star, Phone, Image as ImageIcon } from "lucide-react";

interface Website {
  id: string;
  name: string;
  slug: string;
  status: string;
  buildStatus: string;
  lastBuildAt?: string;
  lastBuildError?: string;
  siteData: string;
  brandKit?: { name: string; colors: string; fonts: string; logo?: string };
}

export default function WebsiteEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
      const poll = setInterval(async () => {
        const res = await fetch(`/api/websites/${id}`);
        const data = await res.json();
        setWebsite(data.website);
        if (data.website.buildStatus !== "building") {
          clearInterval(poll);
          setRebuilding(false);
          if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
        }
      }, 3000);
    } catch {
      setRebuilding(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!website) {
    return <div className="text-center py-20"><p className="text-muted-foreground">Website not found</p></div>;
  }

  const tabs = [
    { id: "preview", label: "Preview", icon: Globe },
    { id: "info", label: "Business Info", icon: FileText },
    { id: "design", label: "Design", icon: Palette },
    { id: "domains", label: "Domains", icon: Globe },
    { id: "media", label: "Media", icon: ImageIcon },
    { id: "status", label: "Build Status", icon: Check },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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
            <a href={`/sites/${website.slug}/`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "preview" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <span className="text-xs text-muted-foreground flex-1 text-center">
              {website.buildStatus === "built" ? `flowsmartly.com/sites/${website.slug}/` : "Not built yet"}
            </span>
          </div>
          {website.buildStatus === "built" ? (
            <iframe ref={iframeRef} src={`/sites/${website.slug}/`} className="w-full h-[75vh] border-0" title="Website Preview" />
          ) : website.buildStatus === "building" ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Building your website...</p>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">
                {website.buildStatus === "error" ? "Build failed. Check the Build Status tab for details." : "Your website hasn't been built yet."}
              </p>
              <button onClick={handleRebuild} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                Build Now
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "info" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Business Information</h2>
          <p className="text-sm text-muted-foreground mb-6">
            To edit your site content, update your <a href="/brand" className="text-primary hover:underline">Brand Identity</a> and rebuild the site. The AI agent uses your brand kit to generate all content.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Connected Brand Kit</h3>
              {website.brandKit ? (
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="font-medium">{website.brandKit.name}</p>
                  {(() => {
                    try {
                      const colors = typeof website.brandKit!.colors === "string" ? JSON.parse(website.brandKit!.colors) : website.brandKit!.colors;
                      return (
                        <div className="flex gap-2 mt-2">
                          {colors.primary && <div className="w-6 h-6 rounded border" style={{ backgroundColor: colors.primary }} title="Primary" />}
                          {colors.secondary && <div className="w-6 h-6 rounded border" style={{ backgroundColor: colors.secondary }} title="Secondary" />}
                          {colors.accent && <div className="w-6 h-6 rounded border" style={{ backgroundColor: colors.accent }} title="Accent" />}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No brand kit connected</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">How to Edit</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>1. Go to <a href="/brand" className="text-primary hover:underline">Brand Identity</a> and update your info</li>
                <li>2. Come back here and click <strong>Rebuild</strong></li>
                <li>3. The AI agent will regenerate your site with updated content</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "design" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Design Settings</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your site's colors, fonts, and logo come from your Brand Kit. Update them there to change the design.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a href="/brand" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center">
              <Palette className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Colors & Fonts</p>
              <p className="text-xs text-muted-foreground mt-1">Edit in Brand Kit</p>
            </a>
            <a href="/brand" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center">
              <ImageIcon className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Logo & Favicon</p>
              <p className="text-xs text-muted-foreground mt-1">Upload in Brand Kit</p>
            </a>
            <a href="/media" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center">
              <ImageIcon className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Site Images</p>
              <p className="text-xs text-muted-foreground mt-1">Manage in Media Library</p>
            </a>
          </div>
        </div>
      )}

      {activeTab === "domains" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Custom Domains</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your own domain or purchase a new one. Your site is currently accessible at:
          </p>
          <div className="p-3 bg-muted/30 rounded-lg border border-border mb-6">
            <code className="text-sm">flowsmartly.com/sites/{website.slug}</code>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a href="/domains" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center">
              <Globe className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Connect Existing Domain</p>
              <p className="text-xs text-muted-foreground mt-1">Point your domain's DNS to FlowSmartly</p>
            </a>
            <a href="/domains" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center">
              <Globe className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Purchase New Domain</p>
              <p className="text-xs text-muted-foreground mt-1">Search and buy a domain through us</p>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            SSL certificates are automatically provisioned via Cloudflare. Custom domains include DNS management and HTTPS.
          </p>
        </div>
      )}

      {activeTab === "media" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Site Media</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Stock images were downloaded during site generation. View and manage them in your <a href="/media" className="text-primary hover:underline">Media Library</a> under the "Website Images" folder.
          </p>
        </div>
      )}

      {activeTab === "status" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Build Status</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Current Status:</span>
              {website.buildStatus === "built" ? (
                <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Built & Live</span>
              ) : website.buildStatus === "building" ? (
                <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
              ) : website.buildStatus === "error" ? (
                <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Build Error</span>
              ) : (
                <span className="text-sm text-muted-foreground">Idle</span>
              )}
            </div>
            {website.lastBuildAt && (
              <p className="text-sm text-muted-foreground">Last built: {new Date(website.lastBuildAt).toLocaleString()}</p>
            )}
            {website.buildStatus === "error" && website.lastBuildError && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">Error Details:</p>
                <pre className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-lg overflow-auto max-h-60">
                  {website.lastBuildError}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
