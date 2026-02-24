"use client";

import { useState, useRef, useCallback } from "react";
import {
  Eye,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ThemePicker } from "./theme-picker";

interface PreviewProduct {
  id: string;
  name: string;
  priceCents: number;
  status: string;
}

interface PreviewStepProps {
  storeSlug: string;
  templateId: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCta: string;
  products: PreviewProduct[];
  currency: string;
  onTemplateChange: (templateId: string) => void;
  onHeroChange: (field: "headline" | "subheadline" | "cta", value: string) => void;
  onSaveSettings: () => Promise<void>;
  onRemoveProduct: (productId: string) => void;
}

export function PreviewStep({
  storeSlug,
  templateId,
  heroHeadline,
  heroSubheadline,
  heroCta,
  products,
  currency,
  onTemplateChange,
  onHeroChange,
  onSaveSettings,
  onRemoveProduct,
}: PreviewStepProps) {
  const [iframeSrc, setIframeSrc] = useState(
    `/store/${storeSlug}?preview=true&t=${Date.now()}`
  );
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("theme");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refreshPreview = useCallback(() => {
    setIframeSrc(`/store/${storeSlug}?preview=true&t=${Date.now()}`);
  }, [storeSlug]);

  async function handleSaveAndRefresh() {
    setSaving(true);
    try {
      await onSaveSettings();
      refreshPreview();
    } finally {
      setSaving(false);
    }
  }

  async function handleTemplateChange(newTemplateId: string) {
    onTemplateChange(newTemplateId);
    // Save is triggered by the parent, which calls onSaveSettings
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  }

  function toggleSection(section: string) {
    setExpandedSection((prev) => (prev === section ? null : section));
  }

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Left Sidebar — Editor */}
      <div className="w-72 flex-shrink-0 overflow-y-auto space-y-3 pr-2">
        {/* Theme Section */}
        <CollapsibleSection
          title="Theme"
          isOpen={expandedSection === "theme"}
          onToggle={() => toggleSection("theme")}
        >
          <ThemePicker
            selectedTemplateId={templateId}
            onSelect={handleTemplateChange}
          />
        </CollapsibleSection>

        {/* Hero Section */}
        <CollapsibleSection
          title="Hero"
          isOpen={expandedSection === "hero"}
          onToggle={() => toggleSection("hero")}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Headline</label>
              <input
                type="text"
                value={heroHeadline}
                onChange={(e) => onHeroChange("headline", e.target.value)}
                className="mt-1 w-full px-2.5 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subheadline</label>
              <textarea
                value={heroSubheadline}
                onChange={(e) => onHeroChange("subheadline", e.target.value)}
                rows={2}
                className="mt-1 w-full px-2.5 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">CTA Text</label>
              <input
                type="text"
                value={heroCta}
                onChange={(e) => onHeroChange("cta", e.target.value)}
                className="mt-1 w-full px-2.5 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Products Section */}
        <CollapsibleSection
          title={`Products (${products.length})`}
          isOpen={expandedSection === "products"}
          onToggle={() => toggleSection("products")}
        >
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-2 rounded-lg border text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-muted-foreground">{formatPrice(product.priceCents)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveProduct(product.id)}
                  className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No products generated yet.
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* Save & Refresh */}
        <Button
          onClick={handleSaveAndRefresh}
          disabled={saving}
          className="w-full"
          size="sm"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              Saving...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Save & Refresh Preview
            </>
          )}
        </Button>

        {/* Open in new tab */}
        <a
          href={`/store/${storeSlug}?preview=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <ExternalLink className="h-3 w-3" />
          Open full preview
        </a>
      </div>

      {/* Right Panel — Iframe Preview */}
      <div className="flex-1 rounded-xl border bg-muted/30 overflow-hidden relative">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex items-center gap-1 px-3 py-1 rounded-md bg-background text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {storeSlug}.flowsmartly.com
          </div>
          <button
            type="button"
            onClick={refreshPreview}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full h-[calc(100%-36px)] border-0"
          title="Store Preview"
        />
      </div>
    </div>
  );
}

// ── Collapsible Section ──

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        {title}
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
