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
  templateId: string | null;
  subject: string | null;
  content: string;
  contentHtml: string | null;
  imageUrl?: string | null;
  imageSource?: string | null;
  imageOverlayText?: string | null;
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

/**
 * Per-event email override. For HOLIDAY automations the wizard can send one
 * entry per selected holiday so each automation gets a uniquely-generated email
 * instead of sharing the same template. Entries without a `holidayId` act as
 * the fallback for any automation that does not have its own override.
 */
export interface AutomationEmailOverride {
  holidayId?: string;
  subject?: string;
  content?: string;
  contentHtml?: string;
}

/** Request body for POST /api/automations */
export interface CreateAutomationRequest {
  name: string;
  type: AutomationType;
  trigger: AutomationTrigger;
  campaignType: AutomationCampaignType;
  templateId?: string | null;
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
  /** Optional per-event overrides for the generated email body. */
  emails?: AutomationEmailOverride[];
}

/** Response body for POST /api/automations */
export interface CreateAutomationResponse {
  automation: AutomationResponse;
  automations?: AutomationResponse[];
  createdCount?: number;
}
