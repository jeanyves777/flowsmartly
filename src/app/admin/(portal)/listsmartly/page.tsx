"use client";

import { useState, useEffect, useCallback } from "react";
import {
  List,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Star,
  MapPin,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileItem {
  id: string;
  businessName: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  lsPlan: string;
  lsSubscriptionStatus: string;
  setupComplete: boolean;
  totalListings: number;
  liveListings: number;
  citationScore: number;
  totalReviews: number;
  averageRating: number;
  createdAt: string;
  user: { id: string; name: string; email: string };
  _count: { listings: number; reviews: number };
}

interface Stats { totalProfiles: number; setupComplete: number; activeSubscriptions: number; totalListings: number; avgCitationScore: number; avgRating: number; }

export default function AdminListSmartlyPage() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/listsmartly?${params}`);
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data.profiles);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch ListSmartly data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><List className="w-6 h-6" />ListSmartly Management</h1>
          <p className="text-muted-foreground mt-1">Overview of all business listing profiles</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Profiles</p><p className="text-2xl font-bold">{stats.totalProfiles}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Setup Complete</p><p className="text-2xl font-bold text-green-500">{stats.setupComplete}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Subs</p><p className="text-2xl font-bold text-blue-500">{stats.activeSubscriptions}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Listings</p><p className="text-2xl font-bold text-purple-500">{stats.totalListings}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Citation</p><p className="text-2xl font-bold text-orange-500">{stats.avgCitationScore}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Rating</p><p className="text-2xl font-bold flex items-center gap-1"><Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />{stats.avgRating}</p></CardContent></Card>
        </div>
      )}

      <Card><CardContent className="p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by business name, email, or phone..." className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
      </CardContent></Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : profiles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground"><Building className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No ListSmartly profiles found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Business</th>
                    <th className="text-left p-3 font-medium">Owner</th>
                    <th className="text-left p-3 font-medium">Plan</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Listings</th>
                    <th className="text-left p-3 font-medium">Citation</th>
                    <th className="text-left p-3 font-medium">Reviews</th>
                    <th className="text-left p-3 font-medium">Rating</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{p.businessName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.industry && <Badge variant="outline" className="text-xs">{p.industry}</Badge>}
                          {p.city && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}{p.state ? `, ${p.state}` : ""}</span>}
                        </div>
                      </td>
                      <td className="p-3"><p className="text-xs font-medium">{p.user.name}</p><p className="text-xs text-muted-foreground">{p.user.email}</p></td>
                      <td className="p-3"><Badge variant="outline">{p.lsPlan}</Badge></td>
                      <td className="p-3">
                        {p.lsSubscriptionStatus === "active" ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="secondary">{p.lsSubscriptionStatus}</Badge>
                        )}
                        {!p.setupComplete && <p className="text-xs text-yellow-500 mt-1">Setup incomplete</p>}
                      </td>
                      <td className="p-3">
                        <p>{p.liveListings}/{p.totalListings}</p>
                        <p className="text-xs text-muted-foreground">live/total</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.citationScore}%` }} />
                          </div>
                          <span className="text-xs">{p.citationScore}%</span>
                        </div>
                      </td>
                      <td className="p-3">{p.totalReviews}</td>
                      <td className="p-3">
                        {p.averageRating > 0 ? (
                          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{p.averageRating.toFixed(1)}</span>
                        ) : "-"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
