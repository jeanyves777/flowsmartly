import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export type AssetKind = "design" | "posts" | "ad" | "flyer";

const GENERATED: Record<AssetKind, string> = {
  design: "/marketing/generated/asset-design.webp",
  posts: "/marketing/generated/asset-posts.webp",
  ad: "/marketing/generated/asset-ad.webp",
  flyer: "/marketing/generated/asset-flyer.webp",
};

/** A real, agent-generated asset (poster / post set / ad / flyer) shown full-bleed
 * — so preview tiles read as real produced work, never empty. */
export function AssetPreview({ kind, className }: { kind: AssetKind; accent?: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-muted", className)}>
      <Image src={GENERATED[kind]} alt="" fill unoptimized sizes="220px" className="object-cover" />
    </div>
  );
}
