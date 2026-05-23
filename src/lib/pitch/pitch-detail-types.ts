import type { ReactNode } from "react";
import type { ServiceProposalContent } from "./proposal-agent";

export interface GooglePlacesData {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  hours?: string[];
  isOpenNow?: boolean;
  businessStatus?: string;
  types?: string[];
  googleMapsUrl?: string;
  recentReviews?: Array<{ rating: number; text: string; timeAgo: string }>;
  priceLevel?: number;
}

export interface ResearchData {
  websiteTitle?: string;
  metaDescription?: string;
  hasSSL?: boolean;
  hasMobileViewport?: boolean;
  hasAnalytics?: boolean;
  hasChatWidget?: boolean;
  hasBookingSystem?: boolean;
  hasEmailCapture?: boolean;
  hasEcommerce?: boolean;
  socialLinks?: string[];
  contactInfo?: { email?: string; phone?: string; address?: string };
  techStack?: string[];
  services?: string[];
  painPoints?: string[];
  opportunities?: string[];
  summary?: string;
  industry?: string;
  googlePlaces?: GooglePlacesData;
  fetchError?: string;
}

export interface OutreachPitchContent {
  subject?: string;
  headline?: string;
  personalizedHook?: string;
  keyFindings?: string[];
  hiddenFindingsCount?: number;
  opportunityParagraph?: string;
  solutionBullets?: string[];
  impactParagraph?: string;
  ctaText?: string;
  ctaSubtext?: string;
  closingLine?: string;
}

export type PitchContent = OutreachPitchContent | ServiceProposalContent;

export interface Pitch {
  id: string;
  businessName: string;
  businessUrl?: string;
  status: "PENDING" | "RESEARCHING" | "READY" | "FAILED" | "SENT";
  research: ResearchData;
  pitchContent: PitchContent;
  recipientEmail?: string;
  recipientName?: string;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ScoreCategory {
  name: string;
  score: number;
  weight: number;
  icon: ReactNode;
  items: Array<{ label: string; ok: boolean; detail?: string }>;
}
