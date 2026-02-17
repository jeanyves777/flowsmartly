"use client";

import { useState, useEffect } from "react";

// Module-level cache: avoids re-fetching if multiple components on the same page need costs
const cache: { costs: Record<string, number> | null; promise: Promise<Record<string, number>> | null } = {
  costs: null,
  promise: null,
};

function fetchAllCosts(): Promise<Record<string, number>> {
  if (cache.promise) return cache.promise;

  cache.promise = fetch("/api/credits/costs")
    .then((res) => res.json())
    .then((data) => {
      if (data.success && data.data?.costs) {
        cache.costs = data.data.costs;
        return data.data.costs;
      }
      return {};
    })
    .catch(() => ({}));

  return cache.promise;
}

/**
 * Hook to get dynamic credit costs from the database.
 *
 * Usage:
 *   const { costs, loading } = useCreditCosts("AI_VISUAL_DESIGN", "AI_POST");
 *   // costs.AI_VISUAL_DESIGN → 125
 *
 * Costs are fetched once per page load and cached in memory.
 */
export function useCreditCosts(...keys: string[]) {
  const [costs, setCosts] = useState<Record<string, number>>(() => {
    // Return cached data synchronously if available
    if (cache.costs) {
      const filtered: Record<string, number> = {};
      for (const k of keys) {
        if (k in cache.costs) filtered[k] = cache.costs[k];
      }
      return filtered;
    }
    return {};
  });
  const [loading, setLoading] = useState(!cache.costs);

  useEffect(() => {
    let mounted = true;

    fetchAllCosts().then((allCosts) => {
      if (!mounted) return;
      const filtered: Record<string, number> = {};
      for (const k of keys) {
        if (k in allCosts) filtered[k] = allCosts[k];
      }
      setCosts(filtered);
      setLoading(false);
    });

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);

  return { costs, loading };
}

/** Invalidate the cache (e.g., after admin changes pricing). */
export function invalidateCreditCostsCache() {
  cache.costs = null;
  cache.promise = null;
}
