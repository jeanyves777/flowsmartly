import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";

export default function ReturnPolicyPage() {
  return <PolicyPage title="Return Policy" content={policies.returns} />;
}
