import Image from "next/image";
import { publicImages } from "@/components/marketing/public-page-visuals";
import { cn } from "@/lib/utils/cn";

export type AssetKind = "design" | "posts" | "ad" | "flyer";

const HERO_IMG: Record<Exclude<AssetKind, "posts">, string> = {
  design: publicImages.studioTeam,
  ad: publicImages.flowshop,
  flyer: publicImages.localBusiness,
};
const POST_IMGS = [publicImages.studioTeam, publicImages.flowshop, publicImages.phoneCreator, publicImages.marketplace];

/** A believable mini-mock of an asset the agent produced — a real photo dressed
 * as a poster / post set / ad, so preview tiles read as real output (never empty). */
export function AssetPreview({ kind, accent, className }: { kind: AssetKind; accent: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-card", className)}>
      {(kind === "design" || kind === "flyer") && (
        <div className="flex h-full flex-col">
          <div className="relative flex-1">
            <Image src={HERO_IMG[kind]} alt="" fill unoptimized sizes="200px" className="object-cover" />
            <div className={cn("absolute inset-0 bg-gradient-to-t opacity-80", accent)} style={{ maskImage: "linear-gradient(to top, black, transparent 70%)" }} />
            <div className="absolute inset-x-0 bottom-0 space-y-1 p-2">
              <div className="h-1.5 w-4/5 rounded bg-white/90" />
              <div className="h-1 w-1/2 rounded bg-white/70" />
            </div>
          </div>
          <div className="flex items-center justify-between p-2">
            <div className="h-1.5 w-1/2 rounded bg-muted" />
            <div className={cn("h-3 w-8 rounded-full bg-gradient-to-r", accent)} />
          </div>
        </div>
      )}
      {kind === "posts" && (
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-1.5">
          {POST_IMGS.map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-md">
              <Image src={src} alt="" fill unoptimized sizes="90px" className="object-cover" />
            </div>
          ))}
        </div>
      )}
      {kind === "ad" && (
        <div className="flex h-full flex-col">
          <div className="relative flex-[1.4]">
            <Image src={HERO_IMG.ad} alt="" fill unoptimized sizes="200px" className="object-cover" />
          </div>
          <div className="space-y-1 p-2">
            <div className="h-1.5 w-4/5 rounded bg-muted" />
            <div className="h-1 w-3/5 rounded bg-muted" />
            <div className={cn("mt-1 h-3 w-12 rounded-full bg-gradient-to-r", accent)} />
          </div>
        </div>
      )}
    </div>
  );
}
