import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";

export default function ShippingPolicyPage() {
  return <PolicyPage title="Shipping Policy" content={policies.shipping} />;
}
