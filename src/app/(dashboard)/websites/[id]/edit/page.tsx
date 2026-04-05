"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle, Globe,
  Palette, FileText, Image as ImageIcon, Save, Plus, Trash2, Link2, GripVertical,
} from "lucide-react";

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

interface SiteData {
  company: {
    name: string; shortName: string; tagline: string; description: string;
    about: string; mission: string; address: string; city: string; state: string;
    country: string; phones: string[]; emails: string[]; website: string;
  };
  services: Array<{ id: string; title: string; shortDescription: string; description: string; icon: string }>;
  stats: Array<{ label: string; value: number }>;
  testimonials: Array<{ name: string; role: string; text: string; rating: number }>;
}

export default function WebsiteEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [fixingLinks, setFixingLinks] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [dataChanged, setDataChanged] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setWebsite(d.website);
        // Parse siteData or fetch from generated data.ts
        if (d.website?.siteData && d.website.siteData !== "{}") {
          try { setSiteData(JSON.parse(d.website.siteData)); } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Fetch live data from the generated site's data.ts via API
  useEffect(() => {
    if (!id || siteData) return;
    fetch(`/api/websites/${id}/site-data`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setSiteData(d.data); })
      .catch(() => {});
  }, [id, siteData]);

  const handleSaveData = async () => {
    if (!siteData) return;
    setSaving(true);
    try {
      await fetch(`/api/websites/${id}/update-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: siteData }),
      });
      setDataChanged(false);
      // Auto-rebuild after save
      handleRebuild();
    } catch {}
    setSaving(false);
  };

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
    } catch { setRebuilding(false); }
  };

  const handleFixLinks = async () => {
    setFixingLinks(true);
    try {
      await fetch(`/api/websites/${id}/fix-links`, { method: "POST" });
      const poll = setInterval(async () => {
        const res = await fetch(`/api/websites/${id}`);
        const data = await res.json();
        setWebsite(data.website);
        if (data.website.buildStatus !== "building") {
          clearInterval(poll);
          setFixingLinks(false);
          if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
        }
      }, 3000);
    } catch { setFixingLinks(false); }
  };

  const updateCompany = (field: string, value: string) => {
    if (!siteData) return;
    setSiteData({ ...siteData, company: { ...siteData.company, [field]: value } });
    setDataChanged(true);
  };

  const updateService = (index: number, field: string, value: string) => {
    if (!siteData) return;
    const services = [...siteData.services];
    services[index] = { ...services[index], [field]: value };
    setSiteData({ ...siteData, services });
    setDataChanged(true);
  };

  const addService = () => {
    if (!siteData) return;
    setSiteData({ ...siteData, services: [...siteData.services, { id: `service-${Date.now()}`, title: "New Service", shortDescription: "", description: "", icon: "Star" }] });
    setDataChanged(true);
  };

  const removeService = (index: number) => {
    if (!siteData) return;
    setSiteData({ ...siteData, services: siteData.services.filter((_, i) => i !== index) });
    setDataChanged(true);
  };

  const updateStat = (index: number, field: string, value: string | number) => {
    if (!siteData) return;
    const stats = [...siteData.stats];
    stats[index] = { ...stats[index], [field]: field === "value" ? Number(value) || 0 : value };
    setSiteData({ ...siteData, stats });
    setDataChanged(true);
  };

  const updateTestimonial = (index: number, field: string, value: string | number) => {
    if (!siteData) return;
    const testimonials = [...siteData.testimonials];
    testimonials[index] = { ...testimonials[index], [field]: field === "rating" ? Number(value) || 5 : value };
    setSiteData({ ...siteData, testimonials });
    setDataChanged(true);
  };

  const addTestimonial = () => {
    if (!siteData) return;
    setSiteData({ ...siteData, testimonials: [...siteData.testimonials, { name: "", role: "", text: "", rating: 5 }] });
    setDataChanged(true);
  };

  const removeTestimonial = (index: number) => {
    if (!siteData) return;
    setSiteData({ ...siteData, testimonials: siteData.testimonials.filter((_, i) => i !== index) });
    setDataChanged(true);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!website) return <div className="text-center py-20"><p className="text-muted-foreground">Website not found</p></div>;

  const tabs = [
    { id: "preview", label: "Preview", icon: Globe },
    { id: "company", label: "Company Info", icon: FileText },
    { id: "services", label: "Services", icon: Palette },
    { id: "stats", label: "Stats & Reviews", icon: Check },
    { id: "domains", label: "Domains", icon: Link2 },
    { id: "status", label: "Build", icon: RefreshCw },
  ];

  const isBuilding = rebuilding || fixingLinks || saving || website.buildStatus === "building";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/websites")} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-xl font-bold">{website.name}</h1>
            <p className="text-xs text-muted-foreground">/sites/{website.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataChanged && (
            <button onClick={handleSaveData} disabled={isBuilding} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-all">
              <Save className="w-3.5 h-3.5" /> Save & Rebuild
            </button>
          )}
          {website.buildStatus === "built" && (
            <a href={`/sites/${website.slug}/`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> View Site
            </a>
          )}
          <button onClick={handleFixLinks} disabled={isBuilding} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors">
            {fixingLinks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Fix Links
          </button>
          <button onClick={handleRebuild} disabled={isBuilding} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all">
            {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      {activeTab === "preview" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
            <span className="text-xs text-muted-foreground flex-1 text-center">flowsmartly.com/sites/{website.slug}/</span>
          </div>
          {website.buildStatus === "built" ? (
            <iframe ref={iframeRef} src={`/sites/${website.slug}/`} className="w-full h-[75vh] border-0" title="Preview" />
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">{website.buildStatus === "building" ? "Building..." : "Not built yet"}</p>
              {website.buildStatus !== "building" && <button onClick={handleRebuild} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Build Now</button>}
            </div>
          )}
        </div>
      )}

      {/* Company Info Editor */}
      {activeTab === "company" && siteData && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Company Information</h2>
          <p className="text-sm text-muted-foreground">Edit your business details. Click "Save & Rebuild" to update your site.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Name" value={siteData.company.name} onChange={(v) => updateCompany("name", v)} />
            <Field label="Short Name" value={siteData.company.shortName} onChange={(v) => updateCompany("shortName", v)} />
            <Field label="Tagline" value={siteData.company.tagline} onChange={(v) => updateCompany("tagline", v)} className="md:col-span-2" />
            <Field label="Description" value={siteData.company.description} onChange={(v) => updateCompany("description", v)} multiline className="md:col-span-2" />
            <Field label="About" value={siteData.company.about} onChange={(v) => updateCompany("about", v)} multiline className="md:col-span-2" />
            <Field label="Mission" value={siteData.company.mission} onChange={(v) => updateCompany("mission", v)} multiline className="md:col-span-2" />
            <Field label="Address" value={siteData.company.address} onChange={(v) => updateCompany("address", v)} />
            <Field label="City" value={siteData.company.city} onChange={(v) => updateCompany("city", v)} />
            <Field label="State" value={siteData.company.state} onChange={(v) => updateCompany("state", v)} />
            <Field label="Country" value={siteData.company.country} onChange={(v) => updateCompany("country", v)} />
            <Field label="Phone" value={siteData.company.phones?.[0] || ""} onChange={(v) => { setSiteData({ ...siteData, company: { ...siteData.company, phones: [v] } }); setDataChanged(true); }} />
            <Field label="Email" value={siteData.company.emails?.[0] || ""} onChange={(v) => { setSiteData({ ...siteData, company: { ...siteData.company, emails: [v] } }); setDataChanged(true); }} />
            <Field label="Website" value={siteData.company.website} onChange={(v) => updateCompany("website", v)} className="md:col-span-2" />
          </div>
        </div>
      )}

      {/* Services Editor */}
      {activeTab === "services" && siteData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Services ({siteData.services.length})</h2>
            <button onClick={addService} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Service</button>
          </div>
          {siteData.services.map((service, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Service {i + 1}</span>
                <button onClick={() => removeService(i)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Title" value={service.title} onChange={(v) => updateService(i, "title", v)} />
                <Field label="Icon (Lucide name)" value={service.icon} onChange={(v) => updateService(i, "icon", v)} />
                <Field label="Short Description" value={service.shortDescription} onChange={(v) => updateService(i, "shortDescription", v)} className="md:col-span-2" />
                <Field label="Full Description" value={service.description} onChange={(v) => updateService(i, "description", v)} multiline className="md:col-span-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats & Reviews */}
      {activeTab === "stats" && siteData && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {siteData.stats.map((stat, i) => (
                <div key={i} className="space-y-2">
                  <input type="number" value={stat.value} onChange={(e) => updateStat(i, "value", e.target.value)} className="w-full text-2xl font-bold text-center px-2 py-1 border border-border rounded-lg bg-background focus:ring-1 focus:ring-primary" />
                  <input type="text" value={stat.label} onChange={(e) => updateStat(i, "label", e.target.value)} className="w-full text-xs text-center px-2 py-1 border border-border rounded-lg bg-background focus:ring-1 focus:ring-primary" />
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Testimonials ({siteData.testimonials.length})</h2>
              <button onClick={addTestimonial} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            {siteData.testimonials.map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 mb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Review {i + 1}</span>
                  <button onClick={() => removeTestimonial(i)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Name" value={t.name} onChange={(v) => updateTestimonial(i, "name", v)} />
                  <Field label="Role" value={t.role} onChange={(v) => updateTestimonial(i, "role", v)} />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
                    <select value={t.rating} onChange={(e) => updateTestimonial(i, "rating", e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                      {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
                    </select>
                  </div>
                </div>
                <Field label="Review Text" value={t.text} onChange={(v) => updateTestimonial(i, "text", v)} multiline />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domains */}
      {activeTab === "domains" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Custom Domains</h2>
          <p className="text-sm text-muted-foreground mb-4">Your site is currently at:</p>
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
              <p className="text-xs text-muted-foreground mt-1">Search and buy through us</p>
            </a>
          </div>
        </div>
      )}

      {/* Build Status */}
      {activeTab === "status" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Build Status</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {website.buildStatus === "built" ? <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Live</span>
             : website.buildStatus === "building" ? <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
             : website.buildStatus === "error" ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Error</span>
             : <span className="text-sm text-muted-foreground">Idle</span>}
          </div>
          {website.lastBuildAt && <p className="text-sm text-muted-foreground">Last built: {new Date(website.lastBuildAt).toLocaleString()}</p>}
          {website.buildStatus === "error" && website.lastBuildError && (
            <pre className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-lg overflow-auto max-h-60">{website.lastBuildError}</pre>
          )}
        </div>
      )}

      {/* Unsaved changes bar */}
      {dataChanged && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 dark:border-amber-800 px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">You have unsaved changes</p>
          <button onClick={handleSaveData} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save & Rebuild
          </button>
        </div>
      )}
    </div>
  );
}

// Reusable field component
function Field({ label, value, onChange, multiline, className }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {multiline ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      ) : (
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
      )}
    </div>
  );
}
