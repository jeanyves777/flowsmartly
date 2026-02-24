"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  Search,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertCircle,
  ShoppingBag,
  Eye,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { PageLoader } from "@/components/shared/page-loader";

// ── Types ──

type TabId = "pricing" | "trends" | "seo" | "recommendations";

interface Product {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: string;
  images: { url: string; alt: string }[];
}

interface Competitor {
  id: string;
  productId: string;
  competitorName: string;
  priceCents: number;
  competitorUrl: string | null;
  inStock: boolean;
  lastChecked: string;
}

interface PriceAnalysis {
  yourPrice: number;
  marketAverage: number;
  marketMin: number;
  marketMax: number;
  position: string;
  competitorCount: number;
}

interface PricingRule {
  id: string;
  strategy: string;
  config: Record<string, number>;
  isActive: boolean;
}

interface PriceHistoryPoint {
  date: string;
  price: number;
}

interface AISuggestion {
  suggestedPriceCents: number;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  factors: string[];
}

interface TrendDataPoint {
  date: string;
  value: number;
}

interface TrendQuery {
  query: string;
  value: number | string;
}

interface TrendResult {
  keyword: string;
  interestOverTime: TrendDataPoint[];
  relatedQueries: {
    top: TrendQuery[];
    rising: TrendQuery[];
  };
}

interface StoreTrendingProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  orders: number;
  views: number;
  priceCents: number;
}

interface SEOProduct {
  productId: string;
  productName: string;
  seoScore: number;
  hasTitle: boolean;
  hasDescription: boolean;
  issues: string[];
}

interface RecommendationProduct {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  slug: string;
}

interface RecommendationResult {
  similar: RecommendationProduct[];
  frequentlyBoughtTogether: RecommendationProduct[];
}

// ── Helpers ──

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "seo", label: "SEO", icon: Search },
  { id: "recommendations", label: "Recommendations", icon: Sparkles },
];

// ── Component ──

export default function IntelligencePage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("pricing");
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeCurrency, setStoreCurrency] = useState("USD");
  const [storeIndustry, setStoreIndustry] = useState<string | null>(null);

  // ── AI Research State ──
  const [hasResearched, setHasResearched] = useState<boolean | null>(null);
  const [latestReport, setLatestReport] = useState<{
    id: string;
    status: string;
    summary: { competitorsFound: number; avgSeoScore: number; trendHighlights: string[]; topRecommendations: string[] } | null;
    completedAt: string | null;
    createdAt: string;
  } | null>(null);
  const [researchRunning, setResearchRunning] = useState(false);

  // ── Pricing Tab State ──
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [priceAnalysis, setPriceAnalysis] = useState<PriceAnalysis | null>(null);
  const [pricingRule, setPricingRule] = useState<PricingRule | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingPricingData, setLoadingPricingData] = useState(false);

  // Add competitor form
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorPrice, setNewCompetitorPrice] = useState("");
  const [newCompetitorUrl, setNewCompetitorUrl] = useState("");
  const [newCompetitorInStock, setNewCompetitorInStock] = useState(true);
  const [addingCompetitor, setAddingCompetitor] = useState(false);

  // Pricing rule form
  const [ruleStrategy, setRuleStrategy] = useState("beat_lowest");
  const [ruleOffsetCents, setRuleOffsetCents] = useState(0);
  const [ruleMarginPercent, setRuleMarginPercent] = useState(0);
  const [ruleMinPrice, setRuleMinPrice] = useState(0);
  const [ruleMaxPrice, setRuleMaxPrice] = useState(0);
  const [savingRule, setSavingRule] = useState(false);
  const [applyingPrice, setApplyingPrice] = useState(false);

  // ── Trends Tab State ──
  const [trendKeyword, setTrendKeyword] = useState("");
  const [trendResults, setTrendResults] = useState<TrendResult | null>(null);
  const [storeTrending, setStoreTrending] = useState<StoreTrendingProduct[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingStoreTrending, setLoadingStoreTrending] = useState(false);

  // ── SEO Tab State ──
  const [seoProducts, setSeoProducts] = useState<SEOProduct[]>([]);
  const [loadingSEO, setLoadingSEO] = useState(false);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [bulkOptimizing, setBulkOptimizing] = useState(false);

  // ── Recommendations Tab State ──
  const [trendingForRecs, setTrendingForRecs] = useState<StoreTrendingProduct[]>([]);
  const [loadingTrendingRecs, setLoadingTrendingRecs] = useState(false);
  const [selectedPreviewProductId, setSelectedPreviewProductId] = useState<string>("");
  const [previewRecommendations, setPreviewRecommendations] = useState<RecommendationResult | null>(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // ── Initial Data Loading ──

  // Load store info
  useEffect(() => {
    async function loadStore() {
      try {
        const res = await fetch("/api/ecommerce/store");
        const data = await res.json();
        if (data.success && data.data?.store) {
          setStoreSlug(data.data.store.slug);
          setStoreCurrency(data.data.store.currency || "USD");
          setStoreIndustry(data.data.store.industry || null);
        }
      } catch {
        // Non-critical
      }
    }
    loadStore();
  }, []);

  // Check if research has been done
  useEffect(() => {
    async function checkResearch() {
      try {
        const res = await fetch("/api/ecommerce/intelligence/research");
        const data = await res.json();
        if (data.success) {
          setHasResearched(data.data.hasResearched);
          setLatestReport(data.data.latestReport);
        } else {
          setHasResearched(false);
        }
      } catch {
        setHasResearched(false);
      }
    }
    checkResearch();
  }, []);

  // Load products for pricing tab
  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true);
      try {
        const res = await fetch("/api/ecommerce/products?limit=100&status=ACTIVE");
        const data = await res.json();
        if (data.success && data.data?.products) {
          setProducts(data.data.products);
        }
      } catch {
        toast({ title: "Failed to load products", variant: "destructive" });
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, [toast]);

  // Auto-select first product when loaded
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  // Auto-load pricing data when product is selected
  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      loadPricingData(selectedProductId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  // ── Pricing Tab Functions ──

  const loadPricingData = useCallback(
    async (productId: string) => {
      if (!productId) return;
      setLoadingPricingData(true);
      setPriceAnalysis(null);
      setCompetitors([]);
      setPricingRule(null);
      setPriceHistory([]);
      setAiSuggestion(null);

      try {
        const [compRes, analysisRes, ruleRes, historyRes] = await Promise.all([
          fetch(`/api/ecommerce/intelligence/competitors?productId=${productId}`),
          fetch(`/api/ecommerce/intelligence/pricing?productId=${productId}&action=analyze`),
          fetch(`/api/ecommerce/intelligence/pricing?productId=${productId}&action=get_rule`),
          fetch(`/api/ecommerce/intelligence/pricing?productId=${productId}&action=history`),
        ]);

        const [compData, analysisData, ruleData, historyData] = await Promise.all([
          compRes.json(),
          analysisRes.json(),
          ruleRes.json(),
          historyRes.json(),
        ]);

        if (compData.success) setCompetitors(compData.data?.competitors || []);
        if (analysisData.success) setPriceAnalysis(analysisData.data?.analysis || null);
        if (ruleData.success && ruleData.data?.rule) {
          const rule = ruleData.data.rule;
          setPricingRule(rule);
          setRuleStrategy(rule.strategy || "beat_lowest");
          const config = rule.config || {};
          setRuleOffsetCents(config.offsetCents || 0);
          setRuleMarginPercent(config.marginPercent || 0);
          setRuleMinPrice(config.minPriceCents || 0);
          setRuleMaxPrice(config.maxPriceCents || 0);
        }
        if (historyData.success) setPriceHistory(historyData.data?.history || []);
      } catch {
        toast({ title: "Failed to load pricing data", variant: "destructive" });
      } finally {
        setLoadingPricingData(false);
      }
    },
    [toast]
  );

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    if (productId) loadPricingData(productId);
  };

  const handleAddCompetitor = async () => {
    if (!selectedProductId || !newCompetitorName || !newCompetitorPrice) return;
    setAddingCompetitor(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          competitorName: newCompetitorName,
          priceCents: Math.round(parseFloat(newCompetitorPrice) * 100),
          competitorUrl: newCompetitorUrl || null,
          inStock: newCompetitorInStock,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Competitor added" });
        setShowAddCompetitor(false);
        setNewCompetitorName("");
        setNewCompetitorPrice("");
        setNewCompetitorUrl("");
        setNewCompetitorInStock(true);
        loadPricingData(selectedProductId);
      } else {
        toast({ title: data.error?.message || "Failed to add competitor", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to add competitor", variant: "destructive" });
    } finally {
      setAddingCompetitor(false);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    try {
      const res = await fetch(`/api/ecommerce/intelligence/competitors?id=${competitorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Competitor removed" });
        if (selectedProductId) loadPricingData(selectedProductId);
      } else {
        toast({ title: data.error?.message || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete competitor", variant: "destructive" });
    }
  };

  const handleGetAISuggestion = async () => {
    if (!selectedProductId) return;
    setLoadingAI(true);
    setAiSuggestion(null);
    try {
      const res = await fetch("/api/ecommerce/intelligence/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProductId, action: "suggest" }),
      });
      const data = await res.json();
      if (data.success && data.data?.suggestion) {
        setAiSuggestion(data.data.suggestion);
      } else {
        toast({ title: data.error?.message || "Failed to get AI suggestion", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to get AI suggestion", variant: "destructive" });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleApplyPrice = async () => {
    if (!selectedProductId || !aiSuggestion) return;
    setApplyingPrice(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          action: "apply_price",
          priceCents: aiSuggestion.suggestedPriceCents,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Price updated successfully" });
        loadPricingData(selectedProductId);
      } else {
        toast({ title: data.error?.message || "Failed to apply price", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to apply price", variant: "destructive" });
    } finally {
      setApplyingPrice(false);
    }
  };

  const handleSaveRule = async () => {
    if (!selectedProductId) return;
    setSavingRule(true);
    try {
      const config: Record<string, number> = {};
      if (ruleStrategy === "beat_lowest" || ruleStrategy === "match_average" || ruleStrategy === "premium") {
        config.offsetCents = ruleOffsetCents;
      }
      if (ruleStrategy === "margin_target") {
        config.marginPercent = ruleMarginPercent;
      }
      if (ruleMinPrice > 0) config.minPriceCents = ruleMinPrice;
      if (ruleMaxPrice > 0) config.maxPriceCents = ruleMaxPrice;

      const res = await fetch("/api/ecommerce/intelligence/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          action: "save_rule",
          strategy: ruleStrategy,
          config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Pricing rule saved" });
        if (data.data?.rule) setPricingRule(data.data.rule);
      } else {
        toast({ title: data.error?.message || "Failed to save rule", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save pricing rule", variant: "destructive" });
    } finally {
      setSavingRule(false);
    }
  };

  // ── Trends Tab Functions ──

  const handleSearchTrends = async () => {
    if (!trendKeyword.trim()) return;
    setLoadingTrends(true);
    setTrendResults(null);
    try {
      const res = await fetch(
        `/api/ecommerce/intelligence/trends?type=search&keyword=${encodeURIComponent(trendKeyword.trim())}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setTrendResults(data.data);
      } else {
        toast({ title: data.error?.message || "Failed to fetch trends", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to fetch trends", variant: "destructive" });
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadStoreTrending = useCallback(async () => {
    setLoadingStoreTrending(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/trends?type=store_trending");
      const data = await res.json();
      if (data.success && data.data?.products) {
        setStoreTrending(data.data.products);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingStoreTrending(false);
    }
  }, []);

  // ── SEO Tab Functions ──

  const loadSEOData = useCallback(async () => {
    setLoadingSEO(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/seo?action=bulk_analyze");
      const data = await res.json();
      if (data.success && data.data?.products) {
        setSeoProducts(data.data.products);
      } else {
        toast({ title: data.error?.message || "Failed to load SEO data", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load SEO data", variant: "destructive" });
    } finally {
      setLoadingSEO(false);
    }
  }, [toast]);

  const handleOptimizeSingle = async (productId: string) => {
    setOptimizingId(productId);
    try {
      const res = await fetch("/api/ecommerce/intelligence/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize", productId }),
      });
      const data = await res.json();
      if (data.success && data.data?.product) {
        setSeoProducts((prev) =>
          prev.map((p) =>
            p.productId === productId ? { ...p, ...data.data.product } : p
          )
        );
        toast({ title: "Product SEO optimized" });
      } else {
        toast({ title: data.error?.message || "Failed to optimize", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to optimize product", variant: "destructive" });
    } finally {
      setOptimizingId(null);
    }
  };

  const handleBulkOptimize = async () => {
    const lowScoreProducts = seoProducts.filter((p) => p.seoScore < 80);
    if (lowScoreProducts.length === 0) {
      toast({ title: "All products already have good SEO scores" });
      return;
    }

    const totalCredits = lowScoreProducts.length * 3;
    if (!confirm(`This will cost ${totalCredits} credits (${lowScoreProducts.length} products x 3 credits). Continue?`)) {
      return;
    }

    setBulkOptimizing(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_optimize",
          productIds: lowScoreProducts.map((p) => p.productId),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `Optimized ${lowScoreProducts.length} products` });
        loadSEOData();
      } else {
        toast({ title: data.error?.message || "Bulk optimize failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to bulk optimize", variant: "destructive" });
    } finally {
      setBulkOptimizing(false);
    }
  };

  // ── Recommendations Tab Functions ──

  const loadTrendingForRecs = useCallback(async () => {
    setLoadingTrendingRecs(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/trends?type=store_trending");
      const data = await res.json();
      if (data.success && data.data?.products) {
        setTrendingForRecs(data.data.products);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingTrendingRecs(false);
    }
  }, []);

  const loadRecommendations = useCallback(
    async (productId: string) => {
      if (!storeSlug || !productId) return;
      setLoadingRecommendations(true);
      setPreviewRecommendations(null);
      try {
        const res = await fetch(
          `/api/store/${storeSlug}/recommendations?productId=${productId}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setPreviewRecommendations(data.data);
        } else {
          toast({ title: data.error?.message || "Failed to load recommendations", variant: "destructive" });
        }
      } catch {
        toast({ title: "Failed to load recommendations", variant: "destructive" });
      } finally {
        setLoadingRecommendations(false);
      }
    },
    [storeSlug, toast]
  );

  // ── Tab-based data loading ──

  useEffect(() => {
    if (activeTab === "trends") {
      loadStoreTrending();
      // Auto-search industry trends if no store trending data
      if (storeIndustry && !trendKeyword) {
        setTrendKeyword(storeIndustry);
      }
    } else if (activeTab === "seo") {
      loadSEOData();
    } else if (activeTab === "recommendations") {
      loadTrendingForRecs();
    }
  }, [activeTab, loadStoreTrending, loadSEOData, loadTrendingForRecs, storeIndustry, trendKeyword]);

  async function handleRunResearch() {
    setResearchRunning(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setHasResearched(true);
        setLatestReport(data.data.report);
        toast({ title: "AI Research completed! Your intelligence data has been updated." });
        // Reload tab data
        if (selectedProductId) loadPricingData(selectedProductId);
        loadSEOData();
        loadStoreTrending();
        loadTrendingForRecs();
      } else {
        toast({ title: data.error?.message || "Research failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to run AI research", variant: "destructive" });
    } finally {
      setResearchRunning(false);
    }
  }

  // ── Helper: get selected product ──
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // ── Pricing position color ──
  function positionColor(position: string) {
    const lower = position.toLowerCase();
    if (lower.includes("below") || lower.includes("lowest")) return "bg-green-100 text-green-800";
    if (lower.includes("above") || lower.includes("highest")) return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  }

  // ── Confidence badge color ──
  function confidenceColor(confidence: string) {
    if (confidence === "high") return "bg-green-100 text-green-800";
    if (confidence === "medium") return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }

  // ── SEO score badge ──
  function seoScoreColor(score: number) {
    if (score > 80) return "bg-green-100 text-green-800";
    if (score >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }

  // ── Render ──

  // Loading state
  if (hasResearched === null) {
    return <PageLoader tips={["Loading Intelligence...", "Checking research data..."]} />;
  }

  // Research running state
  if (researchRunning) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Intelligence</h1>
        </div>
        <PageLoader
          tips={[
            "Discovering competitors for your products...",
            "Analyzing market trends in your industry...",
            "Running SEO analysis on all products...",
            "Generating product recommendations...",
            "Compiling your intelligence report...",
          ]}
        />
      </div>
    );
  }

  // First visit - no research done yet
  if (!hasResearched) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pricing analysis, market trends, SEO optimization, and product recommendations.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-brand-200 dark:border-brand-800/30 bg-brand-50/50 dark:bg-brand-950/10 p-8 md:p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-6">
            <Sparkles className="h-8 w-8 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Start AI Research</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Let AI analyze your competitors, market trends, SEO health, and product recommendations.
            After your first research, this runs automatically every week.
          </p>
          <button
            onClick={handleRunResearch}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors"
          >
            <Sparkles className="h-5 w-5" />
            Start AI Research (15 credits)
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            Analyzes all active products, discovers competitors, checks SEO scores, and identifies trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pricing analysis, market trends, SEO optimization, and product recommendations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {latestReport?.completedAt && (
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              Last: {new Date(latestReport.completedAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={handleRunResearch}
            disabled={researchRunning}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {researchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run Research
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-brand-600 text-white"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ PRICING TAB ═══════════════════════ */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          {/* Product Selector */}
          <div className="rounded-xl border bg-card p-5">
            <label className="block text-sm font-medium mb-2">Select Product</label>
            {loadingProducts ? (
              <div className="animate-pulse text-muted-foreground text-sm">Loading products...</div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {formatCurrency(p.priceCents, storeCurrency)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedProductId && loadingPricingData && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground text-sm">Loading pricing data...</span>
            </div>
          )}

          {selectedProductId && !loadingPricingData && (
            <>
              {/* Price Position Card */}
              {priceAnalysis && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="text-lg font-semibold mb-4">Price Position</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Your Price</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {formatCurrency(priceAnalysis.yourPrice, storeCurrency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4 text-center">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Market Avg</p>
                      <p className="text-2xl font-bold text-gray-700 mt-1">
                        {formatCurrency(priceAnalysis.marketAverage, storeCurrency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4 text-center">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Position</p>
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${positionColor(priceAnalysis.position)}`}>
                          {priceAnalysis.position}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span>Min: {formatCurrency(priceAnalysis.marketMin, storeCurrency)}</span>
                    <span>Max: {formatCurrency(priceAnalysis.marketMax, storeCurrency)}</span>
                    <span>{priceAnalysis.competitorCount} competitor{priceAnalysis.competitorCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              )}

              {/* Competitor Prices Table */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Competitor Prices</h2>
                  <button
                    onClick={() => setShowAddCompetitor(!showAddCompetitor)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Competitor
                  </button>
                </div>

                {/* Add Competitor Form */}
                {showAddCompetitor && (
                  <div className="mb-4 p-4 rounded-lg border bg-muted/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Competitor Name *</label>
                        <input
                          type="text"
                          value={newCompetitorName}
                          onChange={(e) => setNewCompetitorName(e.target.value)}
                          placeholder="e.g. Amazon"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Price ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newCompetitorPrice}
                          onChange={(e) => setNewCompetitorPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">URL (optional)</label>
                        <input
                          type="url"
                          value={newCompetitorUrl}
                          onChange={(e) => setNewCompetitorUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCompetitorInStock}
                            onChange={(e) => setNewCompetitorInStock(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          In Stock
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleAddCompetitor}
                        disabled={addingCompetitor || !newCompetitorName || !newCompetitorPrice}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {addingCompetitor && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddCompetitor(false)}
                        className="px-3 py-1.5 border text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {competitors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No competitors tracked yet. Add one to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 font-medium text-muted-foreground">Competitor</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Price</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">In Stock</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Last Updated</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitors.map((comp) => (
                          <tr key={comp.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-3">
                              <p className="font-medium">{comp.competitorName}</p>
                              {comp.competitorUrl && (
                                <a
                                  href={comp.competitorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View link
                                </a>
                              )}
                            </td>
                            <td className="p-3 font-medium">
                              {formatCurrency(comp.priceCents, storeCurrency)}
                            </td>
                            <td className="p-3">
                              {comp.inStock ? (
                                <span className="inline-flex items-center gap-1 text-green-700">
                                  <Check className="h-3.5 w-3.5" /> Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <X className="h-3.5 w-3.5" /> No
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {formatDate(comp.lastChecked)}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteCompetitor(comp.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* AI Pricing Suggestion */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">AI Pricing Suggestion</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Uses 3 credits per suggestion</p>
                  </div>
                  <button
                    onClick={handleGetAISuggestion}
                    disabled={loadingAI}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loadingAI ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Get AI Suggestion
                    <span className="text-xs opacity-75">(3 credits)</span>
                  </button>
                </div>

                {loadingAI && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-muted-foreground">Analyzing pricing data...</span>
                  </div>
                )}

                {aiSuggestion && !loadingAI && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-lg bg-blue-50 p-4 text-center">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Suggested Price</p>
                        <p className="text-2xl font-bold text-blue-700 mt-1">
                          {formatCurrency(aiSuggestion.suggestedPriceCents, storeCurrency)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4 text-center">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Confidence</p>
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${confidenceColor(aiSuggestion.confidence)}`}>
                            {aiSuggestion.confidence}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <button
                          onClick={handleApplyPrice}
                          disabled={applyingPrice}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {applyingPrice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Apply This Price
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-4">
                      <p className="text-sm font-medium mb-2">Reasoning</p>
                      <p className="text-sm text-muted-foreground">{aiSuggestion.reasoning}</p>
                    </div>

                    {aiSuggestion.factors.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Factors</p>
                        <ul className="space-y-1">
                          {aiSuggestion.factors.map((factor, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {!aiSuggestion && !loadingAI && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Click the button above to get an AI-powered pricing recommendation.</p>
                  </div>
                )}
              </div>

              {/* Pricing Rule */}
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-lg font-semibold mb-4">Pricing Rule</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Strategy</label>
                    <select
                      value={ruleStrategy}
                      onChange={(e) => setRuleStrategy(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="beat_lowest">Beat Lowest Competitor</option>
                      <option value="match_average">Match Market Average</option>
                      <option value="premium">Premium (Above Average)</option>
                      <option value="demand">Demand-Based</option>
                      <option value="margin_target">Margin Target</option>
                    </select>
                  </div>

                  {(ruleStrategy === "beat_lowest" || ruleStrategy === "match_average" || ruleStrategy === "premium") && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Price Offset ($)
                        <span className="text-xs text-muted-foreground ml-1">
                          {ruleStrategy === "beat_lowest"
                            ? "(subtract from lowest)"
                            : ruleStrategy === "premium"
                            ? "(add above average)"
                            : "(adjust from average)"}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={(ruleOffsetCents / 100).toFixed(2)}
                        onChange={(e) => setRuleOffsetCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {ruleStrategy === "margin_target" && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Target Margin (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={ruleMarginPercent}
                        onChange={(e) => setRuleMarginPercent(parseFloat(e.target.value || "0"))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Min Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(ruleMinPrice / 100).toFixed(2)}
                        onChange={(e) => setRuleMinPrice(Math.round(parseFloat(e.target.value || "0") * 100))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Max Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(ruleMaxPrice / 100).toFixed(2)}
                        onChange={(e) => setRuleMaxPrice(Math.round(parseFloat(e.target.value || "0") * 100))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveRule}
                    disabled={savingRule}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save Rule
                  </button>
                </div>
              </div>

              {/* Price History Chart */}
              {priceHistory.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="text-lg font-semibold mb-4">Price History</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={priceHistory.map((p) => ({
                          date: formatDate(p.date),
                          price: p.price / 100,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis
                          fontSize={12}
                          tickFormatter={(val) => `$${val.toFixed(0)}`}
                        />
                        <Tooltip
                          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ fill: "#2563eb", r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedProductId && !loadingProducts && (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a product above to view pricing intelligence.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TRENDS TAB ═══════════════════════ */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          {/* Search Box */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold mb-3">Search Trends</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={trendKeyword}
                onChange={(e) => setTrendKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchTrends()}
                placeholder="Enter a keyword (e.g. wireless earbuds)..."
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearchTrends}
                disabled={loadingTrends || !trendKeyword.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loadingTrends ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search Trends
              </button>
            </div>
          </div>

          {/* Trend Results */}
          {loadingTrends && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground text-sm">Fetching trend data...</span>
            </div>
          )}

          {trendResults && !loadingTrends && (
            <>
              {/* Interest Over Time Chart */}
              {trendResults.interestOverTime.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="text-lg font-semibold mb-4">
                    Interest Over Time: <span className="text-blue-600">{trendResults.keyword}</span>
                  </h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendResults.interestOverTime.map((d) => ({
                          date: formatDate(d.date),
                          value: d.value,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ fill: "#2563eb", r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Related Queries */}
              {(trendResults.relatedQueries.top.length > 0 ||
                trendResults.relatedQueries.rising.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Queries */}
                  <div className="rounded-xl border bg-card p-5">
                    <h3 className="text-base font-semibold mb-3">Top Queries</h3>
                    {trendResults.relatedQueries.top.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No top queries found.</p>
                    ) : (
                      <div className="space-y-2">
                        {trendResults.relatedQueries.top.map((q, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <span className="text-sm">{q.query}</span>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {q.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rising Queries */}
                  <div className="rounded-xl border bg-card p-5">
                    <h3 className="text-base font-semibold mb-3">Rising Queries</h3>
                    {trendResults.relatedQueries.rising.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rising queries found.</p>
                    ) : (
                      <div className="space-y-2">
                        {trendResults.relatedQueries.rising.map((q, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <span className="text-sm">{q.query}</span>
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                              {q.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Store Trending Products */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold mb-4">Store Trending Products</h2>
            {loadingStoreTrending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground text-sm">Loading trending products...</span>
              </div>
            ) : storeTrending.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No trending data yet. Products will appear here as they gain traction.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {storeTrending.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-full h-32 bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-40" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(product.priceCents, storeCurrency)}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" />
                        {product.orders} orders
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {product.views} views
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════ SEO TAB ═══════════════════════ */}
      {activeTab === "seo" && (
        <div className="space-y-6">
          {loadingSEO ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground text-sm">Analyzing SEO...</span>
            </div>
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold mt-1">{seoProducts.length}</p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm font-medium text-muted-foreground">Average SEO Score</p>
                  <p className="text-2xl font-bold mt-1">
                    {seoProducts.length > 0
                      ? Math.round(
                          seoProducts.reduce((acc, p) => acc + p.seoScore, 0) /
                            seoProducts.length
                        )
                      : 0}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm font-medium text-muted-foreground">Products with Issues</p>
                  <p className="text-2xl font-bold mt-1">
                    {seoProducts.filter((p) => p.seoScore < 80).length}
                  </p>
                </div>
              </div>

              {/* Bulk Optimize */}
              {seoProducts.filter((p) => p.seoScore < 80).length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold">Bulk Optimize</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {seoProducts.filter((p) => p.seoScore < 80).length} products x 3 credits ={" "}
                        <span className="font-medium">
                          {seoProducts.filter((p) => p.seoScore < 80).length * 3} credits
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={handleBulkOptimize}
                      disabled={bulkOptimizing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {bulkOptimizing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Optimize All ({seoProducts.filter((p) => p.seoScore < 80).length})
                    </button>
                  </div>
                </div>
              )}

              {/* Products Table */}
              <div className="rounded-xl border bg-card overflow-hidden">
                {seoProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No products to analyze. Add products to your store first.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 font-medium text-muted-foreground">Product Name</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">SEO Score</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Has Title</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Has Description</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seoProducts.map((product) => (
                          <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-3">
                              <p className="font-medium">{product.productName}</p>
                              {product.issues.length > 0 && (
                                <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {product.issues.length} issue{product.issues.length !== 1 ? "s" : ""}
                                </p>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${seoScoreColor(product.seoScore)}`}
                              >
                                {product.seoScore}
                              </span>
                            </td>
                            <td className="p-3">
                              {product.hasTitle ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                            </td>
                            <td className="p-3">
                              {product.hasDescription ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleOptimizeSingle(product.productId)}
                                disabled={optimizingId === product.productId || bulkOptimizing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {optimizingId === product.productId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                                Optimize
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════ RECOMMENDATIONS TAB ═══════════════════════ */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          {/* Trending Products Grid */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold mb-4">Trending Now</h2>
            {loadingTrendingRecs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground text-sm">Loading trending products...</span>
              </div>
            ) : trendingForRecs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No trending products yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trendingForRecs.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-full h-28 bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-40" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{product.orders} orders</span>
                      <span>{product.views} views</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Recommendation Preview */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold mb-2">Product Recommendation Preview</h2>
            <p className="text-xs text-muted-foreground mb-4">
              This is what customers see on the product page.
            </p>

            {/* Product Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1.5">Select a product to preview</label>
              <select
                value={selectedPreviewProductId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedPreviewProductId(id);
                  if (id) loadRecommendations(id);
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {loadingRecommendations && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground text-sm">Loading recommendations...</span>
              </div>
            )}

            {previewRecommendations && !loadingRecommendations && (
              <div className="space-y-6">
                {/* Similar Products */}
                <div>
                  <h3 className="text-base font-semibold mb-3">Similar Products</h3>
                  {previewRecommendations.similar.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No similar products found.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {previewRecommendations.similar.map((product) => (
                        <div
                          key={product.id}
                          className="rounded-lg border p-3 hover:bg-muted/20 transition-colors"
                        >
                          <div className="w-full h-24 bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <ShoppingBag className="h-6 w-6 text-muted-foreground opacity-40" />
                            )}
                          </div>
                          <p className="text-xs font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatCurrency(product.priceCents, storeCurrency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Frequently Bought Together */}
                <div>
                  <h3 className="text-base font-semibold mb-3">Frequently Bought Together</h3>
                  {previewRecommendations.frequentlyBoughtTogether.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No frequently bought together products yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {previewRecommendations.frequentlyBoughtTogether.map((product) => (
                        <div
                          key={product.id}
                          className="rounded-lg border p-3 hover:bg-muted/20 transition-colors"
                        >
                          <div className="w-full h-24 bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <ShoppingBag className="h-6 w-6 text-muted-foreground opacity-40" />
                            )}
                          </div>
                          <p className="text-xs font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatCurrency(product.priceCents, storeCurrency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selectedPreviewProductId && !loadingRecommendations && (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select a product above to preview its recommendations.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
