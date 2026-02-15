import { useState, useEffect, useCallback } from "react";

export interface SocialPlatformData {
  platform: string;
  name: string;
  color: string;
  connected: boolean;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  connectedAt: string | null;
}

/**
 * Hook to fetch social platform connection status from the DB.
 * Returns the list of supported platforms with their connection status.
 */
export function useSocialPlatforms() {
  const [platforms, setPlatforms] = useState<SocialPlatformData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlatforms = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/social-accounts");
      const data = await res.json();
      if (data.success) {
        setPlatforms(data.data.platforms || []);
      }
    } catch (err) {
      console.error("Failed to fetch social platforms:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  // Build a quick lookup map: platform id -> connected boolean
  const connectedMap = new Map(
    platforms.map((p) => [p.platform, p.connected])
  );

  return {
    platforms,
    isLoading,
    refetch: fetchPlatforms,
    isConnected: (platformId: string) => connectedMap.get(platformId) ?? false,
  };
}
