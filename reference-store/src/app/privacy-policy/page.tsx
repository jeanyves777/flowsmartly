import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";
import { Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return <PolicyPage title="Privacy Policy" content={policies.privacy} icon={<Shield size={24} />} lastUpdated="April 2026" />;
}
