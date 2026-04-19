/**
 * Contracts for `/api/automations/*`.
 *
 * Keep in sync with `src/app/api/automations/route.ts`.
 *
 * NOTE on casing: automation `type` and `campaignType` are stored in the DB
 * as UPPER_SNAKE. The route returns them as-is (unlike contacts/campaigns
 * which lower-case them). Keep them as-is here — the frontend expects them
 * upper-cased.
 */

export type AutomationType =
  | "BIRTHDAY"
  | "HOLIDAY"
  | "WELCOME"
  | "RE_ENGAGEMENT"
  | "CUSTOM"
  | "TRIAL_ENDING"
  | "PAYMENT_FAILED"
  | "ABANDONED_CART"
  | "INACTIVITY"
  | "ANNIVERSARY"
  | "SUBSCRIPTION_CHANGE";

export type AutomationCampaignType = "EMAIL" | "SMS";

export interface AutomationContactListRef {
  id: string;
  name: string;
  totalCount: number;
}

/** Parsed trigger payload. Shape varies by automation type. */
export type AutomationTrigger = Record<string, unknown>;

export interface AutomationResponse {
  id: string;
  name: string;
  type: AutomationType;
  trigger: AutomationTrigger;
  enabled: boolean;
  campaignType: AutomationCampaignType;
  subject: string | null;
  content: string;
  contentHtml: string | null;
  /** HH:mm local time for daily runs. */
  sendTime: string;
  /** +/- days from the trigger date. */
  daysOffset: number;
  timezone: string;
  contactListId: string | null;
  contactList: AutomationContactListRef | null;
  totalSent: number;
  lastTriggered: string | null;
  logsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationStats {
  total: number;
  active: number;
  totalSent: number;
}

/** Response body for GET /api/automations */
export interface AutomationListResponse {
  automations: AutomationResponse[];
  stats: AutomationStats;
}

/** Query params for GET /api/automations */
export interface AutomationListQuery {
  type?: AutomationType;
  enabled?: "true" | "false";
  search?: string;
}

/** Request body for POST /api/automations */
export interface CreateAutomationRequest {
  name: string;
  type: AutomationType;
  trigger: AutomationTrigger;
  campaignType: AutomationCampaignType;
  subject?: string;
  content: string;
  contentHtml?: string;
  sendTime?: string;
  daysOffset?: number;
  timezone?: string;
  contactListId?: string;
  enabled?: boolean;
  imageUrl?: string;
  imageSource?: string;
  imageOverlayText?: string;
}

/** Response body for POST /api/automations */
export interface CreateAutomationResponse {
  automation: AutomationResponse;
}
