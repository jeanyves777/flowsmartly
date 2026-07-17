"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Check, Trash2, Plus, Sparkles, Wand2, Package, Tag, Coins, Boxes, Search as SeoIcon } from "lucide-react";
import { MediaUploader } from "@/components/shared/media-uploader";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * ProductEditor — the deep new-design product editor (a right-side drawer opened
 * from the Sell workspace). Exposes the FULL product model the API already
 * supports: multiple images (+ AI-generate), short + long description (+ AI copy),
 * category, tags, badges/labels, price / compare-at / cost (with live margin),
 * inventory + low-stock threshold, variants (name/SKU/price/qty), and SEO. Real
 * UI — Save POST/PATCHes /api/ecommerce/products; Delete is a two-step confirm.
 * No chat prompt, no legacy. [[surface-buttons-are-ui-actions]]
 */

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const LABEL = "mb-1 block text-[11px] font-medium text-muted-foreground";

// Product badges — mirrors the API's labels enum exactly.
const BADGES: { id: string; label: string; dot: string }[] = [
  { id: "new", label: "New", dot: "bg-emerald-500" },
  { id: "sale", label: "Sale", dot: "bg-rose-500" },
  { id: "bestseller", label: "Bestseller", dot: "bg-violet-500" },
  { id: "featured", label: "Featured", dot: "bg-amber-500" },
  { id: "limited", label: "Limited", dot: "bg-teal-500" },
  { id: "discount", label: "Discount", dot: "bg-brand-500" },
];

interface ProductImage { url: string; alt?: string; position?: number }
interface Variant { id?: string; name: string; sku?: string; priceCents?: number; comparePriceCents?: number; options?: Record<string, string>; quantity?: number; imageUrl?: string; isActive?: boolean }

interface FullProduct {
  id: string; name: string; description?: string | null; shortDescription?: string | null;
  category?: string | null; tags?: string[]; labels?: string[];
  priceCents?: number; comparePriceCents?: number | null; costCents?: number | null;
  images?: ProductImage[]; trackInventory?: boolean; quantity?: number; lowStockThreshold?: number;
  status?: string; seoTitle?: string | null; seoDescription?: string | null; variants?: Variant[];
}

const dollars = (cents?: number | null): string => (cents != null ? String((cents / 100)) : "");
const toCents = (v: string): number | undefined => { const n = Number(v); return Number.isFinite(n) && v.trim() !== "" ? Math.round(n * 100) : undefined; };

export function ProductEditor({ productId, currency, categoryOptions, onClose, onSaved }: {
  productId: "new" | string;
  currency: string;
  categoryOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = productId !== "new";
  const [loading, setLoading] = useState(isEdit);
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT" | "ARCHIVED">("ACTIVE");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [cost, setCost] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [trackInventory, setTrackInventory] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiCopyBusy, setAiCopyBusy] = useState(false);
  const [aiImgBusy, setAiImgBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { const t = setTimeout(() => setMounted(true), 10); return () => clearTimeout(t); }, []);

  // Load the full product when editing.
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/ecommerce/products/${productId}`);
        const j = await r.json().catch(() => null);
        const p: FullProduct | undefined = j?.data;
        if (!alive || !p) return;
        setName(p.name ?? "");
        setShortDescription(p.shortDescription ?? "");
        setDescription(p.description ?? "");
        setCategory(p.category ?? "");
        setTags(Array.isArray(p.tags) ? p.tags.join(", ") : "");
        setLabels(Array.isArray(p.labels) ? p.labels : []);
        setStatus((p.status?.toUpperCase() as "ACTIVE" | "DRAFT" | "ARCHIVED") || "ACTIVE");
        setPrice(dollars(p.priceCents));
        setComparePrice(dollars(p.comparePriceCents));
        setCost(dollars(p.costCents));
        setImages(Array.isArray(p.images) ? p.images.map((i) => i.url).filter(Boolean) : []);
        setTrackInventory(!!p.trackInventory);
        setQuantity(p.quantity != null ? String(p.quantity) : "");
        setLowStockThreshold(p.lowStockThreshold != null ? String(p.lowStockThreshold) : "5");
        setSeoTitle(p.seoTitle ?? "");
        setSeoDescription(p.seoDescription ?? "");
        setVariants(Array.isArray(p.variants) ? p.variants : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isEdit, productId]);

  const toggleLabel = (id: string) => setLabels((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const priceCents = toCents(price);
  const costCents = toCents(cost);
  const margin = priceCents && costCents != null && priceCents > 0
    ? { pct: Math.round(((priceCents - costCents) / priceCents) * 100), profit: (priceCents - costCents) / 100 }
    : null;

  // AI: write copy from the product name + category.
  const writeCopy = async () => {
    if (!name.trim()) { setError("Add a product name first — AI writes from it."); return; }
    setAiCopyBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/ecommerce/ai/product-copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: name.trim(), category: category || undefined, existingDescription: description || undefined }),
      });
      const j = await r.json().catch(() => null);
      const d = j?.data;
      if (r.ok && d) {
        if (d.description) setDescription(d.description);
        if (d.shortDescription) setShortDescription(d.shortDescription);
        if (d.seoTitle) setSeoTitle(d.seoTitle);
        if (d.seoDescription) setSeoDescription(d.seoDescription);
        setNotice(`Copy written${d.creditsUsed ? ` · ${d.creditsUsed} credits` : ""}.`);
      } else setError(j?.error?.message || "Couldn't write the copy.");
    } catch { setError("Couldn't write the copy."); }
    finally { setAiCopyBusy(false); }
  };

  // AI: generate a product image and add it to the gallery.
  const generateImage = async () => {
    if (!name.trim()) { setError("Add a product name first — AI generates from it."); return; }
    setAiImgBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/ecommerce/ai/product-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: name.trim(), description: description || undefined, style: "studio" }),
      });
      const j = await r.json().catch(() => null);
      const url = j?.data?.imageUrl;
      if (r.ok && url) { setImages((im) => [...im, url].slice(0, 10)); setNotice("Image added."); }
      else setError(j?.error?.message || "Couldn't generate the image.");
    } catch { setError("Couldn't generate the image."); }
    finally { setAiImgBusy(false); }
  };

  const setVariant = (i: number, patch: Partial<Variant>) => setVariants((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addVariant = () => setVariants((v) => [...v, { name: "", priceCents: priceCents, quantity: 0, options: {}, isActive: true }]);
  const removeVariant = (i: number) => setVariants((v) => v.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) { setError("Give the product a name."); return; }
    if (priceCents == null || priceCents <= 0) { setError("Set a price greater than 0."); return; }
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        shortDescription: shortDescription.trim() || undefined,
        category: category.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        labels,
        priceCents,
        comparePriceCents: toCents(comparePrice),
        costCents: toCents(cost),
        images: images.map((url, position) => ({ url, alt: name.trim(), position })),
        trackInventory,
        status,
        seoTitle: seoTitle.trim() || undefined,
        seoDescription: seoDescription.trim() || undefined,
        variants: variants
          .filter((v) => v.name.trim())
          .map((v) => ({
            ...(v.id ? { id: v.id } : {}),
            name: v.name.trim(),
            sku: v.sku?.trim() || undefined,
            priceCents: v.priceCents ?? priceCents,
            comparePriceCents: v.comparePriceCents ?? undefined,
            options: v.options ?? {},
            quantity: v.quantity ?? 0,
            imageUrl: v.imageUrl || undefined,
            isActive: v.isActive !== false,
          })),
      };
      if (trackInventory) {
        body.quantity = Number(quantity) || 0;
        body.lowStockThreshold = Number(lowStockThreshold) || 5;
      }
      const r = await fetch(isEdit ? `/api/ecommerce/products/${productId}` : "/api/ecommerce/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { onSaved(); onClose(); }
      else setError(j?.error?.message || "Couldn't save the product.");
    } catch { setError("Couldn't save the product."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    setDeleting(true); setError("");
    try {
      const r = await fetch(`/api/ecommerce/products/${productId}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { onSaved(); onClose(); }
      else setError(j?.error?.message || "Couldn't delete the product.");
    } catch { setError("Couldn't delete the product."); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <div className={cn("fixed inset-0 z-[60] bg-black/50 transition-opacity", mounted ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside className={cn("fixed inset-y-0 right-0 z-[61] flex w-[min(720px,96vw)] flex-col border-l border-border bg-background transition-transform duration-200", mounted ? "translate-x-0" : "translate-x-full")}>
        {/* header */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <h3 className="text-[14.5px] font-bold">{isEdit ? "Edit product" : "New product"}</h3>
          <button onClick={onClose} className="ms-auto grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center"><FlowLoader size={26} label="Loading product…" /></div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {/* Media */}
              <Section icon={Package} title="Media" tag="multi-image">
                <MediaUploader value={images} onChange={setImages} multiple maxFiles={10} variant="gallery" placeholder="Product images" showButtons />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button onClick={generateImage} disabled={aiImgBusy} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{aiImgBusy ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5 text-brand-500" />} Generate image (AI)</button>
                </div>
              </Section>

              {/* Basics */}
              <Section icon={Wand2} title="Basics">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block"><span className={LABEL}>Name *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ethiopia Guji" className={FIELD} /></label>
                  <label className="block"><span className={LABEL}>Status</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={FIELD}>
                      <option value="ACTIVE">Active (listed)</option>
                      <option value="DRAFT">Draft</option>
                      {isEdit && <option value="ARCHIVED">Archived</option>}
                    </select>
                  </label>
                </div>
                <label className="mt-2.5 block"><span className={LABEL}>Short description <Hint>one line, max 160</Hint></span><input value={shortDescription} maxLength={160} onChange={(e) => setShortDescription(e.target.value)} placeholder="Bright, floral, washed single-origin" className={FIELD} /></label>
                <label className="mt-2.5 block"><span className={LABEL}>Description</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it is, who it's for, why it's great." className={cn(FIELD, "resize-y")} /></label>
                <button onClick={writeCopy} disabled={aiCopyBusy} className="mt-2 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{aiCopyBusy ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5 text-brand-500" />} Write copy with AI</button>
              </Section>

              {/* Organization */}
              <Section icon={Tag} title="Organization">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block"><span className={LABEL}>Category</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
                      <option value="">None</option>
                      {categoryOptions.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </label>
                  <label className="block"><span className={LABEL}>Tags <Hint>comma-separated</Hint></span><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ethiopia, washed, floral" className={FIELD} /></label>
                </div>
                <div className="mt-2.5"><span className={LABEL}>Badges</span>
                  <div className="flex flex-wrap gap-2">
                    {BADGES.map((b) => {
                      const on = labels.includes(b.id);
                      return (
                        <button key={b.id} onClick={() => toggleLabel(b.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold", on ? "border-transparent bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/60")}>
                          <span className={cn("h-2 w-2 rounded-full", b.dot)} />{b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              {/* Pricing */}
              <Section icon={Coins} title="Pricing">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <MoneyField label="Price *" currency={currency} value={price} onChange={setPrice} />
                  <MoneyField label="Compare-at" currency={currency} value={comparePrice} onChange={setComparePrice} hint="was price" />
                  <MoneyField label="Cost" currency={currency} value={cost} onChange={setCost} hint="for margin" />
                </div>
                {margin && <p className="mt-2 text-[12px] font-semibold text-emerald-500">Margin {margin.pct}% · {margin.profit.toLocaleString(undefined, { style: "currency", currency })} profit / unit</p>}
              </Section>

              {/* Inventory */}
              <Section icon={Boxes} title="Inventory" right={<Toggle on={trackInventory} onClick={() => setTrackInventory((t) => !t)} />}>
                {trackInventory ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="block"><span className={LABEL}>Quantity in stock</span><input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" placeholder="0" className={FIELD} /></label>
                    <label className="block"><span className={LABEL}>Low-stock alert at</span><input value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} inputMode="numeric" placeholder="5" className={FIELD} /></label>
                  </div>
                ) : <p className="text-[12px] text-muted-foreground">Inventory tracking is off — this product never shows as out of stock.</p>}
              </Section>

              {/* Variants */}
              <Section icon={Boxes} title="Variants" tag="size / color / options" right={<button onClick={addVariant} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60"><Plus className="h-3.5 w-3.5" /> Add</button>}>
                {variants.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No variants — the base price and stock apply. Add variants for sizes, weights, or colors.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                      <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-1.5 py-1 text-left font-bold">Variant</th><th className="px-1.5 py-1 text-left font-bold">SKU</th><th className="px-1.5 py-1 text-left font-bold">Price</th><th className="px-1.5 py-1 text-left font-bold">Qty</th><th></th>
                      </tr></thead>
                      <tbody>
                        {variants.map((v, i) => (
                          <tr key={v.id || i} className="border-t border-border">
                            <td className="px-1.5 py-1.5"><input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="250g" className={cn(FIELD, "px-2 py-1.5")} /></td>
                            <td className="px-1.5 py-1.5"><input value={v.sku || ""} onChange={(e) => setVariant(i, { sku: e.target.value })} placeholder="SKU" className={cn(FIELD, "px-2 py-1.5")} /></td>
                            <td className="px-1.5 py-1.5"><input value={dollars(v.priceCents)} onChange={(e) => setVariant(i, { priceCents: toCents(e.target.value) })} inputMode="decimal" placeholder="0" className={cn(FIELD, "w-20 px-2 py-1.5")} /></td>
                            <td className="px-1.5 py-1.5"><input value={v.quantity != null ? String(v.quantity) : ""} onChange={(e) => setVariant(i, { quantity: Number(e.target.value) || 0 })} inputMode="numeric" placeholder="0" className={cn(FIELD, "w-16 px-2 py-1.5")} /></td>
                            <td className="px-1.5 py-1.5"><button onClick={() => removeVariant(i)} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* SEO */}
              <Section icon={SeoIcon} title="SEO">
                <label className="block"><span className={LABEL}>SEO title</span><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Ethiopia Guji — Single-Origin Coffee" className={FIELD} /></label>
                <label className="mt-2.5 block"><span className={LABEL}>SEO description</span><textarea rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Bright, floral washed Ethiopian coffee, roasted to order." className={cn(FIELD, "resize-y")} /></label>
              </Section>

              {error && <p className="text-[12px] text-rose-500">{error}</p>}
              {notice && <p className="text-[12px] text-emerald-500">{notice}</p>}
            </div>

            {/* footer */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3.5">
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={14} tone="white" /> : <Check className="h-4 w-4" />} {isEdit ? "Save product" : "Add product"}</button>
              <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
              {isEdit && (confirmDelete ? (
                <div className="ms-auto inline-flex items-center gap-2 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-2.5 py-1.5">
                  <span className="text-[11.5px] font-semibold text-rose-500">Delete this product?</span>
                  <button onClick={remove} disabled={deleting} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">{deleting ? <FlowLoader size={12} tone="white" /> : <Trash2 className="h-3 w-3" />} Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Keep</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 px-3 py-2 text-[12.5px] font-semibold text-rose-500 hover:bg-rose-500/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* ── small building blocks ────────────────────────────────────────────── */

function Section({ icon: Icon, title, tag, right, children }: { icon: React.ElementType; title: string; tag?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-[12.5px] font-bold">{title}</h4>
        {tag && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-500">{tag}</span>}
        {right && <div className="ms-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted-foreground/70">· {children}</span>;
}

function MoneyField({ label, currency, value, onChange, hint }: { label: string; currency: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}{hint && <Hint>{hint}</Hint>}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">{currency}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="0.00" className={cn(FIELD, "pl-11")} />
      </div>
    </label>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative h-[22px] w-[38px] rounded-full transition-colors", on ? "bg-brand-500" : "bg-muted")}>
      <span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
