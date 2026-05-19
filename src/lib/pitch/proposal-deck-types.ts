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
  copyDensity: "tight" | "balanced";
  colorUse: string;
  designerNotes: string[];
  selectedAssetIds: string[];
  slides: ProposalDeckSlide[];
}
