import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";

export default function PrivacyPolicyPage() {
  return <PolicyPage title="Privacy Policy" content={policies.privacy} />;
}
