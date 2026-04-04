"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { WebsiteBlock, WebsiteTheme } from "@/types/website-builder";
import { blockStyleToInline, getMaxWidthClass } from "@/lib/website/theme-resolver";
import { getBlockAnimationAttrs } from "@/lib/website/animation-css";
import { BLOCK_DEFAULT_CONTENT } from "@/lib/website/block-defaults";
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

// Ensure block content has all required arrays/fields (AI may omit them)
function sanitizeBlock(block: WebsiteBlock): WebsiteBlock {
  const defaults = BLOCK_DEFAULT_CONTENT[block.type];
  if (!defaults) return block;

  const content = block.content as unknown as Record<string, unknown>;
  const defaultContent = defaults as unknown as Record<string, unknown>;

  // Ensure all array fields from defaults exist in content
  for (const [key, defaultVal] of Object.entries(defaultContent)) {
    if (Array.isArray(defaultVal) && !Array.isArray(content[key])) {
      content[key] = defaultVal;
    }
  }

  return {
    ...block,
    content: content as typeof block.content,
    style: block.style || {},
    animation: block.animation || { entrance: "none", scroll: "none", hover: "none" },
    responsive: block.responsive || {},
    visibility: block.visibility || { enabled: true },
  };
}

// Error boundary for individual blocks
class BlockErrorBoundary extends Component<{ blockType: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Block render error (${this.props.blockType}):`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
          Failed to render {this.props.blockType} block
        </div>
      );
    }
    return this.props.children;
  }
}

export function BlockRenderer({ block, theme, isEditing, siteSlug }: BlockRendererProps) {
  if (!block.visibility?.enabled && !isEditing) return null;

  const Component = BLOCK_MAP[block.type];
  if (!Component) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
        Unknown block type: {block.type}
      </div>
    );
  }

  const safeBlock = sanitizeBlock(block);
  const animAttrs = isEditing ? {} : getBlockAnimationAttrs(safeBlock);
  const inlineStyle = blockStyleToInline(safeBlock.style);
  const isFullWidth = safeBlock.type === "header" || safeBlock.type === "footer" || safeBlock.style.maxWidth === "full";

  return (
    <section
      className={`wb-block-${safeBlock.id} relative ${!safeBlock.visibility.enabled ? "opacity-40" : ""}`}
      style={inlineStyle}
      {...animAttrs}
    >
      <div className={isFullWidth ? "" : `mx-auto px-4 sm:px-6 lg:px-8 ${getMaxWidthClass(safeBlock.style.maxWidth)}`}>
        <BlockErrorBoundary blockType={safeBlock.type}>
          <Component block={safeBlock} theme={theme} isEditing={isEditing} siteSlug={siteSlug} />
        </BlockErrorBoundary>
      </div>
    </section>
  );
}
