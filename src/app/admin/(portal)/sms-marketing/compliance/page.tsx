import { redirect } from "next/navigation";

// Folded into the central SMS console — kept as a redirect so old links resolve.
export default function ComplianceRedirect() {
  redirect("/admin/sms-marketing?tab=compliance");
}
