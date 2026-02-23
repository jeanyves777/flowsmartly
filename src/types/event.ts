import { DataFormField } from "./data-form";

export type EventStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";
export type RegistrationType = "rsvp" | "form" | "booking";
export type TicketType = "free" | "paid";
export type RegistrationStatus = "registered" | "attended" | "cancelled" | "waitlisted";
export type RsvpResponse = "attending" | "not_attending" | "maybe";
export type TicketOrderStatus = "PENDING" | "COMPLETED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  CLOSED: { label: "Closed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  CANCELLED: { label: "Cancelled", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

export const REGISTRATION_TYPE_CONFIG: Record<RegistrationType, { label: string; description: string }> = {
  rsvp: { label: "RSVP", description: "Simple attend / maybe / not attending" },
  form: { label: "Form", description: "Custom registration form with fields" },
  booking: { label: "Booking", description: "Book a spot with optional ticket pricing" },
};

export const RSVP_CONFIG: Record<RsvpResponse, { label: string; color: string }> = {
  attending: { label: "Attending", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  maybe: { label: "Maybe", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  not_attending: { label: "Not Attending", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export const REGISTRATION_STATUS_CONFIG: Record<RegistrationStatus, { label: string; color: string }> = {
  registered: { label: "Registered", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  attended: { label: "Attended", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  waitlisted: { label: "Waitlisted", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
};

export const TICKET_ORDER_STATUS_CONFIG: Record<TicketOrderStatus, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  REFUNDED: { label: "Refunded", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  PARTIALLY_REFUNDED: { label: "Partial Refund", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

export type TicketStyle = "classic" | "modern" | "elegant";

export const TICKET_STYLES: { value: TicketStyle; label: string; description: string }[] = [
  { value: "classic", label: "Classic", description: "Clean white ticket with bold typography" },
  { value: "modern", label: "Modern", description: "Gradient design with vibrant colors" },
  { value: "elegant", label: "Elegant", description: "Dark premium design with gold accents" },
];

export interface EventSettings {
  thankYouMessage?: string;
  requireApproval?: boolean;
  showCapacity?: boolean;
  ticketStyle?: TicketStyle;
}

export interface EventData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  slug: string;
  eventDate: string;
  endDate: string | null;
  timezone: string;
  venueName: string | null;
  venueAddress: string | null;
  isOnline: boolean;
  onlineUrl: string | null;
  coverImageUrl: string | null;
  mediaUrls: string[];
  registrationType: RegistrationType;
  registrationFields: DataFormField[];
  capacity: number | null;
  registrationCount: number;
  ticketType: TicketType;
  ticketPrice: number | null;
  ticketName: string | null;
  platformFeePercent: number;
  totalRevenueCents: number;
  totalRefundedCents: number;
  status: EventStatus;
  settings: EventSettings;
  contactListId: string | null;
  contactListName?: string | null;
  sendCount: number;
  lastSentAt: string | null;
  landingPageId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    registrations: number;
    ticketOrders: number;
  };
}

export interface EventRegistrationData {
  id: string;
  eventId: string;
  contactId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: RegistrationStatus;
  rsvpResponse: RsvpResponse | null;
  formData: Record<string, unknown>;
  ticketCode: string;
  ticketOrderId: string | null;
  createdAt: string;
}

export interface TicketOrderData {
  id: string;
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  platformFeeCents: number;
  organizerAmountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  status: TicketOrderStatus;
  refundedAmountCents: number;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
