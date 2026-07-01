import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMotionProvider } from "@/components/marketing/motion";
import { SurfaceDeepDive } from "@/components/marketing/sections/surface-deep-dive";
import { SURFACES, SURFACE_BY_KEY } from "@/components/marketing/surfaces";

export function generateStaticParams() {
  return SURFACES.map((s) => ({ key: s.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const s = SURFACE_BY_KEY[key];
  if (!s) return { title: "Surface" };
  return {
    title: `${s.label} — ${s.tagline}`,
    description: s.pitch,
  };
}

export default async function SurfacePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!SURFACE_BY_KEY[key]) notFound();
  return (
    <PublicMotionProvider>
      <SurfaceDeepDive surfaceKey={key} />
    </PublicMotionProvider>
  );
}
