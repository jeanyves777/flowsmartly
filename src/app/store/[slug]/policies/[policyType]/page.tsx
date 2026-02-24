import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// ── Policy Config ──

const POLICY_CONFIG: Record<string, { title: string; field: string }> = {
  shipping: { title: "Shipping Policy", field: "shippingPolicy" },
  returns: { title: "Returns & Refund Policy", field: "returnPolicy" },
  terms: { title: "Terms of Service", field: "termsOfService" },
  privacy: { title: "Privacy Policy", field: "privacyPolicy" },
};

interface PolicyPageProps {
  params: Promise<{ slug: string; policyType: string }>;
}

// ── Metadata ──

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { slug, policyType } = await params;
  const config = POLICY_CONFIG[policyType];
  if (!config) return {};

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { name: true },
  });

  return {
    title: store ? `${config.title} - ${store.name}` : config.title,
  };
}

// ── Page ──

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug, policyType } = await params;
  const config = POLICY_CONFIG[policyType];

  if (!config) {
    notFound();
  }

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, name: true, isActive: true, settings: true },
  });

  if (!store || !store.isActive) {
    notFound();
  }

  // Parse store content from settings
  let storeContent: Record<string, unknown> = {};
  try {
    const settings = JSON.parse((store.settings as string) || "{}");
    storeContent = (settings.storeContent as Record<string, unknown>) || {};
  } catch {}

  const policyContent = storeContent[config.field] as string | undefined;

  if (!policyContent) {
    notFound();
  }

  return (
    <div className="min-h-[60vh]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back link */}
        <Link
          href={`/store/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100 transition-opacity mb-6"
          style={{ color: "var(--store-text)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </Link>

        {/* Title */}
        <h1
          className="text-2xl sm:text-3xl font-bold mb-8"
          style={{
            fontFamily: "var(--store-font-heading), sans-serif",
            color: "var(--store-text)",
          }}
        >
          {config.title}
        </h1>

        {/* Policy Content */}
        <div
          className="prose prose-sm sm:prose max-w-none"
          style={{ color: "var(--store-text)" }}
        >
          {policyContent.split("\n").map((paragraph, i) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return null;
            // Detect headings (lines that are ALL CAPS or start with a number followed by a period)
            if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80) {
              return (
                <h2
                  key={i}
                  className="text-lg font-semibold mt-6 mb-3"
                  style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
                >
                  {trimmed}
                </h2>
              );
            }
            return <p key={i} className="mb-3 leading-relaxed">{trimmed}</p>;
          })}
        </div>

        {/* Last updated */}
        <div className="mt-12 pt-6 border-t">
          <p className="text-xs opacity-40">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
