"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X,
  Save,
  Sparkles,
  Check,
  Plus,
  ToggleLeft,
  ToggleRight,
  Edit2,
  DollarSign,
  Star,
  TrendingUp,
  Hash,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CreditPackageAdmin {
  id: string;
  packageId: string;
  name: string;
  description: string | null;
  credits: number;
  priceCents: number;
  bonusCredits: number;
  discountPercent: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCreditPackagesPage() {
  // State
  const [packages, setPackages] = useState<CreditPackageAdmin[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
  }>({ total: 0, active: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit modal
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "add" | "edit";
    item: CreditPackageAdmin | null;
  }>({ open: false, mode: "add", item: null });
  const [formPackageId, setFormPackageId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCredits, setFormCredits] = useState("");
  const [formBonusCredits, setFormBonusCredits] = useState("");
  const [formPriceCents, setFormPriceCents] = useState("");
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch packages
  const fetchPackages = async () => {
    try {
      const response = await fetch("/api/admin/credit-packages");
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      setPackages(data.data.packages);
      setStats(data.data.stats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load credit packages"
      );
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await fetchPackages();
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPackages();
    setIsRefreshing(false);
  };

  // Open add modal
  const openAddModal = () => {
    setModal({ open: true, mode: "add", item: null });
    setFormPackageId("");
    setFormName("");
    setFormDescription("");
    setFormCredits("");
    setFormBonusCredits("0");
    setFormPriceCents("");
    setFormIsPopular(false);
    setFormSortOrder("0");
  };

  // Open edit modal
  const openEditModal = (item: CreditPackageAdmin) => {
    setModal({ open: true, mode: "edit", item });
    setFormPackageId(item.packageId);
    setFormName(item.name);
    setFormDescription(item.description || "");
    setFormCredits(item.credits.toString());
    setFormBonusCredits(item.bonusCredits.toString());
    setFormPriceCents(item.priceCents.toString());
    setFormIsPopular(item.isPopular);
    setFormSortOrder(item.sortOrder.toString());
  };

  // Close modal
  const closeModal = () => {
    setModal({ open: false, mode: "add", item: null });
  };

  // Submit add/edit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (modal.mode === "add") {
        const response = await fetch("/api/admin/credit-packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: formPackageId,
            name: formName,
            description: formDescription || null,
            credits: parseInt(formCredits, 10),
            priceCents: parseInt(formPriceCents, 10),
            bonusCredits: parseInt(formBonusCredits, 10) || 0,
            isPopular: formIsPopular,
            sortOrder: parseInt(formSortOrder, 10) || 0,
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message);
      } else if (modal.mode === "edit" && modal.item) {
        const response = await fetch("/api/admin/credit-packages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: modal.item.id,
            name: formName,
            description: formDescription || null,
            credits: parseInt(formCredits, 10),
            priceCents: parseInt(formPriceCents, 10),
            bonusCredits: parseInt(formBonusCredits, 10) || 0,
            isPopular: formIsPopular,
            sortOrder: parseInt(formSortOrder, 10) || 0,
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message);
      }

      closeModal();
      await fetchPackages();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to save credit package"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (item: CreditPackageAdmin) => {
    try {
      if (item.isActive) {
        // Soft delete (deactivate) via DELETE
        const response = await fetch(
          `/api/admin/credit-packages?id=${item.id}`,
          { method: "DELETE" }
        );
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message);
      } else {
        // Reactivate via PUT
        const response = await fetch("/api/admin/credit-packages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            isActive: true,
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message);
      }
      await fetchPackages();
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

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const calcPerCreditCost = (priceCents: number, credits: number, bonusCredits: number) => {
    const totalCredits = credits + bonusCredits;
    if (totalCredits <= 0) return "$0.000";
    return `$${(priceCents / totalCredits / 100).toFixed(3)}`;
  };

  // Derived stats
  const popularPackage = useMemo(
    () => packages.find((p) => p.isPopular && p.isActive),
    [packages]
  );

  const revenueRange = useMemo(() => {
    const activePackages = packages.filter((p) => p.isActive);
    if (activePackages.length === 0) return "N/A";
    const prices = activePackages.map((p) => p.priceCents);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatPrice(min);
    return `${formatPrice(min)} - ${formatPrice(max)}`;
  }, [packages]);

  // Sorted packages for display
  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => a.sortOrder - b.sortOrder),
    [packages]
  );

  // Per-credit cost for form
  const formPerCreditCost = useMemo(() => {
    const credits = parseInt(formCredits, 10) || 0;
    const bonus = parseInt(formBonusCredits, 10) || 0;
    const price = parseInt(formPriceCents, 10) || 0;
    return calcPerCreditCost(price, credits, bonus);
  }, [formCredits, formBonusCredits, formPriceCents]);

  const formDollarAmount = useMemo(() => {
    const price = parseInt(formPriceCents, 10) || 0;
    return formatPrice(price);
  }, [formPriceCents]);

  // Form validation
  const isFormValid =
    modal.mode === "add"
      ? formPackageId.trim() !== "" &&
        formName.trim() !== "" &&
        parseInt(formCredits, 10) > 0 &&
        parseInt(formPriceCents, 10) > 0
      : formName.trim() !== "" &&
        parseInt(formCredits, 10) > 0 &&
        parseInt(formPriceCents, 10) > 0;

  if (error && packages.length === 0) {
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
            <Package className="w-7 h-7 text-emerald-500" />
            Credit Packages
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage purchasable credit bundles
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={openAddModal}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Package
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {stats.total}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Total Packages</p>
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
                  {stats.active}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Active Packages</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground truncate max-w-[140px]">
                  {popularPackage ? popularPackage.name : "None"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Most Popular</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {revenueRange}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Revenue Range</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Package List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : sortedPackages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              No credit packages found
            </p>
            <Button onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Package
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* List Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Package className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">
                Credit Packages
              </h3>
              <Badge variant="outline" className="ml-2">
                {sortedPackages.length} package
                {sortedPackages.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Items */}
            <div className="divide-y divide-border">
              {sortedPackages.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`p-4 flex items-center justify-between hover:bg-muted/50 ${
                    !item.isActive ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-foreground">
                        {item.name}
                      </h4>
                      <Badge className="bg-gray-500/20 text-gray-400">
                        {item.packageId}
                      </Badge>
                      {item.isPopular && (
                        <Badge className="bg-amber-500/20 text-amber-400">
                          <Star className="w-3 h-3 mr-1" />
                          Popular
                        </Badge>
                      )}
                      {!item.isActive && (
                        <Badge
                          variant="outline"
                          className="text-red-400 border-red-400"
                        >
                          Disabled
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-muted-foreground">
                        Sort order: {item.sortOrder}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated: {formatDate(item.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Credits Display */}
                    <div className="flex items-center gap-2 min-w-[140px] justify-end">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      <span className="text-xl font-bold text-foreground">
                        {item.credits.toLocaleString()}
                      </span>
                      {item.bonusCredits > 0 && (
                        <span className="text-sm font-medium text-emerald-400">
                          +{item.bonusCredits.toLocaleString()}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        credits
                      </span>
                    </div>

                    {/* Price */}
                    <div className="text-right min-w-[100px]">
                      <p className="text-lg font-bold text-foreground">
                        {formatPrice(item.priceCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {calcPerCreditCost(
                          item.priceCents,
                          item.credits,
                          item.bonusCredits
                        )}
                        /credit
                      </p>
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
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-xl bg-card max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {modal.mode === "add"
                    ? "Add Credit Package"
                    : "Edit Credit Package"}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg hover:bg-muted/50"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Package info header for edit mode */}
              {modal.mode === "edit" && modal.item && (
                <div className="p-4 rounded-lg mb-4 bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {modal.item.packageId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {formatDate(modal.item.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Package ID - only for add */}
                {modal.mode === "add" && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Package ID
                    </label>
                    <input
                      type="text"
                      value={formPackageId}
                      onChange={(e) => setFormPackageId(e.target.value)}
                      placeholder="e.g. starter, pro, enterprise"
                      className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Unique identifier for this package (cannot be changed
                      later)
                    </p>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Package display name"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Package description..."
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 resize-none bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Credits */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Credits
                  </label>
                  <input
                    type="number"
                    value={formCredits}
                    onChange={(e) => setFormCredits(e.target.value)}
                    placeholder="Number of credits"
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Bonus Credits */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Bonus Credits
                  </label>
                  <input
                    type="number"
                    value={formBonusCredits}
                    onChange={(e) => setFormBonusCredits(e.target.value)}
                    placeholder="Bonus credits (0 for none)"
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                  {parseInt(formBonusCredits, 10) > 0 && (
                    <p className="text-xs text-emerald-400 mt-1">
                      <Gift className="w-3 h-3 inline mr-1" />
                      {formBonusCredits} bonus credits included
                    </p>
                  )}
                </div>

                {/* Price in Cents */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Price (in cents)
                  </label>
                  <input
                    type="number"
                    value={formPriceCents}
                    onChange={(e) => setFormPriceCents(e.target.value)}
                    placeholder="e.g. 999 for $9.99"
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <DollarSign className="w-3 h-3 inline mr-1" />
                    Display price: {formDollarAmount}
                  </p>
                </div>

                {/* Per-credit cost display */}
                {parseInt(formCredits, 10) > 0 &&
                  parseInt(formPriceCents, 10) > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-input">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Per-credit cost:
                        </span>
                        <span className="font-medium text-foreground">
                          {formPerCreditCost}/credit
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">
                          Total credits:
                        </span>
                        <span className="font-medium text-foreground">
                          {(
                            (parseInt(formCredits, 10) || 0) +
                            (parseInt(formBonusCredits, 10) || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                {/* Is Popular */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormIsPopular(!formIsPopular)}
                      className="flex items-center"
                    >
                      {formIsPopular ? (
                        <ToggleRight className="w-8 h-8 text-amber-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        Mark as Popular
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Highlights this package with a &quot;Popular&quot; badge
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    placeholder="Display order (lower = first)"
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <Hash className="w-3 h-3 inline mr-1" />
                    Lower numbers appear first
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSubmit}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {modal.mode === "add"
                        ? "Create Package"
                        : "Save Changes"}
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
