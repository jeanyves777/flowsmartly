"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  BarChart3,
  Globe,
  RefreshCw,
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
import { cn } from "@/lib/utils/cn";
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
  myPrice: number;
  averageCompetitorPrice: number;
  lowestCompetitorPrice: number;
  highestCompetitorPrice: number;
  position: string;
  priceAdvantagePercent: number;
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
  timelineData: TrendDataPoint[];
  relatedQueries: {
    top: TrendQuery[];
    rising: TrendQuery[];
  };
}

interface SEOProduct {
  productId: string;
  name: string;
  score: number;
  issueCount: number;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
}

interface MarketResearchResult {
  trendingProducts: {
    name: string;
    category: string;
    demandLevel: "high" | "medium" | "low";
    estimatedPriceRange: string;
    reason: string;
    youHaveIt: boolean;
  }[];
  marketGaps: {
    category: string;
    opportunity: string;
    competitionLevel: "low" | "medium" | "high";
    estimatedDemand: "high" | "medium" | "low";
  }[];
  categoryInsights: {
    category: string;
    trend: "growing" | "stable" | "declining";
    recommendation: string;
  }[];
  actionItems: string[];
  industryOverview: string;
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
  const [loadingTrends, setLoadingTrends] = useState(false);

  // ── Enhanced Trends State ──
  const [dailyTrends, setDailyTrends] = useState<{ title: string; traffic: string }[]>([]);
  const [industryTrends, setIndustryTrends] = useState<{ top: TrendQuery[]; rising: TrendQuery[] }>({ top: [], rising: [] });
  const [presetKeywords, setPresetKeywords] = useState<string[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [storeGeo, setStoreGeo] = useState("US");

  // ── SEO Tab State ──
  const [seoProducts, setSeoProducts] = useState<SEOProduct[]>([]);
  const [loadingSEO, setLoadingSEO] = useState(false);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [bulkOptimizing, setBulkOptimizing] = useState(false);

  // ── Market Research State ──
  const [marketResearch, setMarketResearch] = useState<MarketResearchResult | null>(null);
  const [loadingMarketResearch, setLoadingMarketResearch] = useState(false);

  // ── Market Research History ──
  const [researchHistory, setResearchHistory] = useState<{ id: string; creditsUsed: number; createdAt: string }[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

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
          fetch(`/api/ecommerce/intelligence/pricing?productId=${productId}&action=analysis`),
          fetch(`/api/ecommerce/intelligence/pricing?productId=${productId}&action=rule`),
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
      const res = await fetch(
        `/api/ecommerce/intelligence/pricing?action=suggest&productId=${selectedProductId}`
      );
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

  const handleSearchTrends = async (overrideKeyword?: string) => {
    const keyword = overrideKeyword || trendKeyword;
    if (!keyword.trim()) return;
    setLoadingTrends(true);
    setTrendResults(null);
    try {
      const encoded = encodeURIComponent(keyword.trim());
      const [searchRes, relatedRes] = await Promise.all([
        fetch(`/api/ecommerce/intelligence/trends?type=search&keyword=${encoded}`),
        fetch(`/api/ecommerce/intelligence/trends?type=related&keyword=${encoded}`),
      ]);
      const [searchData, relatedData] = await Promise.all([searchRes.json(), relatedRes.json()]);
      if (searchData.success && searchData.data) {
        const relatedQueries = relatedData.success && relatedData.data
          ? { top: relatedData.data.top || [], rising: relatedData.data.rising || [] }
          : { top: [], rising: [] };
        setTrendResults({
          keyword: searchData.data.keyword,
          timelineData: searchData.data.timelineData || [],
          relatedQueries,
        });
      } else {
        toast({ title: searchData.error?.message || "Failed to fetch trends", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to fetch trends", variant: "destructive" });
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadTrendsOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/trends?type=overview");
      const data = await res.json();
      if (data.success && data.data) {
        setDailyTrends(data.data.dailyTrends || []);
        setIndustryTrends(data.data.industryTrends || { top: [], rising: [] });
        setPresetKeywords(data.data.presetKeywords || []);
        setStoreGeo(data.data.geo || "US");
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingOverview(false);
    }
  };

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
      if (data.success && data.data?.result) {
        // Re-analyze after optimization to get updated scores
        setSeoProducts((prev) =>
          prev.map((p) =>
            p.productId === productId
              ? { ...p, score: data.data.result.score || p.score, hasSeoTitle: true, hasSeoDescription: true, issueCount: 0 }
              : p
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
    const lowScoreProducts = seoProducts.filter((p) => p.score < 80);
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

  // ── Market Research Functions ──

  const handleRunMarketResearch = async () => {
    setLoadingMarketResearch(true);
    try {
      const res = await fetch("/api/ecommerce/intelligence/market-research", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.data?.result) {
        setMarketResearch(data.data.result);
        toast({ title: "Market research complete" });
        if (data.data.reportId) {
          setSelectedReportId(data.data.reportId);
          // Refresh history list
          try {
            const histRes = await fetch("/api/ecommerce/intelligence/market-research");
            const histData = await histRes.json();
            if (histData.success) setResearchHistory(histData.data.reports || []);
          } catch { /* ignore */ }
        }
      } else {
        toast({ title: data.error?.message || "Market research failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to run market research", variant: "destructive" });
    } finally {
      setLoadingMarketResearch(false);
    }
  };

  const loadResearchHistory = async () => {
    try {
      const res = await fetch("/api/ecommerce/intelligence/market-research");
      const data = await res.json();
      if (data.success && data.data) {
        setResearchHistory(data.data.reports || []);
        if (data.data.latestReport) {
          setMarketResearch(data.data.latestReport.data);
          setSelectedReportId(data.data.latestReport.id);
        }
      }
    } catch {
      // Non-critical
    }
  };

  const loadSpecificReport = async (reportId: string) => {
    setLoadingReport(true);
    setSelectedReportId(reportId);
    try {
      const res = await fetch(`/api/ecommerce/intelligence/market-research?id=${reportId}`);
      const data = await res.json();
      if (data.success && data.data?.report) {
        setMarketResearch(data.data.report.data);
      } else {
        toast({ title: "Failed to load report", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load report", variant: "destructive" });
    } finally {
      setLoadingReport(false);
    }
  };

  // ── Tab-based data loading ──

  useEffect(() => {
    if (activeTab === "trends") {
      // Load overview data (daily trends, industry trends, presets) on first visit
      if (!dailyTrends.length && !loadingOverview) {
        loadTrendsOverview();
      }
      // Auto-search industry trends on first visit
      if (storeIndustry && !trendKeyword && !trendResults && !loadingTrends) {
        setTrendKeyword(storeIndustry);
        handleSearchTrends(storeIndustry);
      }
    } else if (activeTab === "seo") {
      loadSEOData();
    } else if (activeTab === "recommendations") {
      if (!marketResearch && researchHistory.length === 0) {
        loadResearchHistory();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadSEOData, storeIndustry]);

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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold">Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pricing analysis, market trends, SEO optimization, and product recommendations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl border-2 border-dashed border-brand-200 dark:border-brand-800/30 bg-gradient-to-br from-brand-50/80 via-white to-indigo-50/50 dark:from-brand-950/20 dark:via-background dark:to-indigo-950/10 p-8 md:p-12 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
            className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-brand-500/25"
          >
            <Sparkles className="h-10 w-10 text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-2xl font-bold mb-2"
          >
            Start AI Research
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="text-muted-foreground max-w-md mx-auto mb-6"
          >
            Our AI will research the internet to discover competitors, analyze market trends, audit your SEO, and recommend products.
            After your first run, it automatically updates every week.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRunResearch}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-500 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-brand-600 hover:to-indigo-700 transition-all shadow-lg shadow-brand-500/25"
          >
            <Sparkles className="h-5 w-5" />
            Start AI Research (15 credits)
          </motion.button>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="text-xs text-muted-foreground mt-4"
          >
            Discovers competitors, checks pricing, analyzes Google Trends, audits SEO, and identifies market gaps.
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pricing analysis, market trends, SEO optimization, and market research.
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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRunResearch}
            disabled={researchRunning}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {researchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run Research
          </motion.button>
        </div>
      </motion.div>

      {/* Tab Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex gap-1 p-1 rounded-xl bg-muted/50"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2",
              activeTab === tab.id
                ? "bg-brand-600 text-white shadow-sm"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* ═══════════════════════ PRICING TAB ═══════════════════════ */}
      <AnimatePresence mode="wait">
      {activeTab === "pricing" && (
        <motion.div
          key="pricing"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Product Selector */}
          <div className="rounded-xl border bg-card p-5">
            <label className="block text-sm font-medium mb-2">Select Product</label>
            {loadingProducts ? (
              <div className="animate-pulse text-muted-foreground text-sm">Loading products...</div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              {/* AI Pricing CTA Banner */}
              {priceAnalysis && competitors.length > 0 && !aiSuggestion && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="rounded-xl border border-brand-200 dark:border-brand-800/30 bg-gradient-to-r from-brand-50/80 via-white to-indigo-50/50 dark:from-brand-950/20 dark:via-background dark:to-indigo-950/10 p-4 flex items-center gap-4"
                >
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {priceAnalysis.position === "highest" || priceAnalysis.position === "above_average"
                        ? "Your price is above market average"
                        : priceAnalysis.position === "lowest" || priceAnalysis.position === "below_average"
                        ? "Your price is below market average"
                        : "Your price matches the market average"}
                      {" \u2014 "}
                      <span className="text-brand-600 dark:text-brand-400">let AI find the optimal price</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Based on {priceAnalysis.competitorCount} competitor{priceAnalysis.competitorCount !== 1 ? "s" : ""}, AI will analyze demand, margins, and market position to suggest the best price.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGetAISuggestion}
                    disabled={loadingAI}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-brand-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-brand-500/20 flex-shrink-0"
                  >
                    {loadingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Get AI Suggestion
                  </motion.button>
                </motion.div>
              )}

              {/* Price Position Card */}
              {priceAnalysis && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="text-lg font-semibold mb-4">Price Position</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Your Price</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {formatCurrency(priceAnalysis.myPrice, storeCurrency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Avg</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {formatCurrency(priceAnalysis.averageCompetitorPrice, storeCurrency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</p>
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${positionColor(priceAnalysis.position)}`}>
                          {priceAnalysis.position}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span>Min: {formatCurrency(priceAnalysis.lowestCompetitorPrice, storeCurrency)}</span>
                    <span>Max: {formatCurrency(priceAnalysis.highestCompetitorPrice, storeCurrency)}</span>
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
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCompetitorInStock}
                            onChange={(e) => setNewCompetitorInStock(e.target.checked)}
                            className="rounded border-border"
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
                                className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
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
                      <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confidence</p>
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
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
        </motion.div>
      )}

      {/* ═══════════════════════ TRENDS TAB ═══════════════════════ */}
      {activeTab === "trends" && (
        <motion.div
          key="trends"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Preset Keyword Chips */}
          {presetKeywords.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border bg-card p-4"
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick Search — based on your store</p>
              <div className="flex flex-wrap gap-2">
                {presetKeywords.map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => { setTrendKeyword(kw); handleSearchTrends(kw); }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      trendKeyword === kw
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-muted/50 hover:bg-brand-50 hover:border-brand-300 dark:hover:bg-brand-950/20"
                    )}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Search Box */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold mb-1">Google Market Trends</h2>
            <p className="text-xs text-muted-foreground mb-3">Real-time search interest data from Google. See what consumers are searching for.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={trendKeyword}
                onChange={(e) => setTrendKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchTrends()}
                placeholder="Enter a keyword (e.g. wireless earbuds, yoga pants)..."
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => handleSearchTrends()}
                disabled={loadingTrends || !trendKeyword.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {loadingTrends ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Trend Search Results */}
          {loadingTrends && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground text-sm">Fetching Google Trends data...</span>
            </div>
          )}

          {trendResults && !loadingTrends && (
            <>
              {/* Interest Over Time Chart */}
              {trendResults.timelineData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border bg-card p-5"
                >
                  <h2 className="text-lg font-semibold mb-4">
                    Consumer Search Interest: <span className="text-brand-600">&ldquo;{trendResults.keyword}&rdquo;</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">Google search volume over the last 90 days (0-100 scale)</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendResults.timelineData.map((d) => ({
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
                          stroke="var(--brand-500, #6366f1)"
                          strokeWidth={2}
                          dot={{ fill: "var(--brand-500, #6366f1)", r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* Related Queries */}
              {(trendResults.relatedQueries.top.length > 0 ||
                trendResults.relatedQueries.rising.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card p-5">
                    <h3 className="text-base font-semibold mb-1">Top Consumer Searches</h3>
                    <p className="text-xs text-muted-foreground mb-3">Most popular related searches on Google</p>
                    {trendResults.relatedQueries.top.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No top queries found.</p>
                    ) : (
                      <div className="space-y-2">
                        {trendResults.relatedQueries.top.map((q, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                            <button
                              onClick={() => { setTrendKeyword(q.query); handleSearchTrends(q.query); }}
                              className="text-sm text-left hover:text-brand-600 transition-colors"
                            >
                              {q.query}
                            </button>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {q.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border bg-card p-5">
                    <h3 className="text-base font-semibold mb-1">Fastest Growing Searches</h3>
                    <p className="text-xs text-muted-foreground mb-3">Rapidly increasing demand — act on these</p>
                    {trendResults.relatedQueries.rising.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rising queries found.</p>
                    ) : (
                      <div className="space-y-2">
                        {trendResults.relatedQueries.rising.map((q, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                            <button
                              onClick={() => { setTrendKeyword(q.query); handleSearchTrends(q.query); }}
                              className="text-sm text-left hover:text-brand-600 transition-colors"
                            >
                              {q.query}
                            </button>
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                              {q.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </>
          )}

          {/* Daily Trending Section */}
          {dailyTrends.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-brand-500" />
                <h2 className="text-lg font-semibold">Trending Today</h2>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400">
                  {storeGeo}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">What people are searching for right now in your region</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {dailyTrends.map((trend, i) => (
                  <button
                    key={i}
                    onClick={() => { setTrendKeyword(trend.title); handleSearchTrends(trend.title); }}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 hover:border-brand-300 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <span className="text-sm font-medium truncate group-hover:text-brand-600 transition-colors">{trend.title}</span>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                      {trend.traffic}+
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Industry Hot Products */}
          {(industryTrends.top.length > 0 || industryTrends.rising.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-brand-500" />
                <h2 className="text-lg font-semibold">Hot in Your Industry</h2>
                {storeIndustry && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                    {storeIndustry}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {industryTrends.top.length > 0 && (
                  <div className="rounded-xl border bg-card p-5">
                    <h3 className="text-base font-semibold mb-1">Most Searched Products</h3>
                    <p className="text-xs text-muted-foreground mb-3">Top searches consumers make in your industry</p>
                    <div className="space-y-2">
                      {industryTrends.top.slice(0, 10).map((q, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                          <button
                            onClick={() => { setTrendKeyword(q.query); handleSearchTrends(q.query); }}
                            className="text-sm text-left hover:text-brand-600 transition-colors"
                          >
                            {q.query}
                          </button>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {q.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {industryTrends.rising.length > 0 && (
                  <div className="rounded-xl border bg-card p-5">
                    <h3 className="text-base font-semibold mb-1">Fastest Growing Products</h3>
                    <p className="text-xs text-muted-foreground mb-3">Exploding demand — seasonal and emerging trends</p>
                    <div className="space-y-2">
                      {industryTrends.rising.slice(0, 10).map((q, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                          <button
                            onClick={() => { setTrendKeyword(q.query); handleSearchTrends(q.query); }}
                            className="text-sm text-left hover:text-brand-600 transition-colors"
                          >
                            {q.query}
                          </button>
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            {q.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Seasonal Context */}
          {!loadingTrends && !loadingOverview && !trendResults && dailyTrends.length === 0 && (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Loading market trends for your industry...</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════ SEO TAB ═══════════════════════ */}
      {activeTab === "seo" && (
        <motion.div
          key="seo"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
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
                          seoProducts.reduce((acc, p) => acc + p.score, 0) /
                            seoProducts.length
                        )
                      : 0}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm font-medium text-muted-foreground">Products with Issues</p>
                  <p className="text-2xl font-bold mt-1">
                    {seoProducts.filter((p) => p.score < 80).length}
                  </p>
                </div>
              </div>

              {/* Bulk Optimize */}
              {seoProducts.filter((p) => p.score < 80).length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold">Bulk Optimize</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {seoProducts.filter((p) => p.score < 80).length} products x 3 credits ={" "}
                        <span className="font-medium">
                          {seoProducts.filter((p) => p.score < 80).length * 3} credits
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
                      Optimize All ({seoProducts.filter((p) => p.score < 80).length})
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
                              <p className="font-medium">{product.name}</p>
                              {product.issueCount > 0 && (
                                <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {product.issueCount} issue{product.issueCount !== 1 ? "s" : ""}
                                </p>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${seoScoreColor(product.score)}`}
                              >
                                {product.score}
                              </span>
                            </td>
                            <td className="p-3">
                              {product.hasSeoTitle ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                            </td>
                            <td className="p-3">
                              {product.hasSeoDescription ? (
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
        </motion.div>
      )}

      {/* ═══════════════════════ RECOMMENDATIONS TAB ═══════════════════════ */}
      {activeTab === "recommendations" && (
        <motion.div
          key="recommendations"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* No research yet - hero card */}
          {!marketResearch && !loadingMarketResearch && !loadingReport && researchHistory.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border bg-gradient-to-br from-card via-card to-brand-50/30 dark:to-brand-950/10 p-8 md:p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="h-20 w-20 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/25"
              >
                <Globe className="h-10 w-10 text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold mb-2"
              >
                AI Market Research
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-muted-foreground mb-6 max-w-md mx-auto"
              >
                Our AI will research the internet to find what&apos;s trending in your industry, identify products you should be selling,
                and discover market opportunities you&apos;re missing.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRunMarketResearch}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium rounded-xl hover:from-brand-600 hover:to-indigo-700 transition-all shadow-lg shadow-brand-500/25"
              >
                <Sparkles className="h-5 w-5" />
                Run AI Market Research (15 credits)
              </motion.button>
            </motion.div>
          )}

          {/* Loading specific report */}
          {loadingReport && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <span className="ml-2 text-sm text-muted-foreground">Loading report...</span>
            </div>
          )}

          {/* Loading */}
          {loadingMarketResearch && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500 mb-3" />
              <p className="text-sm font-medium">Researching market trends and opportunities...</p>
              <p className="text-xs text-muted-foreground mt-1">Analyzing Google Trends, consumer demand, and your catalog gaps</p>
            </div>
          )}

          {/* Market Research Results */}
          {marketResearch && !loadingMarketResearch && (
            <>
              {/* Research Header with History */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between flex-wrap gap-3"
              >
                <div className="flex items-center gap-3">
                  {researchHistory.length > 1 && (
                    <select
                      value={selectedReportId || ""}
                      onChange={(e) => loadSpecificReport(e.target.value)}
                      className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {researchHistory.map((r) => (
                        <option key={r.id} value={r.id}>
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </option>
                      ))}
                    </select>
                  )}
                  {researchHistory.length === 1 && selectedReportId && (
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Researched: {new Date(researchHistory[0].createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRunMarketResearch}
                  disabled={loadingMarketResearch}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {loadingMarketResearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  New Research (15 credits)
                </motion.button>
              </motion.div>

              {/* Industry Overview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border bg-gradient-to-r from-card to-brand-50/20 dark:to-brand-950/10 p-5"
              >
                <h2 className="text-lg font-semibold mb-2">Industry Overview</h2>
                <p className="text-sm text-muted-foreground">{marketResearch.industryOverview}</p>
              </motion.div>

              {/* Trending Products to Sell */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-xl border bg-card p-5"
              >
                <h2 className="text-lg font-semibold mb-1">Trending Products You Should Sell</h2>
                <p className="text-xs text-muted-foreground mb-4">Products with high consumer demand in your industry</p>
                <div className="space-y-3">
                  {marketResearch.trendingProducts.map((product, i) => (
                    <div key={i} className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{product.name}</p>
                          {product.youHaveIt ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">You sell this</span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Missing from catalog</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{product.reason}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-muted-foreground">Category: {product.category}</span>
                          <span className="text-muted-foreground">Price range: {product.estimatedPriceRange}</span>
                          <span className={cn(
                            "font-medium px-1.5 py-0.5 rounded",
                            product.demandLevel === "high" ? "bg-green-100 text-green-700" :
                            product.demandLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {product.demandLevel} demand
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Market Gaps */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-xl border bg-card p-5"
              >
                <h2 className="text-lg font-semibold mb-1">Market Gaps &amp; Opportunities</h2>
                <p className="text-xs text-muted-foreground mb-4">Product categories in demand that you don&apos;t currently carry</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {marketResearch.marketGaps.map((gap, i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <h3 className="font-medium text-sm mb-1">{gap.category}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{gap.opportunity}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={cn(
                          "font-medium px-1.5 py-0.5 rounded",
                          gap.estimatedDemand === "high" ? "bg-green-100 text-green-700" :
                          gap.estimatedDemand === "medium" ? "bg-yellow-100 text-yellow-700" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {gap.estimatedDemand} demand
                        </span>
                        <span className={cn(
                          "font-medium px-1.5 py-0.5 rounded",
                          gap.competitionLevel === "low" ? "bg-green-100 text-green-700" :
                          gap.competitionLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {gap.competitionLevel} competition
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Category Insights */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="rounded-xl border bg-card p-5"
              >
                <h2 className="text-lg font-semibold mb-1">Category Trends</h2>
                <p className="text-xs text-muted-foreground mb-4">Which product categories are growing, stable, or declining</p>
                <div className="space-y-3">
                  {marketResearch.categoryInsights.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{cat.category}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.recommendation}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        cat.trend === "growing" ? "bg-green-100 text-green-700" :
                        cat.trend === "stable" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {cat.trend === "growing" ? "↗ Growing" : cat.trend === "stable" ? "→ Stable" : "↘ Declining"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Action Items */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="rounded-xl border bg-card p-5"
              >
                <h2 className="text-lg font-semibold mb-3">Recommended Actions</h2>
                <div className="space-y-2">
                  {marketResearch.actionItems.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-brand-600">{i + 1}</span>
                      </div>
                      <p className="text-sm">{action}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>

    </div>
  );
}
