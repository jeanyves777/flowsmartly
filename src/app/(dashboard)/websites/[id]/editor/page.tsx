"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { WebsiteEditor } from "@/components/website-builder/editor/website-editor";
import { PageLoader } from "@/components/shared/page-loader";

export default function WebsiteEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<{
    websiteId: string;
    websiteName: string;
    websiteSlug: string;
    pages: Array<{ id: string; title: string; slug: string; isHomePage: boolean; status: string; sortOrder: number; blocks: string }>;
    theme: string;
    navigation: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Website not found");
        return r.json();
      })
      .then((res) => {
        const website = res.website;
        if (!website) {
          router.push("/websites");
          return;
        }
        setData({
          websiteId: website.id,
          websiteName: website.name,
          websiteSlug: website.slug,
          pages: (website.pages || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            isHomePage: p.isHomePage,
            status: p.status,
            sortOrder: p.sortOrder,
            blocks: p.blocks || "[]",
          })),
          theme: website.theme || "{}",
          navigation: website.navigation || "{}",
        });
      })
      .catch((err) => {
        console.error("Failed to load website:", err);
        setError("Failed to load website");
      });
  }, [id, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => router.push("/websites")} className="text-sm text-primary hover:underline">
            Back to Website Builder
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <PageLoader tips={["Loading your website editor...", "Preparing the canvas..."]} />;
  }

  return (
    <WebsiteEditor
      websiteId={data.websiteId}
      websiteName={data.websiteName}
      websiteSlug={data.websiteSlug}
      pages={data.pages}
      theme={data.theme}
      navigation={data.navigation}
    />
  );
}
