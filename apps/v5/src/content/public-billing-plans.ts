/** Presentation of the generated owner-approved public facts; no runtime billing or provider IDs. */
import { BILLING_OFFERS, type BillingOffer } from "./billing-offers";
export interface PublicBillingPlan {
  readonly id: BillingOffer["code"];
  readonly name: string;
  readonly icon: string;
  readonly accent: "brand" | "violet" | "orange";
  readonly price: number;
  readonly yearlyPrice: number;
  readonly credits: string;
  readonly blurb: string;
  readonly features: readonly string[];
  readonly badge?: string;
  readonly featured?: boolean;
}
const common = [
  "Same platform access",
  "Usage quoted in credits",
  "Purchased credits carry over",
];
const presentation: Record<
  BillingOffer["code"],
  Pick<PublicBillingPlan, "icon" | "accent" | "blurb" | "badge" | "featured">
> = {
  free: {
    icon: "rocket",
    accent: "brand",
    blurb: "Use the platform with credits purchased as you need them.",
  },
  personal: {
    icon: "bolt",
    accent: "violet",
    blurb: "A monthly credit allowance for your business work.",
    badge: "Included credits",
    featured: true,
  },
  business: {
    icon: "building",
    accent: "orange",
    blurb: "A larger monthly credit allowance for ongoing business work.",
  },
};
export const PUBLIC_BILLING_PLANS: readonly PublicBillingPlan[] =
  BILLING_OFFERS.map((offer) => ({
    id: offer.code,
    name: offer.code === "free" ? "Free" : offer.name,
    ...presentation[offer.code],
    price: offer.monthlyAmountMinor / 100,
    yearlyPrice: offer.yearlyAmountMinor / 100,
    credits:
      offer.monthlyIncludedCredits === 0
        ? "No monthly credit allocation"
        : `${offer.monthlyIncludedCredits.toLocaleString("en-US")} credits each month`,
    features: [
      ...common,
      offer.code === "free"
        ? "No monthly subscription charge"
        : "Included credits reset monthly",
    ],
  }));
export const PUBLIC_ANNUAL_SUMMARY = PUBLIC_BILLING_PLANS.filter(
  (plan) => plan.price > 0,
)
  .map(
    (plan) => `${plan.name} $${plan.yearlyPrice.toLocaleString("en-US")}/year`,
  )
  .join(" · ");
