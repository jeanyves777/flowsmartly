/**
 * Merge Tag definitions — client-safe (no Node.js dependencies)
 * Used by both server-side replaceMergeTags() and client-side UI components
 */

// All supported merge tags grouped by category
export const MERGE_TAGS = [
  // Contact Info
  { tag: "{{firstName}}", label: "First Name", category: "Contact" },
  { tag: "{{lastName}}", label: "Last Name", category: "Contact" },
  { tag: "{{name}}", label: "Full Name", category: "Contact" },
  { tag: "{{email}}", label: "Email", category: "Contact" },
  { tag: "{{phone}}", label: "Phone", category: "Contact" },
  { tag: "{{company}}", label: "Company", category: "Contact" },
  { tag: "{{contactPhoto}}", label: "Contact Photo", category: "Contact" },
  // Location
  { tag: "{{city}}", label: "City", category: "Contact" },
  { tag: "{{state}}", label: "State", category: "Contact" },
  // Dates
  { tag: "{{birthday}}", label: "Birthday", category: "Dates" },
  { tag: "{{signupDate}}", label: "Signup Date", category: "Dates" },
  { tag: "{{daysAsClient}}", label: "Days as Client", category: "Dates" },
  // Business
  { tag: "{{planName}}", label: "Plan Name", category: "Business" },
  { tag: "{{lastLogin}}", label: "Last Login", category: "Business" },
  // Links
  { tag: "{{couponCode}}", label: "Coupon Code", category: "Links" },
  { tag: "{{referralLink}}", label: "Referral Link", category: "Links" },
  { tag: "{{unsubscribeLink}}", label: "Unsubscribe Link", category: "Links" },
] as const;

export type MergeTagCategory = "Contact" | "Dates" | "Business" | "Links";
