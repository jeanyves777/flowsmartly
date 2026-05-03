import Image from "next/image";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const publicImages = {
  homeHero: "/marketing/flowsmartly-studio-team.jpg",
  studioTeam: "/marketing/flowsmartly-studio-team.jpg",
  flowshop: "/marketing/flowsmartly-flowshop.jpg",
  localBusiness: "/marketing/flowsmartly-listsmartly.jpg",
  phoneCreator: "/marketing/flowsmartly-view-to-earn.jpg",
  compliance: "/marketing/flowsmartly-compliance.jpg",
  pricing: "/marketing/flowsmartly-pricing.jpg",
  marketplace: "/marketing/flowsmartly-marketplace.jpg",
};

export const illustrationImages = {
  aiAssistant: "/marketing/transparent/flowsmartly-ai-assistant-cutout.png",
  growthDashboard: "/marketing/transparent/flowsmartly-dashboard-cutout.png",
  launchApproval: "/marketing/transparent/flowsmartly-approval-cutout.png",
  humanMarketer: "/marketing/transparent/flowsmartly-human-marketer-cutout.png",
  humanCreator: "/marketing/transparent/flowsmartly-human-creator-cutout.png",
  humanCreatorLady: "/marketing/transparent/flowsmartly-human-creator-lady-cutout.png",
  homeCampaignManager: "/marketing/transparent/flowsmartly-home-campaign-manager.png",
  homeFlowShopSeller: "/marketing/transparent/flowsmartly-home-flowshop-seller.png",
  homeLocalOwner: "/marketing/transparent/flowsmartly-home-local-owner.png",
  homeMessagingManager: "/marketing/transparent/flowsmartly-home-messaging-manager.png",
  homeAgentConsultant: "/marketing/transparent/flowsmartly-home-agent-consultant.png",
  homePlatformOperator: "/marketing/transparent/flowsmartly-home-platform-operator.png",
  flowShopPageMerchant: "/marketing/transparent/flowsmartly-flowshop-page-merchant.png",
  listSmartlyPageOwner: "/marketing/transparent/flowsmartly-listsmartly-page-owner.png",
  marketplacePageAgent: "/marketing/transparent/flowsmartly-marketplace-page-agent.png",
  viewToEarnPageCreator: "/marketing/transparent/flowsmartly-view-to-earn-page-creator.png",
  pricingPageOperator: "/marketing/transparent/flowsmartly-pricing-page-operator.png",
  compliancePageAdvisor: "/marketing/transparent/flowsmartly-compliance-page-advisor.png",
  policyPrivacy: "/marketing/transparent/flowsmartly-policy-privacy.png",
  policyTerms: "/marketing/transparent/flowsmartly-policy-terms.png",
  policyGdpr: "/marketing/transparent/flowsmartly-policy-gdpr.png",
  policySms: "/marketing/transparent/flowsmartly-policy-sms.png",
  policyEcommerce: "/marketing/transparent/flowsmartly-policy-ecommerce.png",
};

export const portraitImages = {
  sarah:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
  james:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
  maria:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80",
  priya:
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=256&q=80",
  david:
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80",
  alex:
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=256&q=80",
};

function isLocalMarketingAsset(image: string) {
  return image.startsWith("/marketing/");
}

function isTransparentMarketingAsset(image: string) {
  return image.startsWith("/marketing/transparent/");
}

type PublicImageHeroProps = {
  eyebrow: string;
  icon?: LucideIcon;
  title: ReactNode;
  description: string;
  image: string;
  imageAlt: string;
  children?: ReactNode;
  stats?: Array<{ value: string; label: string }>;
  className?: string;
};

export function PublicImageHero({
  eyebrow,
  icon: Icon = Sparkles,
  title,
  description,
  image,
  imageAlt,
  children,
  stats,
  className,
}: PublicImageHeroProps) {
  const useStaticAsset = isLocalMarketingAsset(image);

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden bg-background px-4 pt-28 pb-16 text-foreground sm:px-6 sm:pt-32 sm:pb-20 lg:px-8 dark:bg-slate-950 dark:text-white",
        className
      )}
    >
      <Image
        src={image}
        alt={imageAlt}
        fill
        priority
        sizes="100vw"
        unoptimized={useStaticAsset}
        className="absolute inset-0 -z-20 object-cover opacity-30 dark:opacity-100"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.88)_45%,rgba(255,255,255,0.35)_100%)] dark:bg-[linear-gradient(90deg,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.72)_45%,rgba(2,6,23,0.34)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-sm font-medium shadow-sm backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white">
            <Icon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl dark:text-slate-200">
            {description}
          </p>
          {children && <div className="mt-8">{children}</div>}
        </div>

        {stats && stats.length > 0 && (
          <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-border bg-card/85 px-4 py-3 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground dark:text-slate-200">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type VisualStoryPanelProps = {
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Array<{ value: string; label: string }>;
  reverse?: boolean;
};

export function VisualStoryPanel({
  image,
  imageAlt,
  eyebrow,
  title,
  description,
  metrics = [],
  reverse = false,
}: VisualStoryPanelProps) {
  const useStaticAsset = isLocalMarketingAsset(image);

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
      <div className={cn("relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted", reverse && "lg:order-2")}>
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          unoptimized={useStaticAsset}
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/86 to-transparent p-5 text-white">
          <div className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            Live customer workflow
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-300">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          {description}
        </p>
        {metrics.length > 0 && (
          <div className="mt-8 grid grid-cols-3 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-card p-4">
                <div className="text-xl font-bold">{metric.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type MarketingIllustrationCardProps = {
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

export function MarketingIllustrationCard({
  image,
  imageAlt,
  eyebrow,
  title,
  description,
  className,
}: MarketingIllustrationCardProps) {
  const transparentAsset = isTransparentMarketingAsset(image);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-lg",
        className
      )}
    >
      <div
        className={cn(
          "relative aspect-[16/10]",
          transparentAsset
            ? "bg-[radial-gradient(circle_at_50%_35%,rgba(125,211,252,0.28),rgba(255,255,255,0.95)_52%,rgba(248,250,252,1)_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.22),rgba(24,24,27,0.92)_56%,rgba(9,9,11,1)_100%)]"
            : "bg-muted"
        )}
      >
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          unoptimized={isLocalMarketingAsset(image)}
          className={cn(transparentAsset ? "object-contain p-5" : "object-cover")}
        />
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function PortraitAvatar({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-muted", className)}>
      <Image src={src} alt={alt} fill sizes="96px" className="object-cover" />
    </div>
  );
}

type PolicyVisualHeaderProps = {
  label: string;
  title: string;
  updated: string;
  description: string;
  image?: string;
};

export function PolicyVisualHeader({
  label,
  title,
  updated,
  description,
  image = publicImages.compliance,
}: PolicyVisualHeaderProps) {
  const useStaticAsset = isLocalMarketingAsset(image);
  const transparentAsset = isTransparentMarketingAsset(image);

  if (transparentAsset) {
    return (
      <div className="relative mb-10 overflow-hidden rounded-lg border bg-card p-6 text-foreground shadow-sm sm:p-8 dark:bg-zinc-950 dark:text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.10),rgba(16,185,129,0.10),rgba(255,255,255,0.74))] dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(16,185,129,0.08),rgba(9,9,11,0.96))]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm dark:bg-white/10 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              {label}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground dark:text-slate-300">{updated}</p>
            <p className="mt-5 text-base leading-7 text-muted-foreground dark:text-slate-200">
              {description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground dark:text-slate-200">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                Clear obligations
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-500 dark:text-sky-300" />
                Built for operators
              </span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-300" />
                Plain-language guidance
              </span>
            </div>
          </div>
          <div className="relative min-h-[220px] overflow-visible">
            <Image
              src={image}
              alt=""
              fill
              sizes="280px"
              unoptimized={useStaticAsset}
              className="object-contain drop-shadow-[0_24px_50px_rgba(15,23,42,0.18)] dark:drop-shadow-[0_24px_50px_rgba(0,0,0,0.38)]"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-10 overflow-hidden rounded-lg border bg-card p-6 text-foreground sm:p-8 dark:bg-slate-950 dark:text-white">
      <Image
        src={image}
        alt=""
        fill
        sizes="(min-width: 1024px) 900px, 100vw"
        unoptimized={useStaticAsset}
        className="object-cover opacity-[0.18] dark:opacity-28"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(255,255,255,0.82))] dark:bg-[linear-gradient(90deg,rgba(2,6,23,0.92),rgba(2,6,23,0.68))]" />
      <div className="relative max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground dark:bg-white/10 dark:text-slate-100">
          <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          {label}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground dark:text-slate-300">{updated}</p>
        <p className="mt-5 text-base leading-7 text-muted-foreground dark:text-slate-200">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground dark:text-slate-200">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            Clear obligations
          </span>
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-300" />
            Built for operators
          </span>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            Plain-language guidance
          </span>
        </div>
      </div>
    </div>
  );
}
