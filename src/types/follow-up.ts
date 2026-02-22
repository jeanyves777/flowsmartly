export type FollowUpType = "TRACKER" | "SURVEY";
export type FollowUpStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type EntryStatus =
  | "PENDING"
  | "CALLED"
  | "NO_ANSWER"
  | "CALLBACK"
  | "COMPLETED"
  | "DECLINED"
  | "NOT_INTERESTED";

export interface SurveyQuestion {
  id: string;
  type: "text" | "textarea" | "rating" | "multiple_choice" | "yes_no" | "email" | "phone";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FollowUpData {
  id: string;
  name: string;
  description: string | null;
  type: FollowUpType;
  status: FollowUpStatus;
  contactListId: string | null;
  contactListName?: string | null;
  settings: Record<string, unknown>;
  totalEntries: number;
  completedEntries: number;
  createdAt: string;
  updatedAt: string;
  _count?: { entries: number };
  survey?: { id: string; slug: string; responseCount: number } | null;
}

export interface EntryData {
  id: string;
  followUpId: string;
  contactId: string | null;
  assigneeId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  referralSource: string | null;
  status: EntryStatus;
  notes: string | null;
  callDate: string | null;
  nextFollowUp: string | null;
  attempts: number;
  customData: Record<string, unknown>;
  contact?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    imageUrl: string | null;
  } | null;
  assignee?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyData {
  id: string;
  followUpId: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  slug: string;
  isActive: boolean;
  thankYouMessage: string;
  responseCount: number;
  createdAt: string;
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

export const ENTRY_STATUS_CONFIG: Record<EntryStatus, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  CALLED: { label: "Called", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  NO_ANSWER: { label: "No Answer", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  CALLBACK: { label: "Callback", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  NOT_INTERESTED: { label: "Not Interested", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

export const QUESTION_TYPES = [
  { value: "text", label: "Short Text", icon: "Type" },
  { value: "textarea", label: "Long Text", icon: "AlignLeft" },
  { value: "rating", label: "Star Rating", icon: "Star" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "List" },
  { value: "yes_no", label: "Yes / No", icon: "ToggleLeft" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "phone", label: "Phone", icon: "Phone" },
] as const;
