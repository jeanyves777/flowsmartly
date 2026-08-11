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

export type DataFormType = "STANDARD" | "SMART_COLLECT" | "ATTENDANCE";

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
  type: DataFormType;
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

// Fields that Smart Collect checks on a contact for completeness
export const SMART_COLLECT_FIELDS = [
  { key: "imageUrl", label: "Profile Photo", type: "photo" as const },
  { key: "lastName", label: "Last Name", type: "text" as const },
  { key: "email", label: "Email", type: "email" as const },
  { key: "phone", label: "Phone", type: "phone" as const },
  { key: "birthday", label: "Birthday (MM-DD)", type: "text" as const },
  { key: "address", label: "Address", type: "text" as const },
  { key: "city", label: "City", type: "text" as const },
  { key: "state", label: "State", type: "text" as const },
] as const;

export interface DataFormSubmissionData {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentPhone: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Self-entry forms (Smart Collect / Attendance)
// ---------------------------------------------------------------------------
// These forms used to carry no field definitions at all: the public page looked
// the respondent up by name and prefilled from the owner's contact records.
// That lookup is closed, so respondents type their own details — and the
// details have to be REAL form fields, because the owner's submissions view
// renders answers by iterating `form.fields`. A form with no definitions shows
// no answers, however much was collected.
//
// The ids deliberately match Contact columns so a submission maps into a
// contact without guesswork.
//
// The two consent fields are the only basis on which a marketing opt-in may be
// set. Handing over an address is not agreement to be marketed to; ticking a
// box that says so is. Nothing infers consent from the presence of a value.
export const SELF_ENTRY_CONSENT_EMAIL_ID = "consent_email";
export const SELF_ENTRY_CONSENT_SMS_ID = "consent_sms";

// The exact affirmative each consent box records. Consent is evidence of a
// specific act, so the stored answer has to BE that act — not merely be
// present. A submission is a public API payload: the browser builds these
// arrays correctly, but the server cannot take the browser's word for it.
export const SELF_ENTRY_EMAIL_CONSENT_VALUE = "Yes, send me email updates";
export const SELF_ENTRY_SMS_CONSENT_VALUE = "Yes, send me text updates";

/**
 * Whether a ticked SMS box is, by itself, sufficient authority to set
 * `smsOptedIn`. It is not, yet: compliance has not cleared the disclosure copy
 * the respondent is agreeing to, and A2P consent has requirements beyond a
 * tick. Until it is cleared, the answer is PRESERVED as submitted evidence and
 * never promoted into an opt-in.
 *
 * Flip this only alongside a compliance sign-off on the copy in
 * SELF_ENTRY_FORM_FIELDS.
 */
export const SMS_CONSENT_IS_AUTHORITATIVE = false;

export const SELF_ENTRY_FORM_FIELDS: DataFormField[] = [
  { id: "firstName", type: "text", label: "First name", required: true },
  { id: "lastName", type: "text", label: "Last name", required: true },
  {
    id: "email",
    type: "email",
    label: "Email",
    required: false,
    helpText: "So we can reach you. Enter an email or a phone number.",
  },
  { id: "phone", type: "phone", label: "Phone", required: false },
  {
    id: "birthday",
    type: "text",
    label: "Birthday",
    required: false,
    placeholder: "MM-DD (e.g. 08-15)",
  },
  { id: "address", type: "text", label: "Address", required: false },
  { id: "city", type: "text", label: "City", required: false },
  { id: "state", type: "text", label: "State", required: false },
  {
    id: SELF_ENTRY_CONSENT_EMAIL_ID,
    type: "checkbox",
    label: "Email updates",
    required: false,
    options: [SELF_ENTRY_EMAIL_CONSENT_VALUE],
  },
  {
    id: SELF_ENTRY_CONSENT_SMS_ID,
    type: "checkbox",
    label: "Text updates",
    required: false,
    options: [SELF_ENTRY_SMS_CONSENT_VALUE],
  },
];

/**
 * True only when the named field carries the EXACT affirmative it claims to
 * represent.
 *
 * "Is something there?" is not evidence — `["no"]`, `["banana"]` and `[""]` are
 * all answers, and none of them is agreement. Nor does an affirmative under one
 * field prove the other: the email wording submitted under `consent_sms` is not
 * SMS consent.
 */
export function hasConsentEvidence(
  data: Record<string, unknown>,
  fieldId: string,
  expectedValue: string
): boolean {
  const value = data[fieldId];
  if (!Array.isArray(value)) return false;
  return value.some((entry) => typeof entry === "string" && entry === expectedValue);
}

/** The respondent ticked the email box, exactly. */
export function hasEmailConsent(data: Record<string, unknown>): boolean {
  return hasConsentEvidence(
    data,
    SELF_ENTRY_CONSENT_EMAIL_ID,
    SELF_ENTRY_EMAIL_CONSENT_VALUE
  );
}

/**
 * The respondent ticked the SMS box, exactly. This is EVIDENCE of what was
 * submitted; see SMS_CONSENT_IS_AUTHORITATIVE for whether it may set an opt-in.
 * The two questions are deliberately separate.
 */
export function hasSmsConsent(data: Record<string, unknown>): boolean {
  return hasConsentEvidence(
    data,
    SELF_ENTRY_CONSENT_SMS_ID,
    SELF_ENTRY_SMS_CONSENT_VALUE
  );
}
