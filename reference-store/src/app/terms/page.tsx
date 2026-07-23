import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";
import { FileText } from "lucide-react";

export default function TermsPage() {
  return <PolicyPage title="Terms & Conditions" content={policies.terms} icon={<FileText size={24} />} lastUpdated="April 2026" related={[{ href: "/shipping-policy", label: "Shipping Policy" }, { href: "/return-policy", label: "Return Policy" }, { href: "/privacy-policy", label: "Privacy Policy" }]} />;
}
