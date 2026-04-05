"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle, Globe,
  FileText, Save, Plus, Trash2, Link2, Upload, X, Image as ImageIcon,
  Phone, Mail, MapPin, Star, Users, MessageSquare, HelpCircle,
} from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";

interface Website {
  id: string; name: string; slug: string; status: string; buildStatus: string;
  lastBuildAt?: string; lastBuildError?: string; siteData: string;
}

interface SiteData {
  company: Record<string, any>;
  heroImages?: string[];
  logo?: string;
  services: Array<Record<string, any>>;
  stats: Array<{ label: string; value: number }>;
  team?: Array<Record<string, any>>;
  testimonials?: Array<Record<string, any>>;
  faq?: Array<{ question: string; answer: string }>;
  blogPosts?: Array<Record<string, any>>;
  galleryImages?: Array<Record<string, any>>;
  expertise?: string[];
}

export default function WebsiteEditPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [fixingLinks, setFixingLinks] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [data, setData] = useState<SiteData | null>(null);
  const [changed, setChanged] = useState(false);
  const [pages, setPages] = useState<Array<{ slug: string; label: string }>>([]);
  const [previewPage, setPreviewPage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCallback, setPickerCallback] = useState<((url: string) => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}`).then((r) => r.json()).then((d) => { setWebsite(d.website); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}/site-data`).then((r) => r.json()).then((d) => { if (d.data) setData(d.data); if (d.pages) setPages(d.pages); }).catch(() => {});
  }, [id]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    await fetch(`/api/websites/${id}/update-data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    setChanged(false);
    setSaving(false);
    rebuild();
  };

  const rebuild = async () => {
    setRebuilding(true);
    await fetch(`/api/websites/${id}/rebuild`, { method: "POST" });
    poll();
  };

  const fixLinks = async () => {
    setFixingLinks(true);
    await fetch(`/api/websites/${id}/fix-links`, { method: "POST" });
    poll();
  };

  const poll = () => {
    const iv = setInterval(async () => {
      const res = await fetch(`/api/websites/${id}`);
      const d = await res.json();
      setWebsite(d.website);
      if (d.website.buildStatus !== "building") {
        clearInterval(iv);
        setRebuilding(false);
        setFixingLinks(false);
        if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
      }
    }, 3000);
  };

  const update = (path: string, value: any) => {
    if (!data) return;
    const d = JSON.parse(JSON.stringify(data));
    const parts = path.split(".");
    let obj: any = d;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
      obj = obj[k];
    }
    obj[parts[parts.length - 1]] = value;
    setData(d);
    setChanged(true);
  };

  const openPicker = (callback: (url: string) => void) => {
    setPickerCallback(() => callback);
    setPickerOpen(true);
  };

  const uploadImageToSite = async (file: File, category: string): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const res = await fetch(`/api/websites/${id}/upload-image`, { method: "POST", body: fd });
    const d = await res.json();
    return d.path || "";
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!website) return <div className="text-center py-20"><p className="text-muted-foreground">Website not found</p></div>;

  const busy = rebuilding || fixingLinks || saving;
  // Build tabs dynamically from detected pages + data sections
  const tabs: Array<{ id: string; label: string; icon: any }> = [
    { id: "preview", label: "Preview", icon: Globe },
    { id: "hero", label: "Hero & Branding", icon: ImageIcon },
    { id: "company", label: "Company", icon: FileText },
  ];
  if (data?.services?.length) tabs.push({ id: "services", label: "Services", icon: Star });
  if (data?.team?.length || pages.some((p) => p.slug === "team")) tabs.push({ id: "team", label: "Team", icon: Users });
  if (data?.testimonials?.length || pages.some((p) => p.slug === "testimonials")) tabs.push({ id: "reviews", label: "Reviews", icon: MessageSquare });
  if (data?.faq?.length || pages.some((p) => p.slug === "faq")) tabs.push({ id: "faq", label: "FAQ", icon: HelpCircle });
  if (data?.blogPosts?.length || pages.some((p) => p.slug === "blog")) tabs.push({ id: "blog", label: "Blog", icon: FileText });
  if (data?.galleryImages?.length || pages.some((p) => p.slug === "gallery")) tabs.push({ id: "gallery", label: "Gallery", icon: ImageIcon });
  tabs.push({ id: "domains", label: "Domains", icon: Link2 });
  tabs.push({ id: "build", label: "Build", icon: RefreshCw });

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/websites")} className="p-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-xl font-bold">{website.name}</h1>
            <p className="text-xs text-muted-foreground">/sites/{website.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {changed && <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> Save & Rebuild</button>}
          {website.buildStatus === "built" && <a href={`/sites/${website.slug}/`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted"><ExternalLink className="w-3.5 h-3.5" /> View</a>}
          <button onClick={fixLinks} disabled={busy} className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50">{fixingLinks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fix Links"}</button>
          <button onClick={rebuild} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">{rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild</>}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      {activeTab === "preview" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
            <span className="text-xs text-muted-foreground flex-1 text-center">flowsmartly.com/sites/{website.slug}/{previewPage}</span>
          </div>
          {/* Page navigation */}
          {pages.length > 1 && (
            <div className="flex gap-1 px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto">
              {pages.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => { setPreviewPage(p.slug); if (iframeRef.current) iframeRef.current.src = `/sites/${website.slug}/${p.slug}`; }}
                  className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${previewPage === p.slug ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {website.buildStatus === "built" ? <iframe ref={iframeRef} src={`/sites/${website.slug}/${previewPage}`} className="w-full h-[75vh] border-0" /> : (
            <div className="text-center py-20"><p className="text-muted-foreground mb-4">{website.buildStatus === "building" ? "Building..." : "Not built yet"}</p>
              {website.buildStatus !== "building" && <button onClick={rebuild} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Build Now</button>}
            </div>
          )}
        </div>
      )}

      {/* Hero & Branding */}
      {activeTab === "hero" && data && (
        <div className="space-y-6">
          <Section title="Logo">
            <ImagePicker label="Site Logo" value={data.logo} onChange={(v) => { update("logo", v); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "brand")} />
          </Section>
          <Section title="Hero Slideshow Images">
            <p className="text-sm text-muted-foreground mb-3">Add images for the hero section slideshow. Upload your own photos or pick from your media library.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(data.heroImages || []).map((img, i) => (
                <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => { const imgs = [...(data.heroImages || [])]; imgs.splice(i, 1); update("heroImages", imgs); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => openPicker((url) => update("heroImages", [...(data.heroImages || []), url]))} className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <Plus className="w-5 h-5" /><span className="text-xs">Add Image</span>
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* Company */}
      {activeTab === "company" && data && (
        <Section title="Company Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Name" value={data.company.name} onChange={(v) => update("company.name", v)} />
            <Field label="Short Name" value={data.company.shortName} onChange={(v) => update("company.shortName", v)} />
            <Field label="Tagline" value={data.company.tagline} onChange={(v) => update("company.tagline", v)} span={2} />
            <Field label="Description" value={data.company.description} onChange={(v) => update("company.description", v)} multiline span={2} />
            <Field label="About" value={data.company.about} onChange={(v) => update("company.about", v)} multiline span={2} />
            <Field label="Mission" value={data.company.mission} onChange={(v) => update("company.mission", v)} multiline span={2} />
            <Field label="Address" value={data.company.address} onChange={(v) => update("company.address", v)} icon={<MapPin className="w-4 h-4" />} />
            <Field label="City" value={data.company.city} onChange={(v) => update("company.city", v)} />
            <Field label="State" value={data.company.state} onChange={(v) => update("company.state", v)} />
            <Field label="Country" value={data.company.country} onChange={(v) => update("company.country", v)} />
            <Field label="Phone" value={data.company.phones?.[0]} onChange={(v) => update("company.phones", [v])} icon={<Phone className="w-4 h-4" />} />
            <Field label="Email" value={data.company.emails?.[0]} onChange={(v) => update("company.emails", [v])} icon={<Mail className="w-4 h-4" />} />
            <Field label="Website" value={data.company.website} onChange={(v) => update("company.website", v)} span={2} />
          </div>
        </Section>
      )}

      {/* Services */}
      {activeTab === "services" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Services ({data.services.length})</h2>
            <button onClick={() => { const s = [...data.services, { id: `svc-${Date.now()}`, title: "", shortDescription: "", description: "", icon: "Star", image: "" }]; update("services", s); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          {data.services.map((svc, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                {/* Service Image */}
                <ImagePicker label="" value={svc.image} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], image: v }; update("services", s); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "services")} compact />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Service {i + 1}</span>
                    <button onClick={() => { const s = data.services.filter((_, j) => j !== i); update("services", s); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Title" value={svc.title} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], title: v }; update("services", s); }} />
                    <Field label="Icon (Lucide)" value={svc.icon} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], icon: v }; update("services", s); }} />
                  </div>
                  <Field label="Short Description" value={svc.shortDescription} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], shortDescription: v }; update("services", s); }} />
                  <Field label="Full Description" value={svc.description} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], description: v }; update("services", s); }} multiline />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team */}
      {activeTab === "team" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Team Members ({data.team?.length || 0})</h2>
            <button onClick={() => update("team", [...(data.team || []), { name: "", role: "", bio: "", image: "" }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          {(data.team || []).map((member, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                <ImagePicker label="" value={member.image} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], image: v }; update("team", t); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "team")} compact square />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Member {i + 1}</span>
                    <button onClick={() => { const t = (data.team || []).filter((_, j) => j !== i); update("team", t); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name" value={member.name} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], name: v }; update("team", t); }} />
                    <Field label="Role" value={member.role} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], role: v }; update("team", t); }} />
                  </div>
                  <Field label="Bio" value={member.bio} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], bio: v }; update("team", t); }} multiline />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reviews & Stats */}
      {activeTab === "reviews" && data && (
        <div className="space-y-6">
          <Section title="Statistics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.stats.map((s, i) => (
                <div key={i} className="text-center space-y-1">
                  <input type="number" value={s.value} onChange={(e) => { const st = [...data.stats]; st[i] = { ...st[i], value: Number(e.target.value) || 0 }; update("stats", st); }} className="w-full text-2xl font-bold text-center px-2 py-1 border border-border rounded-lg bg-background" />
                  <input type="text" value={s.label} onChange={(e) => { const st = [...data.stats]; st[i] = { ...st[i], label: e.target.value }; update("stats", st); }} className="w-full text-xs text-center px-2 py-1 border border-border rounded-lg bg-background" />
                </div>
              ))}
            </div>
          </Section>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Testimonials ({data.testimonials?.length || 0})</h2>
              <button onClick={() => update("testimonials", [...(data.testimonials || []), { name: "", role: "", text: "", rating: 5 }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            {(data.testimonials || []).map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">Review {i + 1}</span>
                  <button onClick={() => update("testimonials", (data.testimonials || []).filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <Field label="Name" value={t.name} onChange={(v) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], name: v }; update("testimonials", ts); }} />
                  <Field label="Role" value={t.role} onChange={(v) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], role: v }; update("testimonials", ts); }} />
                  <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
                    <select value={t.rating} onChange={(e) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], rating: Number(e.target.value) }; update("testimonials", ts); }} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                      {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
                    </select>
                  </div>
                </div>
                <Field label="Review" value={t.text} onChange={(v) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], text: v }; update("testimonials", ts); }} multiline />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeTab === "faq" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">FAQ ({data.faq?.length || 0})</h2>
            <button onClick={() => update("faq", [...(data.faq || []), { question: "", answer: "" }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          {(data.faq || []).map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                <button onClick={() => update("faq", (data.faq || []).filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <Field label="Question" value={item.question} onChange={(v) => { const f = [...(data.faq || [])]; f[i] = { ...f[i], question: v }; update("faq", f); }} />
              <div className="mt-3"><Field label="Answer" value={item.answer} onChange={(v) => { const f = [...(data.faq || [])]; f[i] = { ...f[i], answer: v }; update("faq", f); }} multiline /></div>
            </div>
          ))}
        </div>
      )}

      {/* Blog */}
      {activeTab === "blog" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Blog Posts ({data.blogPosts?.length || 0})</h2>
            <button onClick={() => update("blogPosts", [...(data.blogPosts || []), { id: `post-${Date.now()}`, title: "", excerpt: "", content: "", category: "", date: new Date().toISOString().split("T")[0], author: "", image: "" }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Post</button>
          </div>
          {(data.blogPosts || []).map((post, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                <ImagePicker label="" value={post.image} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], image: v }; update("blogPosts", p); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "blog")} compact />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Post {i + 1}</span>
                    <button onClick={() => update("blogPosts", (data.blogPosts || []).filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Title" value={post.title} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], title: v }; update("blogPosts", p); }} />
                    <Field label="Category" value={post.category} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], category: v }; update("blogPosts", p); }} />
                    <Field label="Author" value={post.author} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], author: v }; update("blogPosts", p); }} />
                    <Field label="Date" value={post.date} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], date: v }; update("blogPosts", p); }} />
                  </div>
                  <Field label="Excerpt" value={post.excerpt} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], excerpt: v }; update("blogPosts", p); }} />
                  <Field label="Content" value={post.content} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], content: v }; update("blogPosts", p); }} multiline />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery */}
      {activeTab === "gallery" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gallery Images ({data.galleryImages?.length || 0})</h2>
            <button onClick={() => openPicker((url) => update("galleryImages", [...(data.galleryImages || []), { src: url, alt: "", category: "" }]))} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Image</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(data.galleryImages || []).map((img, i) => (
              <div key={i} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                  {img.src ? (
                    <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="w-8 h-8" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openPicker((url) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], src: url }; update("galleryImages", g); })} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white"><ImageIcon className="w-4 h-4" /></button>
                    <button onClick={() => update("galleryImages", (data.galleryImages || []).filter((_, j) => j !== i))} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-red-500/50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <input type="text" value={img.alt || ""} onChange={(e) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], alt: e.target.value }; update("galleryImages", g); }} placeholder="Alt text" className="w-full mt-1 px-2 py-1 text-xs border border-border rounded bg-background" />
                <input type="text" value={img.category || ""} onChange={(e) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], category: e.target.value }; update("galleryImages", g); }} placeholder="Category" className="w-full mt-1 px-2 py-1 text-xs border border-border rounded bg-background" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domains */}
      {activeTab === "domains" && (
        <Section title="Custom Domains">
          <p className="text-sm text-muted-foreground mb-4">Your site is at: <code className="px-2 py-0.5 bg-muted rounded">flowsmartly.com/sites/{website.slug}</code></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a href="/domains" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center"><Globe className="w-8 h-8 text-primary mx-auto mb-2" /><p className="text-sm font-medium">Connect Domain</p><p className="text-xs text-muted-foreground mt-1">Point DNS to FlowSmartly</p></a>
            <a href="/domains" className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-center"><Globe className="w-8 h-8 text-primary mx-auto mb-2" /><p className="text-sm font-medium">Buy Domain</p><p className="text-xs text-muted-foreground mt-1">Search & purchase</p></a>
          </div>
        </Section>
      )}

      {/* Build */}
      {activeTab === "build" && (
        <Section title="Build Status">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Status:</span>
            {website.buildStatus === "built" ? <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Live</span>
             : website.buildStatus === "building" ? <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
             : website.buildStatus === "error" ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Error</span>
             : <span className="text-sm text-muted-foreground">Idle</span>}
          </div>
          {website.lastBuildAt && <p className="text-sm text-muted-foreground mb-4">Last: {new Date(website.lastBuildAt).toLocaleString()}</p>}
          {website.buildStatus === "error" && website.lastBuildError && <pre className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 text-xs rounded-lg overflow-auto max-h-60">{website.lastBuildError}</pre>}
        </Section>
      )}

      {/* Unsaved bar */}
      {changed && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Unsaved changes</p>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save & Rebuild
          </button>
        </div>
      )}

      {/* Media Library Picker */}
      {pickerOpen && (
        <MediaLibraryPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => { if (pickerCallback) pickerCallback(url); setPickerOpen(false); }}
          filterTypes={["image"]}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, multiline, span, icon }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; span?: number; icon?: React.ReactNode }) {
  return (
    <div className={span === 2 ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        {multiline ? (
          <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        ) : (
          <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={`w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary ${icon ? "pl-10" : ""}`} />
        )}
      </div>
    </div>
  );
}

function ImagePicker({ label, value, onChange, onBrowse, onUpload, compact, square }: {
  label?: string; value?: string; onChange: (url: string) => void;
  onBrowse: (cb: (url: string) => void) => void;
  onUpload: (file: File) => Promise<string>;
  compact?: boolean; square?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = await onUpload(file);
    if (path) onChange(path);
    setUploading(false);
  };

  const size = compact ? (square ? "w-24 h-24" : "w-32 h-24") : "w-full aspect-video";

  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}
      <div className={`relative group ${size} rounded-lg overflow-hidden border border-border bg-muted/30`}>
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={() => onBrowse(onChange)} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30"><ImageIcon className="w-4 h-4" /></button>
              <button onClick={() => fileRef.current?.click()} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30"><Upload className="w-4 h-4" /></button>
              <button onClick={() => onChange("")} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-red-500/50"><X className="w-4 h-4" /></button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer" onClick={() => onBrowse(onChange)}>
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ImageIcon className="w-5 h-5 text-muted-foreground/50" />}
            <span className="text-[10px] text-muted-foreground">{uploading ? "Uploading..." : "Add image"}</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}
