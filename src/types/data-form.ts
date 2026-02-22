export type DataFormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "radio"
  | "url"
  | "address";

export interface DataFormField {
  id: string;
  type: DataFormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select, radio, checkbox
  helpText?: string;
}

export const FIELD_TYPES: { value: DataFormFieldType; label: string; icon: string }[] = [
  { value: "text", label: "Short Text", icon: "Type" },
  { value: "textarea", label: "Long Text", icon: "AlignLeft" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "phone", label: "Phone", icon: "Phone" },
  { value: "number", label: "Number", icon: "Hash" },
  { value: "date", label: "Date", icon: "Calendar" },
  { value: "select", label: "Dropdown", icon: "ChevronDown" },
  { value: "checkbox", label: "Checkboxes", icon: "CheckSquare" },
  { value: "radio", label: "Radio Buttons", icon: "Circle" },
  { value: "url", label: "URL", icon: "Link" },
  { value: "address", label: "Address", icon: "MapPin" },
];

export type DataFormStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export const FORM_STATUS_CONFIG: Record<
  DataFormStatus,
  { label: string; color: string }
> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  CLOSED: { label: "Closed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export interface DataFormData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  fields: DataFormField[];
  slug: string;
  status: DataFormStatus;
  thankYouMessage: string;
  responseCount: number;
  settings: Record<string, unknown>;
  contactListId: string | null;
  contactListName?: string | null;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataFormSubmissionData {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentPhone: string | null;
  createdAt: string;
}
