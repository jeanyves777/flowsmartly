"use client";

import { useState, useCallback } from "react";
import { Search, Globe, Check, X, Loader2, Star, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface DomainResult {
  domain: string;
  tld: string;
  available: boolean;
  retailCents: number;
}

interface DomainSearchProps {
  onSelect: (domain: string, tld: string, retailCents: number) => void;
  isPro?: boolean;
  freeDomainClaimed?: boolean;
  className?: string;
}

const FREE_ELIGIBLE_TLDS = [".com", ".net", ".org", ".info", ".biz", ".store", ".shop", ".online"];

function extractSLD(input: string): string {
  let cleaned = input.trim().toLowerCase();
  // Remove protocol if present
  cleaned = cleaned.replace(/^https?:\/\//, "");
  // Remove www.
  cleaned = cleaned.replace(/^www\./, "");
  // Remove trailing slashes/paths
  cleaned = cleaned.split("/")[0];
  // Strip TLD: take everything before the last dot (if there is one)
  const dotIndex = cleaned.lastIndexOf(".");
  if (dotIndex > 0) {
    cleaned = cleaned.substring(0, dotIndex);
  }
  // Remove any remaining dots (e.g. subdomains) — keep only last segment
  const parts = cleaned.split(".");
  cleaned = parts[parts.length - 1];
  // Remove invalid characters
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");
  return cleaned;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}/yr`;
}

export function DomainSearch({
  onSelect,
  isPro = false,
  freeDomainClaimed = false,
  className,
}: DomainSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DomainResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const sld = extractSLD(query);
    if (!sld) {
      setError("Please enter a valid domain name");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const res = await fetch("/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sld }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || data?.error || `Search failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.data?.results || data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Domain search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const isFreeDomain = (tld: string): boolean => {
    return isPro && !freeDomainClaimed && FREE_ELIGIBLE_TLDS.includes(tld);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for your domain"
            className="pl-9"
            disabled={isSearching}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-2">
          {results.map((result) => {
            const free = isFreeDomain(result.tld);
            return (
              <div
                key={result.domain}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors",
                  result.available
                    ? "hover:bg-accent/50"
                    : "opacity-60"
                )}
              >
                {/* Domain name + availability */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">
                    {result.domain}
                  </span>
                  {result.available ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <X className="h-3 w-3" />
                      Taken
                    </span>
                  )}
                </div>

                {/* Price / Free badge + Select button */}
                <div className="flex items-center gap-3 shrink-0">
                  {result.available && (
                    <>
                      {free ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-2.5 py-0.5 text-xs font-bold text-white">
                          <Crown className="h-3 w-3" />
                          FREE
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground font-medium">
                          {formatPrice(result.retailCents)}
                        </span>
                      )}
                      <Button
                        size="sm"
                        onClick={() =>
                          onSelect(result.domain, result.tld, free ? 0 : result.retailCents)
                        }
                      >
                        Select
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && !error && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Search className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Enter a domain name to search</p>
        </div>
      )}

      {/* No results */}
      {!isSearching && !error && hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Globe className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No results found. Try a different domain name.</p>
        </div>
      )}

      {/* Pro tip */}
      {isPro && !freeDomainClaimed && (
        <div className="flex items-start gap-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3">
          <Star className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
          <p className="text-xs text-violet-700 dark:text-violet-300">
            <span className="font-semibold">Pro perk:</span> Your first domain in a popular TLD
            ({FREE_ELIGIBLE_TLDS.join(", ")}) is free with your Pro subscription!
          </p>
        </div>
      )}
    </div>
  );
}
