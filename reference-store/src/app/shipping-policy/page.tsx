import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";
import { Truck } from "lucide-react";

export default function ShippingPolicyPage() {
  return <PolicyPage title="Shipping Policy" content={policies.shipping} icon={<Truck size={24} />} lastUpdated="April 2026" related={[{ href: "/return-policy", label: "Return Policy" }, { href: "/privacy-policy", label: "Privacy Policy" }, { href: "/terms", label: "Terms & Conditions" }]} />;
}
