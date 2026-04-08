import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";

export default function TermsPage() {
  return <PolicyPage title="Terms & Conditions" content={policies.terms} />;
}
