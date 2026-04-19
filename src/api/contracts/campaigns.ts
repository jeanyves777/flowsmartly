/**
 * Contracts for `/api/campaigns/*`.
 *
 * Keep in sync with `src/app/api/campaigns/route.ts`.
 */
import type { Pagination } from "./common";

export type CampaignType = "email" | "sms";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "sending"
  | "sent"
  | "paused"
  | "failed";

export interface CampaignContactListRef {
  id: string;
  name: string;
  totalCount: number;
}

export interface CampaignResponse {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  subject: string | null;
  audience: number;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  /** Percentage 0-100 computed from sent/open. */
  openRate: number;
  /** Percentage 0-100 computed from open/click. */
  clickRate: number;
  contactList: CampaignContactListRef | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  total: number;
  active: number;
  sent: number;
  draft: number;
  /** Percentage 0-100. */
  avgOpenRate: number;
}

/** Response body for GET /api/campaigns */
export interface CampaignListResponse {
  campaigns: CampaignResponse[];
  pagination: Pagination;
  stats: CampaignStats;
}

/** Query params for GET /api/campaigns */
export interface CampaignListQuery {
  type?: CampaignType | "all";
  status?: CampaignStatus | "all";
  search?: string;
  page?: number;
  limit?: number;
}

/** Request body for POST /api/campaigns */
export interface CreateCampaignRequest {
  name: string;
  /** Server accepts upper- or lower-case; canonicalizes internally. */
  type: "EMAIL" | "SMS" | CampaignType;
  subject?: string;
  preheaderText?: string;
  fromName?: string;
  replyTo?: string;
  content: string;
  contentHtml?: string;
  sectionsJson?: string;
  templateId?: string;
  contactListId?: string;
  customRecipients?: string;
  excludedRecipients?: string;
  scheduledAt?: string;
  imageUrl?: string;
  imageSource?: string;
  imageOverlayText?: string;
}

/** Response body for POST /api/campaigns */
export interface CreateCampaignResponse {
  campaign: {
    id: string;
    name: string;
    type: CampaignType;
    status: CampaignStatus;
    createdAt: string;
  };
}
