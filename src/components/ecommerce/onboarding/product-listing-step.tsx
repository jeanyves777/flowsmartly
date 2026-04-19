"use client";

import { useState, useCallback } from "react";
import { Package, Plus, Trash2, Sparkles, Upload, ChevronDown, ChevronUp, ImageIcon, DollarSign, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { AISpinner } from "@/components/shared/ai-generation-loader";

export interface ProductEntry {
  name: string;
  description: string;
  priceCents: number;
  comparePriceCents?: number;
  category: string;
  images: string[];
  variants: Array<{ name: string; options: Record<string, string>; priceCents: number }>;
  tags: string[];
}

interface ProductListingStepProps {
  storeId: string;
  industry: string;
  currency: string;
  products: ProductEntry[];
  onProductsChange: (products: ProductEntry[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ProductListingStep({
  storeId,
  industry,
  currency,
  products,
  onProductsChange,
  onNext,
  onBack,
}: ProductListingStepProps) {
  const [mode, setMode] = useState<"choose" | "manual" | "ai">("choose");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<number | null>(null);

  const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "\u20AC" : currency === "XOF" ? "CFA " : "$";

  // ── AI product generation ──

  const generateProducts = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);

    try {
      const res = await fetch("/api/ecommerce/ai/generate-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiPrompt,
          count: 8,
          industry,
          currency,
        }),
      });

      const data = await res.json();
      // API returns { success, data: { products, count, creditsUsed } }
      const products = data.data?.products || data.products;
      if (products && Array.isArray(products)) {
        const mapped: ProductEntry[] = products.map((p: any) => ({
          name: p.name || "",
          description: p.description || "",
          priceCents: p.priceCents || 0,
          comparePriceCents: p.comparePriceCents,
          category: p.category || "general",
          images: p.images || [],
          variants: p.variants || [],
          tags: p.tags || [],
        }));
        onProductsChange(mapped);
        setMode("manual"); // Switch to manual mode to let user review/edit
      } else {
        console.error("[ProductGen] No products in response:", data);
      }
    } catch (err) {
      console.error("[ProductGen] Error:", err);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, industry, currency, onProductsChange]);

  // ── Manual product management ──

  const addProduct = () => {
    onProductsChange([
      ...products,
      {
        name: "",
        description: "",
        priceCents: 0,
        category: "",
        images: [],
        variants: [],
        tags: [],
      },
    ]);
    setExpandedIndex(products.length);
  };

  const removeProduct = (index: number) => {
    const updated = [...products];
    updated.splice(index, 1);
    onProductsChange(updated);
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const updateProduct = (index: number, field: keyof ProductEntry, value: any) => {
    const updated = [...products];
    (updated[index] as any)[field] = value;
    onProductsChange(updated);
  };

  // ── Add variant ──

  const addVariant = (productIndex: number) => {
    const updated = [...products];
    updated[productIndex].variants.push({ name: "", options: {}, priceCents: updated[productIndex].priceCents });
    onProductsChange(updated);
  };

  const removeVariant = (productIndex: number, variantIndex: number) => {
    const updated = [...products];
    updated[productIndex].variants.splice(variantIndex, 1);
    onProductsChange(updated);
  };

  // ── Mode selection screen ──

  if (mode === "choose") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <Package className="w-12 h-12 text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            List Your Products
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Add products now or let AI generate them for you. You can always edit later.
          </p>
        </div>

        <div className="grid gap-4">
          {/* AI generation */}
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setMode("ai")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  AI Generate Products
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Describe what you sell and AI will create products with descriptions, pricing, and categories
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Manual entry */}
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setMode("manual")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Add Products Manually
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter product details, images, pricing, and variants yourself
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Skip */}
          <Card
            className="cursor-pointer hover:border-gray-300 transition-colors"
            onClick={onNext}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Skip for now
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  AI will generate sample products based on your store type
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <div />
        </div>
      </div>
    );
  }

  // ── AI generation screen ──

  if (mode === "ai" && products.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <Sparkles className="w-10 h-10 text-purple-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Describe What You Sell
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Be specific — AI will generate products with descriptions, pricing, and categories
          </p>
        </div>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Example: I sell handmade ceramic mugs and bowls. My prices range from $25 to $65. I also have gift sets. My style is minimalist with earthy glazes like sage green, sand, and charcoal."
          className="w-full h-40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-primary focus:outline-none"
        />

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setMode("choose")}>Back</Button>
          <Button
            onClick={generateProducts}
            disabled={!aiPrompt.trim() || aiLoading}
          >
            {aiLoading ? (
              <>
                <AISpinner className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Products
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Manual entry / AI review screen ──

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {products.length} {products.length === 1 ? "Product" : "Products"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review, edit, or add more products
          </p>
        </div>
        <Button onClick={addProduct} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Product
        </Button>
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {products.map((product, index) => (
          <Card key={index} className="overflow-hidden">
            {/* Header (collapsed view) */}
            <button
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {product.images[0] ? (
                  <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {product.name || "Unnamed Product"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {product.priceCents > 0 ? `${currencySymbol}${(product.priceCents / 100).toFixed(2)}` : "No price set"}
                  {product.category && ` \u00B7 ${product.category}`}
                  {product.variants.length > 0 && ` \u00B7 ${product.variants.length} variants`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); removeProduct(index); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedIndex === index ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Expanded form */}
            {expandedIndex === index && (
              <CardContent className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Name</label>
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(index, "name", e.target.value)}
                    placeholder="Product name"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
                  <textarea
                    value={product.description}
                    onChange={(e) => updateProduct(index, "description", e.target.value)}
                    placeholder="Product description"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none"
                  />
                </div>

                {/* Price + Compare price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                      <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                      Price ({currency})
                    </label>
                    <input
                      type="number"
                      value={product.priceCents > 0 ? (product.priceCents / 100).toFixed(2) : ""}
                      onChange={(e) => updateProduct(index, "priceCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                      Compare Price (optional)
                    </label>
                    <input
                      type="number"
                      value={product.comparePriceCents ? (product.comparePriceCents / 100).toFixed(2) : ""}
                      onChange={(e) => updateProduct(index, "comparePriceCents", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)}
                      placeholder="Was price"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    <Tag className="w-3.5 h-3.5 inline mr-1" />
                    Category
                  </label>
                  <input
                    type="text"
                    value={product.category}
                    onChange={(e) => updateProduct(index, "category", e.target.value)}
                    placeholder="e.g. Home & Living, Accessories"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  />
                </div>

                {/* Images */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    <ImageIcon className="w-3.5 h-3.5 inline mr-1" />
                    Images
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            const imgs = [...product.images];
                            imgs.splice(imgIdx, 1);
                            updateProduct(index, "images", imgs);
                          }}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => { setMediaPickerTarget(index); setMediaPickerOpen(true); }}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center hover:border-primary transition-colors"
                    >
                      <Upload className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Variants */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Variants</label>
                    <button
                      onClick={() => addVariant(index)}
                      className="text-xs text-primary hover:underline"
                    >
                      + Add variant
                    </button>
                  </div>
                  {product.variants.map((variant, vIdx) => (
                    <div key={vIdx} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => {
                          const vars = [...product.variants];
                          vars[vIdx].name = e.target.value;
                          updateProduct(index, "variants", vars);
                        }}
                        placeholder="e.g. Large / Red"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                      <input
                        type="number"
                        value={(variant.priceCents / 100).toFixed(2)}
                        onChange={(e) => {
                          const vars = [...product.variants];
                          vars[vIdx].priceCents = Math.round(parseFloat(e.target.value || "0") * 100);
                          updateProduct(index, "variants", vars);
                        }}
                        placeholder="Price"
                        step="0.01"
                        className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                      <button onClick={() => removeVariant(index, vIdx)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No products yet</p>
          <Button onClick={addProduct}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Product
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => products.length === 0 ? setMode("choose") : onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          {products.length > 0 ? `Continue with ${products.length} products` : "Skip & Continue"}
        </Button>
      </div>

      {/* Media picker */}
      <MediaLibraryPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(url) => {
          if (mediaPickerTarget !== null) {
            const imgs = [...products[mediaPickerTarget].images, url];
            updateProduct(mediaPickerTarget, "images", imgs);
          }
          setMediaPickerOpen(false);
        }}
        filterTypes={["image"]}
      />
    </div>
  );
}
