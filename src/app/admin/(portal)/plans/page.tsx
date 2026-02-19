"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Save,
  Sparkles,
  Check,
  ToggleLeft,
  ToggleRight,
  Edit2,
  DollarSign,
  Star,
  Coins,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlanAdmin {
  id: string;
  planId: string;
  name: string;
  description: string | null;
  priceCentsMonthly: number;
  priceCentsYearly: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripeProductId: string | null;
  monthlyCredits: number;
  features: string; // JSON string
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

interface EditForm {
  name: string;
  description: string;
  monthlyCredits: string;
  priceCentsMonthly: string;
  priceCentsYearly: string;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  stripeProductId: string;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: string;
  color: string;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [editPlan, setEditPlan] = useState<PlanAdmin | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState("");

  const fetchPlans = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/plans");
      const json = await res.json();
      if (json.success) {
        setPlans(json.data.plans);
      } else {
        setError(json.error?.message || "Failed to fetch plans");
      }
    } catch {
      setError("Failed to fetch plans");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openEdit = (plan: PlanAdmin) => {
    let features: string[] = [];
    try {
      features = JSON.parse(plan.features);
    } catch {
      features = [];
    }

    setEditPlan(plan);
    setEditForm({
      name: plan.name,
      description: plan.description || "",
      monthlyCredits: String(plan.monthlyCredits),
      priceCentsMonthly: String(plan.priceCentsMonthly),
      priceCentsYearly: String(plan.priceCentsYearly),
      stripePriceIdMonthly: plan.stripePriceIdMonthly || "",
      stripePriceIdYearly: plan.stripePriceIdYearly || "",
      stripeProductId: plan.stripeProductId || "",
      features,
      isPopular: plan.isPopular,
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder),
      color: plan.color,
    });
    setSaveMessage(null);
  };

  const closeEdit = () => {
    setEditPlan(null);
    setEditForm(null);
    setSaveMessage(null);
    setNewFeature("");
  };

  const handleSave = async () => {
    if (!editPlan || !editForm) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editPlan.id,
          name: editForm.name,
          description: editForm.description || null,
          monthlyCredits: parseInt(editForm.monthlyCredits, 10),
          priceCentsMonthly: parseInt(editForm.priceCentsMonthly, 10),
          priceCentsYearly: parseInt(editForm.priceCentsYearly, 10),
          stripePriceIdMonthly: editForm.stripePriceIdMonthly || null,
          stripePriceIdYearly: editForm.stripePriceIdYearly || null,
          stripeProductId: editForm.stripeProductId || null,
          features: editForm.features,
          isPopular: editForm.isPopular,
          isActive: editForm.isActive,
          sortOrder: parseInt(editForm.sortOrder, 10),
          color: editForm.color,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMessage("Plan updated successfully!");
        fetchPlans(true);
        setTimeout(() => closeEdit(), 1000);
      } else {
        setSaveMessage(json.error?.message || "Failed to update plan");
      }
    } catch {
      setSaveMessage("Failed to update plan");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (plan: PlanAdmin) => {
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, isActive: !plan.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        fetchPlans(true);
      }
    } catch {
      // silent
    }
  };

  const addFeature = () => {
    if (!editForm || !newFeature.trim()) return;
    setEditForm({ ...editForm, features: [...editForm.features, newFeature.trim()] });
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    if (!editForm) return;
    setEditForm({ ...editForm, features: editForm.features.filter((_, i) => i !== index) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => fetchPlans()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500" />
            Subscription Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscription plans, credits, pricing, and Stripe integration
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPlans(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total Plans</p>
            <p className="text-2xl font-bold">{plans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{plans.filter((p) => p.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total Credits/mo</p>
            <p className="text-2xl font-bold text-brand-500">
              {plans.filter((p) => p.isActive).reduce((sum, p) => sum + p.monthlyCredits, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">With Stripe</p>
            <p className="text-2xl font-bold text-purple-600">
              {plans.filter((p) => p.stripePriceIdMonthly || p.stripePriceIdYearly).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plans list */}
      <div className="space-y-3">
        {plans.map((plan) => {
          let features: string[] = [];
          try { features = JSON.parse(plan.features); } catch { features = []; }

          return (
            <Card key={plan.id} className={`${!plan.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: plan.color }}
                      />
                      <h3 className="font-semibold">{plan.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{plan.planId}</Badge>
                      {plan.isPopular && (
                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                          <Star className="w-3 h-3 mr-0.5" /> Popular
                        </Badge>
                      )}
                      {!plan.isActive && (
                        <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Credits</p>
                        <p className="text-lg font-bold text-brand-500 flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {plan.monthlyCredits.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Price</p>
                        <p className="text-lg font-bold flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {plan.priceCentsMonthly === 0
                            ? "Free"
                            : `$${(plan.priceCentsMonthly / 100).toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Yearly Price</p>
                        <p className="text-lg font-bold flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {plan.priceCentsYearly === 0
                            ? "Free"
                            : `$${(plan.priceCentsYearly / 100).toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stripe</p>
                        <div className="flex items-center gap-1 mt-1">
                          {plan.stripePriceIdMonthly ? (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">Monthly</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] opacity-50">No Monthly</Badge>
                          )}
                          {plan.stripePriceIdYearly ? (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">Yearly</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] opacity-50">No Yearly</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {features.map((f, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(plan)}
                      title={plan.isActive ? "Disable plan" : "Enable plan"}
                    >
                      {plan.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editPlan && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-500" />
                Edit {editPlan.name} Plan
              </h2>
              <button onClick={closeEdit} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Plan name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Plan Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                  placeholder="Brief description of this plan"
                />
              </div>

              {/* Credits */}
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Monthly Credits
                </label>
                <input
                  type="number"
                  value={editForm.monthlyCredits}
                  onChange={(e) => setEditForm({ ...editForm, monthlyCredits: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Credits granted to subscribers each month. Changes apply to new subscriptions and renewals.
                </p>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Monthly Price (cents)</label>
                  <input
                    type="number"
                    value={editForm.priceCentsMonthly}
                    onChange={(e) => setEditForm({ ...editForm, priceCentsMonthly: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ${(parseInt(editForm.priceCentsMonthly || "0", 10) / 100).toFixed(2)}/mo
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Yearly Price (cents)</label>
                  <input
                    type="number"
                    value={editForm.priceCentsYearly}
                    onChange={(e) => setEditForm({ ...editForm, priceCentsYearly: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ${(parseInt(editForm.priceCentsYearly || "0", 10) / 100).toFixed(2)}/yr
                    {parseInt(editForm.priceCentsYearly || "0", 10) > 0 && (
                      <> (${(parseInt(editForm.priceCentsYearly || "0", 10) / 100 / 12).toFixed(2)}/mo)</>
                    )}
                  </p>
                </div>
              </div>

              {/* Stripe IDs */}
              <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  Stripe Configuration
                </p>
                <div>
                  <label className="text-xs text-muted-foreground">Stripe Product ID</label>
                  <input
                    value={editForm.stripeProductId}
                    onChange={(e) => setEditForm({ ...editForm, stripeProductId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                    placeholder="prod_..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Monthly Price ID</label>
                    <input
                      value={editForm.stripePriceIdMonthly}
                      onChange={(e) => setEditForm({ ...editForm, stripePriceIdMonthly: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                      placeholder="price_..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Yearly Price ID</label>
                    <input
                      value={editForm.stripePriceIdYearly}
                      onChange={(e) => setEditForm({ ...editForm, stripePriceIdYearly: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                      placeholder="price_..."
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Set Stripe Price IDs from your Stripe Dashboard. If empty, ad-hoc prices will be created at checkout.
                </p>
              </div>

              {/* Features */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Features (shown on pricing page)</label>
                <div className="space-y-1.5 mt-2">
                  {editForm.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <input
                        value={feature}
                        onChange={(e) => {
                          const updated = [...editForm.features];
                          updated[i] = e.target.value;
                          setEditForm({ ...editForm, features: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 border rounded-md text-sm bg-background"
                      />
                      <button
                        onClick={() => removeFeature(i)}
                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                      className="flex-1 px-2.5 py-1.5 border rounded-md text-sm bg-background"
                      placeholder="Add a feature..."
                    />
                    <Button variant="outline" size="sm" onClick={addFeature} disabled={!newFeature.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isPopular}
                    onChange={(e) => setEditForm({ ...editForm, isPopular: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Mark as Popular</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>

              {/* Color and Sort */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <input
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sort Order</label>
                  <input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                  />
                </div>
              </div>

              {/* Save message */}
              {saveMessage && (
                <p className={`text-sm font-medium ${saveMessage.includes("success") ? "text-green-600" : "text-red-600"}`}>
                  {saveMessage}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
              <Button variant="outline" size="sm" onClick={closeEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
