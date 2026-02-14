"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X,
  Save,
  Sparkles,
  Tag,
  Settings,
  Database,
  Check,
  Image,
  FileText,
  Palette,
  ToggleLeft,
  ToggleRight,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CreditPricing {
  id: string;
  key: string;
  name: string;
  description: string | null;
  credits: number;
  category: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

interface Category {
  name: string;
  count: number;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ai_text: FileText,
  ai_branding: Palette,
  ai_image: Image,
  general: Tag,
};

const categoryLabels: Record<string, string> = {
  ai_text: "AI Text Generation",
  ai_branding: "AI Branding",
  ai_image: "AI Image Generation",
  general: "General",
};

const categoryColors: Record<string, string> = {
  ai_text: "bg-blue-500/20 text-blue-400",
  ai_branding: "bg-purple-500/20 text-purple-400",
  ai_image: "bg-orange-500/20 text-orange-400",
  general: "bg-gray-500/20 text-gray-400",
};

export default function AdminCreditPricingPage() {
  // State
  const [pricing, setPricing] = useState<CreditPricing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isSeeding, setIsSeeding] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<{
    open: boolean;
    item: CreditPricing | null;
  }>({ open: false, item: null });
  const [editCredits, setEditCredits] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch pricing data
  const fetchPricing = async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }
      const response = await fetch(`/api/admin/credit-pricing?${params}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      setPricing(data.data.pricing);
      setCategories(data.data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing");
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await fetchPricing();
      setIsLoading(false);
    };
    loadData();
  }, [categoryFilter]);

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPricing();
    setIsRefreshing(false);
  };

  // Seed default pricing
  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const response = await fetch("/api/admin/credit-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      await fetchPricing();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to seed pricing");
    } finally {
      setIsSeeding(false);
    }
  };

  // Open edit modal
  const openEditModal = (item: CreditPricing) => {
    setEditModal({ open: true, item });
    setEditCredits(item.credits.toString());
    setEditName(item.name);
    setEditDescription(item.description || "");
  };

  // Submit edit
  const handleEdit = async () => {
    if (!editModal.item) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/credit-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editModal.item.id,
          credits: parseInt(editCredits, 10),
          name: editName,
          description: editDescription || null,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);

      setEditModal({ open: false, item: null });
      await fetchPricing();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update pricing");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (item: CreditPricing) => {
    try {
      const response = await fetch("/api/admin/credit-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          isActive: !item.isActive,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      await fetchPricing();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter pricing by search query
  const filteredPricing = pricing.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.key.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query))
    );
  });

  // Group pricing by category for display
  const groupedPricing = filteredPricing.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CreditPricing[]>);

  if (error && pricing.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
            <DollarSign className="w-7 h-7 text-emerald-500" />
            Credit Pricing
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage AI feature credit costs across the platform
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handleSeed}
            disabled={isSeeding}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Seed Defaults
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {pricing.length}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Total Features</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {pricing.filter((p) => p.isActive).length}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {pricing.filter((p) => p.category === "ai_text").length}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Text Features</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Image className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {pricing.filter((p) => p.category === "ai_image").length}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Image Features</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, key, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {categoryLabels[cat.name] || cat.name} ({cat.count})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Pricing List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : filteredPricing.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No pricing entries found</p>
            <Button onClick={handleSeed} disabled={isSeeding}>
              {isSeeding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Seed Default Pricing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPricing).map(([category, items]) => (
            <Card key={category}>
              <CardContent className="p-0">
                {/* Category Header */}
                <div className="p-4 border-b border-border flex items-center gap-3">
                  {(() => {
                    const IconComponent = categoryIcons[category] || Tag;
                    return <IconComponent className="w-5 h-5 text-muted-foreground" />;
                  })()}
                  <h3 className="font-semibold text-foreground">
                    {categoryLabels[category] || category}
                  </h3>
                  <Badge variant="outline" className="ml-2">
                    {items.length} feature{items.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Items */}
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-4 flex items-center justify-between hover:bg-muted/50 ${!item.isActive ? "opacity-50" : ""}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          <Badge className={categoryColors[item.category] || categoryColors.general}>
                            {item.key}
                          </Badge>
                          {!item.isActive && (
                            <Badge variant="outline" className="text-red-400 border-red-400">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Last updated: {formatDate(item.updatedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Credit Cost */}
                        <div className="flex items-center gap-2 min-w-[100px] justify-end">
                          <Sparkles className="w-4 h-4 text-violet-500" />
                          <span className="text-xl font-bold text-foreground">
                            {item.credits}
                          </span>
                          <span className="text-sm text-muted-foreground">credits</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(item)}
                            className="h-8"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(item)}
                            className="h-8"
                          >
                            {item.isActive ? (
                              <ToggleRight className="w-5 h-5 text-green-500" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal.open && editModal.item && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setEditModal({ open: false, item: null })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-xl bg-card"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Edit Pricing
                </h3>
                <button
                  onClick={() => setEditModal({ open: false, item: null })}
                  className="p-1 rounded-lg hover:bg-muted/50"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-4 rounded-lg mb-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{editModal.item.key}</p>
                    <Badge className={categoryColors[editModal.item.category] || categoryColors.general}>
                      {categoryLabels[editModal.item.category] || editModal.item.category}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Feature name"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Credit Cost
                  </label>
                  <input
                    type="number"
                    value={editCredits}
                    onChange={(e) => setEditCredits(e.target.value)}
                    placeholder="Enter credits"
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cost: ${((parseInt(editCredits) || 0) * 0.05).toFixed(2)} ({editCredits || 0} credits x $0.05)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Feature description..."
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 resize-none bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditModal({ open: false, item: null })}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleEdit}
                  disabled={!editCredits || !editName || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
