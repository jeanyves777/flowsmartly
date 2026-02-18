export type { SurveyQuestion } from "./follow-up";
export { QUESTION_TYPES } from "./follow-up";

export type SurveyStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export const SURVEY_STATUS_CONFIG: Record<
  SurveyStatus,
  { label: string; color: string }
> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  CLOSED: { label: "Closed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export interface SurveyData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  questions: import("./follow-up").SurveyQuestion[];
  slug: string;
  isActive: boolean;
  thankYouMessage: string;
  responseCount: number;
  contactListId: string | null;
  contactListName?: string | null;
  status: SurveyStatus;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponseData {
  id: string;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentPhone: string | null;
  answers: Record<string, unknown>;
  rating: number | null;
  createdAt: string;
}
