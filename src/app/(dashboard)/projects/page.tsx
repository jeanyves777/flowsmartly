"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  FolderKanban,
  Users,
  Sparkles,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllowedRoutes } from "@/lib/teams/feature-routes";

interface DelegationPermission {
  featureKey: string;
  maxUsage: number;
  usedCount: number;
}

interface Delegation {
  projectMemberId: string;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  ownerAvailableCredits: number;
  creditsUsed: number;
  expiresAt: string | null;
  permissions: DelegationPermission[];
}

export default function ProjectsPage() {
  const router = useRouter();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDelegations() {
      try {
        const res = await fetch("/api/delegations");
        const json = await res.json();
        if (json.success) {
          setDelegations(json.data || []);
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    fetchDelegations();
  }, []);

  function handleWorkOnIt(delegation: Delegation) {
    const allowedRoutes = getAllowedRoutes(delegation.permissions);

    // Store delegation mode in sessionStorage
    const delegationData = {
      active: true,
      projectMemberId: delegation.projectMemberId,
      projectId: delegation.projectId,
      projectName: delegation.projectName,
      teamId: delegation.teamId,
      teamName: delegation.teamName,
      ownerId: delegation.ownerId,
      ownerName: delegation.ownerName,
      ownerAvatarUrl: delegation.ownerAvatarUrl,
      ownerAvailableCredits: delegation.ownerAvailableCredits,
      allowedRoutes,
      permissions: delegation.permissions,
    };
    sessionStorage.setItem("delegation_mode", JSON.stringify(delegationData));

    // Dispatch a custom event so layout/sidebar can react immediately
    window.dispatchEvent(new Event("delegation-mode-change"));

    // Navigate to the first allowed route or dashboard
    const firstRoute = allowedRoutes[0] || "/dashboard";
    router.push(firstRoute);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Projects</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Projects where you have been granted delegation rights to work on behalf of the owner.
        </p>
      </div>

      {delegations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No delegated projects</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When a team owner grants you delegation rights on a project, it will appear here.
              You&apos;ll be able to work on their behalf using their credits.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {delegations.map((d) => (
            <Card key={d.projectMemberId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-4">
                {/* Project info */}
                <div>
                  <h3 className="font-semibold text-base">{d.projectName}</h3>
                  <p className="text-sm text-muted-foreground">{d.teamName}</p>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium shrink-0">
                    {d.ownerAvatarUrl ? (
                      <img
                        src={d.ownerAvatarUrl}
                        alt={d.ownerName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      d.ownerName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.ownerName}</p>
                    <p className="text-xs text-muted-foreground">Project Owner</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    {d.ownerAvailableCredits} credits available
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {d.permissions.length} features
                  </Badge>
                  {d.expiresAt && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(d.expiresAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>

                {/* Credits used */}
                {d.creditsUsed > 0 && (
                  <p className="text-xs text-muted-foreground">
                    You&apos;ve used {d.creditsUsed} credits so far
                  </p>
                )}

                {/* Work on it button */}
                <Button
                  className="w-full gap-2"
                  onClick={() => handleWorkOnIt(d)}
                >
                  Work on it <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
