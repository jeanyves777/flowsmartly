"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Images, Loader2, Search, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProposalVisualKind = "cover" | "about" | "impact" | "general";
type ProposalPreset = "any" | "google-business-profile" | "website-redesign" | "local-seo" | "custom";

interface ProposalVisualAsset {
  id: string;
  title: string;
  url: string;
  kind: ProposalVisualKind;
  preset: ProposalPreset;
  tags: string[];
  source: "default" | "admin-upload" | "admin-generated";
  prompt?: string;
  width?: number;
  height?: number;
  createdAt?: string;
}

const presets: Array<{ value: ProposalPreset; label: string }> = [
  { value: "any", label: "Any proposal" },
  { value: "google-business-profile", label: "Google Business Profile" },
  { value: "website-redesign", label: "Website redesign" },
  { value: "local-seo", label: "Local SEO" },
  { value: "custom", label: "Custom" },
];

const kinds: Array<{ value: ProposalVisualKind; label: string }> = [
  { value: "cover", label: "Cover" },
  { value: "about", label: "About" },
  { value: "impact", label: "Impact" },
  { value: "general", label: "General" },
];

function sourceLabel(source: ProposalVisualAsset["source"]) {
  if (source === "admin-generated") return "Generated";
  if (source === "admin-upload") return "Uploaded";
  return "Default";
}

export default function AdminProposalVisualsPage() {
  const [assets, setAssets] = useState<ProposalVisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPreset, setFilterPreset] = useState("all");
  const [filterKind, setFilterKind] = useState("all");
  const [message, setMessage] = useState<string | null>(null);

  const [uploadForm, setUploadForm] = useState({
    title: "",
    preset: "any" as ProposalPreset,
    kind: "general" as ProposalVisualKind,
    tags: "",
    file: null as File | null,
  });
  const [generateForm, setGenerateForm] = useState({
    title: "",
    preset: "any" as ProposalPreset,
    kind: "general" as ProposalVisualKind,
    tags: "",
    prompt: "",
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filterPreset !== "all") params.set("preset", filterPreset);
    if (filterKind !== "all") params.set("kind", filterKind);
    return params.toString();
  }, [filterKind, filterPreset, search]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/proposal-visual-assets?${query}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to load proposal visuals");
      setAssets(json.data.assets || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load proposal visuals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const uploadAsset = async () => {
    if (!uploadForm.file) {
      setMessage("Choose a PNG, JPG, JPEG, or WebP image first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("title", uploadForm.title || uploadForm.file.name);
      formData.append("preset", uploadForm.preset);
      formData.append("kind", uploadForm.kind);
      formData.append("tags", uploadForm.tags);
      const res = await fetch("/api/admin/proposal-visual-assets", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Upload failed");
      setAssets(json.data.assets || []);
      setUploadForm({ title: "", preset: "any", kind: "general", tags: "", file: null });
      setMessage("Proposal visual uploaded and made available.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const generateAsset = async () => {
    if (!generateForm.prompt.trim()) {
      setMessage("Add a prompt for the generated cutout.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/proposal-visual-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", ...generateForm }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Generation failed");
      setAssets(json.data.assets || []);
      setGenerateForm({ title: "", preset: "any", kind: "general", tags: "", prompt: "" });
      setMessage("xAI cutout generated, cleaned, and added to the proposal library.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Images className="h-6 w-6" />
            Proposal Visual Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable transparent cutouts selected automatically by proposal type and tags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tags or title"
              className="w-64 pl-9"
            />
          </div>
          <select
            value={filterPreset}
            onChange={(event) => setFilterPreset(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All presets</option>
            {presets.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
          <select
            value={filterKind}
            onChange={(event) => setFilterKind(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All slots</option>
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>{kind.label}</option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{message}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Upload Cutout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={uploadForm.title}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Visual title"
              />
              <Input
                value={uploadForm.tags}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Tags: google, listing, reviews"
              />
              <select
                value={uploadForm.preset}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, preset: event.target.value as ProposalPreset }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {presets.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
              <select
                value={uploadForm.kind}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, kind: event.target.value as ProposalVisualKind }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {kinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>{kind.label}</option>
                ))}
              </select>
            </div>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
            />
            <Button onClick={uploadAsset} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Add to Library
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Generate Cutout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={generateForm.title}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Visual title"
              />
              <Input
                value={generateForm.tags}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Tags: analytics, growth"
              />
              <select
                value={generateForm.preset}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, preset: event.target.value as ProposalPreset }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {presets.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
              <select
                value={generateForm.kind}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, kind: event.target.value as ProposalVisualKind }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {kinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>{kind.label}</option>
                ))}
              </select>
            </div>
            <textarea
              value={generateForm.prompt}
              onChange={(event) => setGenerateForm((prev) => ({ ...prev, prompt: event.target.value }))}
              placeholder="Prompt for a clean transparent proposal cutout..."
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={generateAsset} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate with xAI
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="h-72 animate-pulse bg-muted/40" />
          ))
        ) : (
          assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="flex h-48 items-center justify-center bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-3">
                <img src={asset.url} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <h2 className="line-clamp-1 text-sm font-semibold">{asset.title}</h2>
                  <p className="text-xs text-muted-foreground">{asset.width || "-"} x {asset.height || "-"} px</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{sourceLabel(asset.source)}</Badge>
                  <Badge variant="outline">{asset.kind}</Badge>
                  <Badge variant="outline">{asset.preset}</Badge>
                </div>
                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
