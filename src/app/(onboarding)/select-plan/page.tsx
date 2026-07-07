import { redirect } from "next/navigation";

// Legacy plan-selection step is retired. New accounts start on the free tier and
// pick a paid plan later from the new-design surface at /home/plans.
// [[new-design-no-legacy]]
export default function SelectPlanPage() {
  redirect("/home/plans");
}
