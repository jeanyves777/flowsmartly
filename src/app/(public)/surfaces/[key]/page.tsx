import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMotionProvider } from "@/components/marketing/motion";
import { SurfaceDeepDive } from "@/components/marketing/sections/surface-deep-dive";
import { SURFACES, SURFACE_BY_KEY } from "@/components/marketing/surfaces";

const SURFACE_ALIASES: Record<string, string> = {
  prints: "print",
};

export function generateStaticParams() {
  return SURFACES.map((s) => ({ key: s.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key: rawKey } = await params;
  const key = SURFACE_ALIASES[rawKey] || rawKey;
  const s = SURFACE_BY_KEY[key];
  if (!s) return { title: "Surface" };
  return {
    title: `${s.label} — ${s.tagline}`,
    description: s.pitch,
  };
}

export default async function SurfacePage({ params }: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await params;
  const key = SURFACE_ALIASES[rawKey] || rawKey;
  if (!SURFACE_BY_KEY[key]) notFound();
  return (
    <PublicMotionProvider>
      <SurfaceDeepDive surfaceKey={key} />
    </PublicMotionProvider>
  );
}
