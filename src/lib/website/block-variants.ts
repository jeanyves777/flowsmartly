/**
 * Block variant definitions — each block type has multiple visual variants.
 */

import type { WebsiteBlockType } from "@/types/website-builder";

export interface VariantInfo {
  id: string;
  name: string;
  description: string;
}

export const BLOCK_VARIANTS: Record<WebsiteBlockType, VariantInfo[]> = {
  hero: [
    { id: "centered", name: "Centered", description: "Centered text with optional background image" },
    { id: "split-left", name: "Split Left", description: "Text left, image right" },
    { id: "split-right", name: "Split Right", description: "Image left, text right" },
    { id: "video-bg", name: "Video Background", description: "Full-width video background" },
    { id: "minimal", name: "Minimal", description: "Clean text-only hero" },
    { id: "gradient", name: "Gradient", description: "Bold gradient background" },
  ],
  features: [
    { id: "grid-icons", name: "Grid with Icons", description: "Icon-based feature grid" },
    { id: "grid-images", name: "Grid with Images", description: "Image-based feature cards" },
    { id: "alternating", name: "Alternating", description: "Alternating left-right layout" },
    { id: "list", name: "List", description: "Vertical list layout" },
    { id: "cards", name: "Cards", description: "Elevated card layout" },
  ],
  pricing: [
    { id: "three-column", name: "Three Column", description: "Classic 3-plan layout" },
    { id: "two-column", name: "Two Column", description: "Simple 2-plan comparison" },
    { id: "comparison", name: "Comparison Table", description: "Feature comparison table" },
  ],
  testimonials: [
    { id: "grid-cards", name: "Grid Cards", description: "Card-based grid" },
    { id: "carousel", name: "Carousel", description: "Sliding carousel" },
    { id: "single-featured", name: "Single Featured", description: "One large testimonial" },
    { id: "masonry", name: "Masonry", description: "Masonry grid layout" },
  ],
  gallery: [
    { id: "grid", name: "Grid", description: "Uniform grid" },
    { id: "masonry", name: "Masonry", description: "Pinterest-style masonry" },
    { id: "carousel", name: "Carousel", description: "Sliding carousel" },
  ],
  contact: [
    { id: "split", name: "Split", description: "Form left, info right" },
    { id: "centered", name: "Centered", description: "Centered form" },
    { id: "with-map", name: "With Map", description: "Form with embedded map" },
  ],
  text: [
    { id: "simple", name: "Simple", description: "Basic text block" },
    { id: "two-column", name: "Two Column", description: "Two-column text" },
    { id: "with-sidebar", name: "With Sidebar", description: "Text with sidebar callout" },
    { id: "quote", name: "Quote", description: "Large pull-quote style" },
  ],
  team: [
    { id: "grid-cards", name: "Grid Cards", description: "Card-based member grid" },
    { id: "list", name: "List", description: "Horizontal list" },
    { id: "circular", name: "Circular Photos", description: "Round avatar style" },
  ],
  faq: [
    { id: "accordion", name: "Accordion", description: "Expandable accordion" },
    { id: "two-column", name: "Two Column", description: "Side-by-side columns" },
    { id: "simple", name: "Simple", description: "All expanded" },
  ],
  stats: [
    { id: "row", name: "Row", description: "Horizontal row" },
    { id: "cards", name: "Cards", description: "Individual stat cards" },
    { id: "icon-stats", name: "With Icons", description: "Stats with icons" },
  ],
  cta: [
    { id: "centered", name: "Centered", description: "Centered CTA" },
    { id: "split", name: "Split", description: "Text left, buttons right" },
    { id: "banner", name: "Banner", description: "Full-width banner" },
  ],
  header: [
    { id: "standard", name: "Standard", description: "Logo left, nav right" },
    { id: "centered", name: "Centered", description: "Centered logo and nav" },
    { id: "minimal", name: "Minimal", description: "Hamburger menu" },
  ],
  footer: [
    { id: "columns", name: "Columns", description: "Multi-column with links" },
    { id: "simple", name: "Simple", description: "One-line footer" },
    { id: "centered", name: "Centered", description: "Centered with social icons" },
  ],
  "custom-html": [
    { id: "default", name: "Default", description: "Raw HTML block" },
  ],
  blog: [
    { id: "grid-cards", name: "Grid Cards", description: "Card-based blog grid" },
    { id: "list", name: "List", description: "Blog post list" },
    { id: "featured", name: "Featured", description: "Large featured + grid" },
  ],
  portfolio: [
    { id: "grid", name: "Grid", description: "Uniform grid" },
    { id: "masonry", name: "Masonry", description: "Masonry layout" },
    { id: "hover-reveal", name: "Hover Reveal", description: "Details on hover" },
  ],
  "logo-cloud": [
    { id: "row", name: "Row", description: "Single row of logos" },
    { id: "grid", name: "Grid", description: "Logo grid" },
    { id: "scroll", name: "Auto Scroll", description: "Infinite scroll animation" },
  ],
  video: [
    { id: "centered", name: "Centered", description: "Centered video player" },
    { id: "full-width", name: "Full Width", description: "Edge-to-edge video" },
    { id: "with-text", name: "With Text", description: "Video with side text" },
  ],
  divider: [
    { id: "line", name: "Line", description: "Simple horizontal line" },
    { id: "wave", name: "Wave", description: "Wavy SVG divider" },
    { id: "angle", name: "Angle", description: "Angled section divider" },
    { id: "dots", name: "Dots", description: "Dotted divider" },
    { id: "zigzag", name: "Zigzag", description: "Zigzag pattern" },
    { id: "gradient", name: "Gradient", description: "Gradient fade" },
  ],
  spacer: [
    { id: "default", name: "Default", description: "Vertical spacing" },
  ],
  columns: [
    { id: "equal", name: "Equal", description: "Equal width columns" },
    { id: "sidebar-left", name: "Sidebar Left", description: "Narrow left, wide right" },
    { id: "sidebar-right", name: "Sidebar Right", description: "Wide left, narrow right" },
  ],
  image: [
    { id: "full-width", name: "Full Width", description: "Full-width image" },
    { id: "contained", name: "Contained", description: "Centered with padding" },
    { id: "parallax", name: "Parallax", description: "Parallax scroll effect" },
  ],
};
