export type AgentDesignChannel =
  | "social_post"
  | "story"
  | "flyer"
  | "ad"
  | "poster"
  | "banner"
  | "email_header"
  | "website_hero";

export type AgentDesignOrientation = "square" | "portrait" | "landscape";

export interface AgentDesignFormat {
  channel: AgentDesignChannel;
  orientation: AgentDesignOrientation;
  width: number;
  height: number;
}

export interface AgentDesignPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface AgentDesignTemplate {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  useCase: string;
  audience: string[];
  format: AgentDesignFormat;
  palette: AgentDesignPalette;
  layout: string;
  imageDirection: string;
  typography: string;
  copySlots: string[];
  ctaStyle: string;
  industryTags: string[];
  styleTags: string[];
  metaTags: string[];
  promptGuidance: string;
  avoid: string[];
  imageUrl: string;
  thumbnailUrl: string;
  metaUrl: string;
}

export interface AgentDesignTemplateSearchInput {
  industry?: string | null;
  query?: string | null;
  channel?: AgentDesignChannel | "any" | null;
  useCase?: string | null;
  tags?: string[] | null;
  limit?: number | null;
}

export interface AgentDesignTemplateMatch {
  template: AgentDesignTemplate;
  score: number;
  matchedTags: string[];
}
