"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Package,
  Plus,
  Trash2,
  Image as ImageIcon,
  Tag,
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowLeft,
  X,
  Sparkles,
  Wand2,
  Scissors,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface ImageItem {
  url: string;
  alt: string;
  position: number;
  file?: File;
  preview?: string;
}

interface VariantRow {
  id?: string;
  tempId: string;
  name: string;
  sku: string;
  priceCents: number;
  comparePriceCents: number | null;
  options: Record<string, string>;
  quantity: number;
  imageUrl: string;
  isActive: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
  children: CategoryOption[];
}

// ── Helpers ──

function centsFromDollars(val: string): number {
  const num = parseFloat(val);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

let tempIdCounter = 0;
function nextTempId(): string {
  return `temp_${++tempIdCounter}`;
}

// ── Component ──

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);

  // ── Form State ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [comparePriceStr, setComparePriceStr] = useState("");
  const [costPriceStr, setCostPriceStr] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [trackInventory, setTrackInventory] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [categoryId, setCategoryId] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "ARCHIVED">("DRAFT");
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // AI Copy Generation
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiKeywords, setAiKeywords] = useState("");
  const [showAiKeywords, setShowAiKeywords] = useState(false);

  // AI Image Generation
  const [showAiImageModal, setShowAiImageModal] = useState(false);
  const [aiImageStyle, setAiImageStyle] = useState<"lifestyle" | "studio" | "flat_lay">("studio");
  const [aiImageDescription, setAiImageDescription] = useState("");
  const [aiImageGenerating, setAiImageGenerating] = useState(false);
  const [removingBgIndex, setRemovingBgIndex] = useState<number | null>(null);

  // Categories
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Drag state
  const [dragOver, setDragOver] = useState(false);

  // ── Load Data ──

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/ecommerce/products/${id}`);
      const json = await res.json();
      if (!json.success) {
        toast({ title: json.error?.message || "Product not found", variant: "destructive" });
        router.push("/ecommerce/products");
        return;
      }

      const p = json.data;
      setName(p.name);
      setDescription(p.description || "");
      setShortDescription(p.shortDescription || "");
      setPriceStr(dollarsFromCents(p.priceCents));
      setComparePriceStr(p.comparePriceCents ? dollarsFromCents(p.comparePriceCents) : "");
      setCostPriceStr(p.costCents ? dollarsFromCents(p.costCents) : "");
      setImages((p.images || []).map((img: ImageItem) => ({ ...img, file: undefined, preview: undefined })));
      setTrackInventory(p.trackInventory);
      setQuantity(p.quantity);
      setLowStockThreshold(p.lowStockThreshold);
      setCategoryId(p.categoryId || "");
      setSeoTitle(p.seoTitle || "");
      setSeoDescription(p.seoDescription || "");
      setStatus(p.status);

      if (p.variants && p.variants.length > 0) {
        setHasVariants(true);
        setVariants(
          p.variants.map((v: VariantRow & { id: string }) => ({
            id: v.id,
            tempId: nextTempId(),
            name: v.name,
            sku: v.sku || "",
            priceCents: v.priceCents,
            comparePriceCents: v.comparePriceCents,
            options: v.options || {},
            quantity: v.quantity,
            imageUrl: v.imageUrl || "",
            isActive: v.isActive !== false,
          }))
        );
      }
    } catch {
      toast({ title: "Failed to load product", variant: "destructive" });
      router.push("/ecommerce/products");
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data.categories);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchProduct();
    fetchCategories();
  }, [fetchProduct, fetchCategories]);

  // Flatten categories for select
  const flatCategories: { id: string; name: string; depth: number }[] = [];
  function flattenCats(cats: CategoryOption[], depth = 0) {
    for (const cat of cats) {
      flatCategories.push({ id: cat.id, name: cat.name, depth });
      if (cat.children) flattenCats(cat.children, depth + 1);
    }
  }
  flattenCats(categories);

  // ── Image Handling ──

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => {
      if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(f.type)) {
        toast({ title: `Invalid file type: ${f.name}`, variant: "destructive" });
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast({ title: `File too large: ${f.name} (max 5MB)`, variant: "destructive" });
        return false;
      }
      return true;
    });

    if (images.length + validFiles.length > 10) {
      toast({ title: "Maximum 10 images per product", variant: "destructive" });
      return;
    }

    const newImages: ImageItem[] = validFiles.map((file, i) => ({
      url: "",
      alt: file.name.replace(/\.[^/.]+$/, ""),
      position: images.length + i,
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
      updated.splice(index, 1);
      return updated.map((img, i) => ({ ...img, position: i }));
    });
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    setImages((prev) => {
      const updated = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= updated.length) return prev;
      [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
      return updated.map((img, i) => ({ ...img, position: i }));
    });
  };

  // ── Variant Handling ──

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        tempId: nextTempId(),
        name: "",
        sku: "",
        priceCents: centsFromDollars(priceStr),
        comparePriceCents: null,
        options: {},
        quantity: 0,
        imageUrl: "",
        isActive: true,
      },
    ]);
  };

  const updateVariant = (tempId: string, field: string, value: unknown) => {
    setVariants((prev) =>
      prev.map((v) => (v.tempId === tempId ? { ...v, [field]: value } : v))
    );
  };

  const removeVariant = (tempId: string) => {
    setVariants((prev) => prev.filter((v) => v.tempId !== tempId));
  };

  // ── Upload new images ──

  const uploadNewImages = async (): Promise<void> => {
    const filesToUpload = images.filter((img) => img.file);
    if (filesToUpload.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      for (const img of filesToUpload) {
        formData.append("images", img.file!);
      }
      const res = await fetch(`/api/ecommerce/products/${id}/images`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        // Replace images with server response
        setImages(json.data.images.map((img: ImageItem) => ({ ...img, file: undefined, preview: undefined })));
      }
    } catch (err) {
      console.error("Image upload error:", err);
    } finally {
      setUploadingImages(false);
    }
  };

  // ── AI Generation ──

  const handleAIGenerate = async () => {
    if (!name || name.trim().length < 2) return;
    setAiGenerating(true);
    try {
      const keywords = aiKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/ecommerce/ai/product-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: name.trim(),
          keywords: keywords.length > 0 ? keywords : undefined,
          existingDescription: description || undefined,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        toast({ title: json.error?.message || "Failed to generate copy", variant: "destructive" });
        return;
      }

      const data = json.data;
      // Don't overwrite name on edit page since it already exists
      setDescription(data.description || "");
      setShortDescription((data.shortDescription || "").slice(0, 160));
      setSeoTitle(data.seoTitle || "");
      setSeoDescription((data.seoDescription || "").slice(0, 160));
      setShowAiKeywords(false);
      toast({ title: `Product copy generated! (${data.creditsUsed} credits used)` });
    } catch {
      toast({ title: "Failed to generate product copy", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  // ── AI Image Generation ──

  const handleAIImageGenerate = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast({ title: "Enter a product name first", variant: "destructive" });
      return;
    }
    if (images.length >= 10) {
      toast({ title: "Maximum 10 images per product", variant: "destructive" });
      return;
    }

    setAiImageGenerating(true);
    try {
      const res = await fetch("/api/ecommerce/ai/product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: name.trim(),
          description: aiImageDescription || undefined,
          style: aiImageStyle,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        toast({ title: json.error?.message || "Failed to generate image", variant: "destructive" });
        return;
      }

      setImages((prev) => [
        ...prev,
        {
          url: json.data.imageUrl,
          alt: `${name.trim()} - AI generated (${aiImageStyle})`,
          position: prev.length,
        },
      ]);
      setShowAiImageModal(false);
      setAiImageDescription("");
      toast({ title: "AI product image generated! (15 credits)" });
    } catch {
      toast({ title: "Failed to generate product image", variant: "destructive" });
    } finally {
      setAiImageGenerating(false);
    }
  };

  const handleRemoveBackground = async (index: number) => {
    const img = images[index];
    if (!img) return;

    if (!img.url && !img.file) {
      toast({ title: "Image must be uploaded first", variant: "destructive" });
      return;
    }

    setRemovingBgIndex(index);
    try {
      const formData = new FormData();

      if (img.file) {
        formData.append("image", img.file);
      } else if (img.url) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        formData.append("image", blob, "image.png");
      }

      const res = await fetch("/api/ecommerce/ai/product-image/enhance", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!json.success) {
        toast({ title: json.error?.message || "Failed to remove background", variant: "destructive" });
        return;
      }

      setImages((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, url: json.data.imageUrl, preview: undefined, file: undefined, alt: item.alt + " (bg removed)" }
            : item
        )
      );
      toast({ title: "Background removed! (15 credits)" });
    } catch {
      toast({ title: "Failed to remove background", variant: "destructive" });
    } finally {
      setRemovingBgIndex(null);
    }
  };

  // ── Save ──

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (name.trim().length < 2) {
      toast({ title: "Product name must be at least 2 characters", variant: "destructive" });
      return;
    }
    const priceCents = centsFromDollars(priceStr);
    if (priceCents <= 0) {
      toast({ title: "Price must be greater than zero", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upload new images first
      const hasNewFiles = images.some((img) => img.file);
      if (hasNewFiles) {
        await uploadNewImages();
      }

      const comparePriceCents = comparePriceStr ? centsFromDollars(comparePriceStr) : null;
      const costCents = costPriceStr ? centsFromDollars(costPriceStr) : null;

      // Build images array for existing (already uploaded) images only
      const existingImages = images
        .filter((img) => !img.file && img.url)
        .map((img) => ({ url: img.url, alt: img.alt, position: img.position }));

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description || null,
        shortDescription: shortDescription || null,
        priceCents,
        comparePriceCents,
        costCents,
        images: existingImages,
        trackInventory,
        quantity: trackInventory ? quantity : 0,
        lowStockThreshold: trackInventory ? lowStockThreshold : 5,
        categoryId: categoryId || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        status,
      };

      if (hasVariants) {
        payload.variants = variants.map((v) => ({
          id: v.id || undefined,
          name: v.name,
          sku: v.sku || undefined,
          priceCents: v.priceCents,
          comparePriceCents: v.comparePriceCents || undefined,
          options: Object.keys(v.options).length > 0 ? v.options : undefined,
          quantity: v.quantity,
          imageUrl: v.imageUrl || undefined,
          isActive: v.isActive,
        }));
      } else {
        payload.variants = [];
      }

      const res = await fetch(`/api/ecommerce/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.success) {
        toast({ title: json.error?.message || "Failed to update product", variant: "destructive" });
        return;
      }

      toast({ title: "Product updated successfully!" });
      router.push("/ecommerce/products");
    } catch {
      toast({ title: "Failed to update product", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/ecommerce/products/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Product deleted" });
        router.push("/ecommerce/products");
      } else {
        toast({ title: json.error?.message || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete product", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading product...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/ecommerce/products")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-sm text-gray-500 mt-0.5">Update your product details</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Product
        </button>
      </div>

      {/* Section 1: Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-500" />
            Basic Info
          </h2>
          {name.trim().length >= 2 && (
            <button
              onClick={() => showAiKeywords ? handleAIGenerate() : setShowAiKeywords(true)}
              disabled={aiGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
            >
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiGenerating ? "Generating..." : "AI Generate"}
            </button>
          )}
        </div>

        {showAiKeywords && !aiGenerating && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <input
              type="text"
              value={aiKeywords}
              onChange={(e) => setAiKeywords(e.target.value)}
              placeholder="Optional keywords (comma-separated, e.g. organic, premium, eco-friendly)"
              className="flex-1 px-3 py-1.5 text-sm border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              onKeyDown={(e) => { if (e.key === "Enter") handleAIGenerate(); }}
            />
            <button
              onClick={handleAIGenerate}
              className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              Generate
            </button>
            <button
              onClick={() => setShowAiKeywords(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short Description
            <span className="text-gray-400 font-normal ml-1">({shortDescription.length}/160)</span>
          </label>
          <textarea
            value={shortDescription}
            onChange={(e) => {
              if (e.target.value.length <= 160) setShortDescription(e.target.value);
            }}
            rows={2}
            maxLength={160}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          />
        </div>
      </div>

      {/* Section 2: Pricing */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Tag className="w-5 h-5 text-gray-500" />
          Pricing
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compare at Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={comparePriceStr}
              onChange={(e) => setComparePriceStr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costPriceStr}
              onChange={(e) => setCostPriceStr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Images */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-gray-500" />
          Images
          <span className="text-sm text-gray-400 font-normal">({images.length}/10)</span>
        </h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Drag and drop images here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPEG, WebP up to 5MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
            className="hidden"
          />
        </div>

        {/* AI Image Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiImageModal(true)}
            disabled={aiImageGenerating || images.length >= 10}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
          >
            {aiImageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI Generate Image
          </button>
          <span className="text-xs text-gray-400">15 credits per image</span>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={img.preview || img.url}
                  alt={img.alt}
                  className="w-full h-32 object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                    Main
                  </span>
                )}
                <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveImage(i, "up")}
                    disabled={i === 0}
                    className="p-1 bg-white/90 rounded shadow hover:bg-white disabled:opacity-40"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveImage(i, "down")}
                    disabled={i === images.length - 1}
                    className="p-1 bg-white/90 rounded shadow hover:bg-white disabled:opacity-40"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleRemoveBackground(i)}
                    disabled={removingBgIndex !== null}
                    title="Remove background"
                    className="p-1 bg-purple-500/90 text-white rounded shadow hover:bg-purple-600 disabled:opacity-40"
                  >
                    {removingBgIndex === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => removeImage(i)}
                    className="p-1 bg-red-500/90 text-white rounded shadow hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Image Generation Modal */}
      {showAiImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                AI Generate Product Image
              </h3>
              <button
                onClick={() => setShowAiImageModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Generate a professional product photo for <span className="font-medium text-gray-700">{name || "your product"}</span>
            </p>

            {/* Style Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo Style</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "lifestyle" as const, label: "Lifestyle", desc: "Real-life context" },
                  { value: "studio" as const, label: "Studio", desc: "White background" },
                  { value: "flat_lay" as const, label: "Flat Lay", desc: "Top-down view" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAiImageStyle(opt.value)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      aiImageStyle === opt.value
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={aiImageDescription}
                onChange={(e) => setAiImageDescription(e.target.value)}
                placeholder="e.g. Rustic wooden table setting, autumn colors, cozy atmosphere..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-y"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">15 credits</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAiImageModal(false)}
                  disabled={aiImageGenerating}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIImageGenerate}
                  disabled={aiImageGenerating || !name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {aiImageGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {aiImageGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Variants */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">This product has variants</span>
            <button
              type="button"
              role="switch"
              aria-checked={hasVariants}
              onClick={() => setHasVariants(!hasVariants)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hasVariants ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hasVariants ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        {hasVariants && (
          <div className="space-y-3">
            {variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-2 font-medium text-gray-600">Name</th>
                      <th className="text-left pb-2 font-medium text-gray-600">SKU</th>
                      <th className="text-left pb-2 font-medium text-gray-600">Price ($)</th>
                      <th className="text-left pb-2 font-medium text-gray-600">Quantity</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.map((v) => (
                      <tr key={v.tempId}>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={v.name}
                            onChange={(e) => updateVariant(v.tempId, "name", e.target.value)}
                            placeholder="e.g. Large / Red"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => updateVariant(v.tempId, "sku", e.target.value)}
                            placeholder="SKU"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={dollarsFromCents(v.priceCents)}
                            onChange={(e) => updateVariant(v.tempId, "priceCents", centsFromDollars(e.target.value))}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            value={v.quantity}
                            onChange={(e) => updateVariant(v.tempId, "quantity", parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => removeVariant(v.tempId)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={addVariant}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>
        )}
      </div>

      {/* Section 5: Inventory */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Inventory</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Track inventory</span>
            <button
              type="button"
              role="switch"
              aria-checked={trackInventory}
              onClick={() => setTrackInventory(!trackInventory)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                trackInventory ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  trackInventory ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        {trackInventory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 6: Category */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-gray-500" />
          Category
        </h2>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">No category</option>
          {flatCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {"  ".repeat(cat.depth)}{cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Section 7: SEO */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">SEO</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SEO Title
            <span className="text-gray-400 font-normal ml-1">({seoTitle.length}/70)</span>
          </label>
          <input
            type="text"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            maxLength={70}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SEO Description
            <span className="text-gray-400 font-normal ml-1">({seoDescription.length}/160)</span>
          </label>
          <textarea
            value={seoDescription}
            onChange={(e) => {
              if (e.target.value.length <= 160) setSeoDescription(e.target.value);
            }}
            rows={2}
            maxLength={160}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          />
        </div>
      </div>

      {/* Section 8: Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Status</h2>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={status === "DRAFT"}
              onChange={() => setStatus("DRAFT")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Draft</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={status === "ACTIVE"}
              onChange={() => setStatus("ACTIVE")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={status === "ARCHIVED"}
              onChange={() => setStatus("ARCHIVED")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Archived</span>
          </label>
        </div>
      </div>

      {/* Save & Cancel */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          onClick={() => router.push("/ecommerce/products")}
          className="px-6 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || uploadingImages}
          className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {(saving || uploadingImages) && <Loader2 className="w-4 h-4 animate-spin" />}
          {uploadingImages ? "Uploading Images..." : saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Product</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
