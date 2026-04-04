"use client";

import { useState } from "react";
import type { WebsiteBlock, WebsiteTheme, PricingContent } from "@/types/website-builder";
import { Check } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function PricingBlock({ block, theme, isEditing }: Props) {
  const content = block.content as PricingContent;
  const [yearly, setYearly] = useState(false);

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-8 max-w-2xl mx-auto">{content.subheadline}</p>}

      {content.billingToggle && (
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${!yearly ? "text-[var(--wb-text)]" : "text-[var(--wb-text-muted)]"}`}>Monthly</span>
          <button
            onClick={() => !isEditing && setYearly(!yearly)}
            className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? "bg-[var(--wb-primary)]" : "bg-[var(--wb-border)]"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${yearly ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
          <span className={`text-sm font-medium ${yearly ? "text-[var(--wb-text)]" : "text-[var(--wb-text-muted)]"}`}>
            Yearly <span className="text-[var(--wb-primary)] text-xs">Save 20%</span>
          </span>
        </div>
      )}

      <div className={`grid grid-cols-1 ${content.plans.length === 2 ? "md:grid-cols-2 max-w-3xl" : "md:grid-cols-3 max-w-5xl"} gap-8 mx-auto`}>
        {content.plans.map((plan, i) => (
          <div
            key={i}
            className={`relative rounded-2xl p-8 ${
              plan.highlighted
                ? "bg-[var(--wb-primary)] text-white ring-2 ring-[var(--wb-primary)] scale-105 shadow-xl"
                : "bg-[var(--wb-surface)] border border-[var(--wb-border)]"
            }`}
          >
            {plan.badge && (
              <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full ${plan.highlighted ? "bg-white text-[var(--wb-primary)]" : "bg-[var(--wb-primary)] text-white"}`}>
                {plan.badge}
              </span>
            )}
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            {plan.description && <p className={`text-sm mb-4 ${plan.highlighted ? "text-white/80" : "text-[var(--wb-text-muted)]"}`}>{plan.description}</p>}
            <div className="mb-6">
              <span className="text-4xl font-bold">{yearly && plan.yearlyPrice ? plan.yearlyPrice : plan.price}</span>
              {plan.period && <span className={`text-sm ${plan.highlighted ? "text-white/70" : "text-[var(--wb-text-muted)]"}`}>{plan.period}</span>}
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? "text-white" : "text-[var(--wb-primary)]"}`} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href={isEditing ? undefined : plan.cta.href}
              className={`block w-full text-center py-3 rounded-[var(--wb-button-radius)] font-medium transition-all ${
                plan.highlighted
                  ? "bg-white text-[var(--wb-primary)] hover:bg-white/90"
                  : "bg-[var(--wb-primary)] text-white hover:opacity-90"
              }`}
            >
              {plan.cta.text}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
