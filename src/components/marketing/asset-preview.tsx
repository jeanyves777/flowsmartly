import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export type AssetKind = "design" | "posts" | "ad" | "flyer" | "website" | "video";

const GENERATED: Record<Exclude<AssetKind, "video">, string> = {
  design: "/marketing/generated/asset-design.webp",
  posts: "/marketing/generated/asset-posts.webp",
  ad: "/marketing/generated/asset-ad.webp",
  flyer: "/marketing/generated/asset-flyer.webp",
  website: "/marketing/generated/asset-website.webp",
};
const VIDEO_SRC = "/marketing/generated/showcase-ad.mp4";
const VIDEO_POSTER = "/marketing/generated/asset-video-poster.webp";

/** A real, agent-generated asset shown full-bleed — image, website mock or an
 * actual looping video — so preview tiles read as real produced work. */
export function AssetPreview({ kind, className }: { kind: AssetKind; accent?: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-muted", className)}>
      {kind === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video autoPlay muted loop playsInline poster={VIDEO_POSTER} className="h-full w-full object-cover">
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <Image src={GENERATED[kind]} alt="" fill unoptimized sizes="220px" className="object-cover" />
      )}
    </div>
  );
}
