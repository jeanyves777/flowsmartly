"use client";

import type { WebsiteBlock, WebsiteTheme } from "@/types/website-builder";
import { blockStyleToInline, getMaxWidthClass } from "@/lib/website/theme-resolver";
import { getBlockAnimationAttrs } from "@/lib/website/animation-css";
import { HeroBlock } from "./hero-block";
import { FeaturesBlock } from "./features-block";
import { PricingBlock } from "./pricing-block";
import { TestimonialsBlock } from "./testimonials-block";
import { GalleryBlock } from "./gallery-block";
import { ContactBlock } from "./contact-block";
import { TextBlock } from "./text-block";
import { TeamBlock } from "./team-block";
import { FAQBlock } from "./faq-block";
import { StatsBlock } from "./stats-block";
import { CTABlock } from "./cta-block";
import { HeaderBlock } from "./header-block";
import { FooterBlock } from "./footer-block";
import { CustomHtmlBlock } from "./custom-html-block";
import { BlogBlock } from "./blog-block";
import { PortfolioBlock } from "./portfolio-block";
import { LogoCloudBlock } from "./logo-cloud-block";
import { VideoBlock } from "./video-block";
import { DividerBlock } from "./divider-block";
import { SpacerBlock } from "./spacer-block";
import { ColumnsBlock } from "./columns-block";
import { ImageBlock } from "./image-block";

interface BlockRendererProps {
  block: WebsiteBlock;
  theme: WebsiteTheme;
  isEditing?: boolean;
  siteSlug?: string;
}

const BLOCK_MAP: Record<string, React.ComponentType<{ block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; siteSlug?: string }>> = {
  hero: HeroBlock,
  features: FeaturesBlock,
  pricing: PricingBlock,
  testimonials: TestimonialsBlock,
  gallery: GalleryBlock,
  contact: ContactBlock,
  text: TextBlock,
  team: TeamBlock,
  faq: FAQBlock,
  stats: StatsBlock,
  cta: CTABlock,
  header: HeaderBlock,
  footer: FooterBlock,
  "custom-html": CustomHtmlBlock,
  blog: BlogBlock,
  portfolio: PortfolioBlock,
  "logo-cloud": LogoCloudBlock,
  video: VideoBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  columns: ColumnsBlock,
  image: ImageBlock,
};

export function BlockRenderer({ block, theme, isEditing, siteSlug }: BlockRendererProps) {
  if (!block.visibility.enabled && !isEditing) return null;

  const Component = BLOCK_MAP[block.type];
  if (!Component) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
        Unknown block type: {block.type}
      </div>
    );
  }

  const animAttrs = isEditing ? {} : getBlockAnimationAttrs(block);
  const inlineStyle = blockStyleToInline(block.style);
  const isFullWidth = block.type === "header" || block.type === "footer" || block.style.maxWidth === "full";

  return (
    <section
      className={`wb-block-${block.id} relative ${!block.visibility.enabled ? "opacity-40" : ""}`}
      style={inlineStyle}
      {...animAttrs}
    >
      <div className={isFullWidth ? "" : `mx-auto px-4 sm:px-6 lg:px-8 ${getMaxWidthClass(block.style.maxWidth)}`}>
        <Component block={block} theme={theme} isEditing={isEditing} siteSlug={siteSlug} />
      </div>
    </section>
  );
}
