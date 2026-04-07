"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Link2,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface DomainItem {
  id: string;
  domainName: string;
  tld?: string;
  type: string;
  registrarStatus?: string;
  registrarOrderId?: string;
  sslStatus?: string;
  isPrimary?: boolean;
  isConnected?: boolean;
  createdAt: string;
  website?: { id: string; name: string; slug: string };
  store?: { id: string; name: string; slug: string };
  user: { id: string; name: string; email: string };
}

interface Stats { websiteDomains: number; activeWebsiteDomains: number; storeDomains: number; activeStoreDomains: number; }

export default function AdminDomainsPage() {
  const [tab, setTab] = useState<"website" | "store">("website");
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20", tab });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/domains?${params}`);
      const data = await res.json();
      if (data.success) {
        setDomains(data.data.domains);
        if (data.data.stats) setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch domains:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, currentPage, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStatusBadge = (domain: DomainItem) => {
    const s = domain.registrarStatus || "pending";
    if (s === "active") return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    if (s === "pending") return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe2 className="w-6 h-6" />Domain Management</h1>
          <p className="text-muted-foreground mt-1">Manage website and store custom domains</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Website Domains</p><p className="text-2xl font-bold">{stats.websiteDomains}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active (Website)</p><p className="text-2xl font-bold text-green-500">{stats.activeWebsiteDomains}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Store Domains</p><p className="text-2xl font-bold">{stats.storeDomains}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active (Store)</p><p className="text-2xl font-bold text-green-500">{stats.activeStoreDomains}</p></CardContent></Card>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant={tab === "website" ? "default" : "outline"} size="sm" onClick={() => { setTab("website"); setCurrentPage(1); }}>
          <Link2 className="w-4 h-4 mr-2" />Website Domains
        </Button>
        <Button variant={tab === "store" ? "default" : "outline"} size="sm" onClick={() => { setTab("store"); setCurrentPage(1); }}>
          <Store className="w-4 h-4 mr-2" />Store Domains
        </Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search domains..." className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
      </CardContent></Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : domains.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground"><Globe2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No domains found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Domain</th>
                    <th className="text-left p-3 font-medium">Owner</th>
                    <th className="text-left p-3 font-medium">Linked To</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{d.domainName}</p>
                        {d.tld && <p className="text-xs text-muted-foreground">.{d.tld}</p>}
                      </td>
                      <td className="p-3"><p className="text-xs font-medium">{d.user.name}</p><p className="text-xs text-muted-foreground">{d.user.email}</p></td>
                      <td className="p-3">
                        {d.website && <p className="text-xs"><Link2 className="w-3 h-3 inline mr-1" />{d.website.name}</p>}
                        {d.store && <p className="text-xs"><Store className="w-3 h-3 inline mr-1" />{d.store.name}</p>}
                      </td>
                      <td className="p-3">{getStatusBadge(d)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
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
