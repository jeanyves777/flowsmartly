import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";
import { RotateCcw } from "lucide-react";

export default function ReturnPolicyPage() {
  return <PolicyPage title="Return Policy" content={policies.returns} icon={<RotateCcw size={24} />} lastUpdated="April 2026" related={[{ href: "/shipping-policy", label: "Shipping Policy" }, { href: "/privacy-policy", label: "Privacy Policy" }, { href: "/terms", label: "Terms & Conditions" }]} />;
}
