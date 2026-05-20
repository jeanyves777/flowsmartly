export type ProposalDeckSlideRole =
  | "cover"
  | "about"
  | "commitments"
  | "benefits"
  | "proof"
  | "terms"
  | "closing";

export type ProposalDeckLayout =
  | "hero-split"
  | "visual-right"
  | "two-visuals"
  | "metrics"
  | "terms"
  | "closing";

export type ProposalDeckStyleVariant =
  | "clean-light"
  | "bold-brand"
  | "editorial"
  | "dark-cover"
  | "minimal-grid";

export type ProposalDeckColorRole = "primary" | "secondary" | "accent";

export type ProposalDeckBackgroundStyle = "white" | "soft-tint" | "split-band" | "brand-wash";

export type ProposalDeckMarkerStyle = "corner-block" | "side-tab" | "small-pill";

export interface ProposalDeckVisual {
  id: string;
  title: string;
  url: string;
  role?: "primary" | "secondary" | "accent";
  fit?: "contain" | "wide" | "portrait";
}

export interface ProposalDeckSlide {
  role: ProposalDeckSlideRole;
  headline: string;
  kicker?: string;
  subhead?: string;
  body?: string;
  bullets?: string[];
  layout: ProposalDeckLayout;
  visualIds?: string[];
  visuals?: ProposalDeckVisual[];
  emphasis?: string;
}

export interface ProposalDeckPlan {
  generatedBy: "claude-haiku-deck-agent" | "fallback";
  styleSummary: string;
  styleVariant: ProposalDeckStyleVariant;
  calloutColor: ProposalDeckColorRole;
  backgroundStyle: ProposalDeckBackgroundStyle;
  markerStyle: ProposalDeckMarkerStyle;
  copyDensity: "tight" | "balanced";
  colorUse: string;
  designerNotes: string[];
  selectedAssetIds: string[];
  slides: ProposalDeckSlide[];
}
