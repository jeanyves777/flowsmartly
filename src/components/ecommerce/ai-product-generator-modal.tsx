"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface AIProductGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  storeCurrency: string;
}

type ModalState = "form" | "loading" | "success" | "error";

const CREDIT_COST_PER_PRODUCT = 3;

export function AIProductGeneratorModal({
  isOpen,
  onClose,
  onComplete,
  storeCurrency,
}: AIProductGeneratorModalProps) {
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(8);
  const [state, setState] = useState<ModalState>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);

  const totalCredits = count * CREDIT_COST_PER_PRODUCT;

  const handleGenerate = async () => {
    if (!description.trim() || description.trim().length < 10) return;

    setState("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/ecommerce/ai/generate-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          count,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setGeneratedCount(json.data.count);
        setCreditsUsed(json.data.creditsUsed);
        setState("success");
      } else {
        setErrorMessage(json.error?.message || "Failed to generate products. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setState("error");
    }
  };

  const handleClose = () => {
    if (state === "success") {
      onComplete();
    }
    // Reset state
    setState("form");
    setDescription("");
    setCount(8);
    setErrorMessage("");
    setGeneratedCount(0);
    setCreditsUsed(0);
    onClose();
  };

  const handleRetry = () => {
    setState("form");
    setErrorMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Product Generator</h2>
              <p className="text-xs text-gray-500">Generate products with AI in seconds</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Form State */}
          {state === "form" && (
            <div className="space-y-5">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Describe your products or niche
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Handmade organic skincare products for women aged 25-45. Include serums, moisturizers, cleansers, and face masks with natural ingredients like aloe vera, vitamin C, and hyaluronic acid..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none placeholder:text-gray-400"
                  maxLength={2000}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {description.length}/2000 characters - Be specific for better results
                </p>
              </div>

              {/* Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Number of products
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={count}
                      onChange={(e) => {
                        const val = Math.min(20, Math.max(1, Number(e.target.value) || 1));
                        setCount(val);
                      }}
                      className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    />
                    <span className="text-sm text-gray-500">products</span>
                  </div>
                </div>
              </div>

              {/* Credit cost */}
              <div className="flex items-center justify-between px-4 py-3 bg-violet-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-medium text-violet-900">Credit cost</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-violet-700">{totalCredits}</span>
                  <span className="text-sm text-violet-600 ml-1">credits</span>
                  <p className="text-xs text-violet-500">{CREDIT_COST_PER_PRODUCT} credits per product</p>
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={!description.trim() || description.trim().length < 10}
                className={cn(
                  "w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white",
                  (!description.trim() || description.trim().length < 10) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Sparkles className="h-4 w-4" />
                Generate {count} Products
              </Button>

              {description.trim().length > 0 && description.trim().length < 10 && (
                <p className="text-xs text-amber-600 text-center">
                  Please provide a more detailed description (at least 10 characters)
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Generating Products...</h3>
                <p className="text-sm text-gray-500 mt-1">
                  AI is crafting {count} unique products with descriptions, pricing, and SEO data.
                  This may take 15-30 seconds.
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {state === "success" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Products Generated!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Successfully created <span className="font-semibold text-gray-700">{generatedCount}</span> products
                  as drafts. {creditsUsed} credits were used.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Review and publish your new products from the products list.
                </p>
              </div>
              <Button
                onClick={handleClose}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
              >
                View Products
              </Button>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Generation Failed</h3>
                <p className="text-sm text-gray-500 mt-1">{errorMessage}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRetry}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
