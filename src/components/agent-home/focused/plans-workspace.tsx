"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { InlineUpgrade } from "@/components/payments/inline-upgrade";

/**
 * Plans — a native /home surface for choosing/upgrading the subscription plan,
 * replacing the legacy /settings/upgrade route. Reuses the proven InlineUpgrade
 * component (plan cards + inline Stripe payment + 3DS + add-card) wrapped in the
 * new-design shell. The final charge is handled securely by Stripe.
 * [[new-design-no-legacy]]
 */

interface PlanData { id: string; name: string; monthlyCredits: number; priceCentsMonthly: number; priceCentsYearly: number; features: string[]; }
interface PaymentMethod { id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean; }

export function FocusedPlans({ refreshKey, onBack }: { refreshKey?: number; onBack?: () => void }) {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [currentPlan, setCurrentPlan] = useState("STARTER");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMethods = useCallback(async (): Promise<PaymentMethod[]> => {
    const j = await fetch("/api/payments/methods").then((r) => r.json()).catch(() => null);
    const list = j?.success && Array.isArray(j.data?.paymentMethods) ? (j.data.paymentMethods as PaymentMethod[]) : [];
    setMethods(list);
    return list;
  }, []);

  const load = useCallback(async () => {
    const [pk, prof] = await Promise.all([
      fetch("/api/payments/packages").then((r) => r.json()).catch(() => null),
      fetch("/api/users/profile").then((r) => r.json()).catch(() => null),
    ]);
    await loadMethods();
    if (pk?.success && Array.isArray(pk.data?.plans)) setPlans(pk.data.plans as PlanData[]);
    const plan = prof?.data?.user?.plan;
    if (plan) setCurrentPlan(plan);
  }, [loadMethods]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading plans…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" aria-label="Back to billing"><ChevronLeft className="h-4 w-4" /></button>
          )}
          <div>
            <h2 className="text-[18px] font-extrabold leading-tight">Choose your plan</h2>
            <p className="text-[13px] text-muted-foreground">More monthly credits and features. Securely processed by Stripe — cancel anytime.</p>
          </div>
        </div>
        <InlineUpgrade
          plans={plans}
          currentPlan={currentPlan}
          paymentMethods={methods}
          onUpgradeSuccess={load}
          onPaymentMethodsChanged={loadMethods}
        />
      </div>
    </div>
  );
}
