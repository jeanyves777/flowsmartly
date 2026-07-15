"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

const productOptions = [
  "Create — designs & video",
  "Publish — social calendar",
  "Grow — ads & campaigns",
  "Sell — AI storefront",
  "Outreach — email & SMS",
  "Leads — find & follow up",
  "Full agent walkthrough",
  "Pricing & credits",
];

const companySizes = [
  "Solo operator",
  "2-10 people",
  "11-50 people",
  "51-200 people",
  "200+ people",
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  companySize: string;
  productInterest: string[];
  preferredTime: string;
  timezone: string;
  message: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  role: "",
  companySize: "",
  productInterest: ["AI content studio"],
  preferredTime: "",
  timezone: "",
  message: "",
};

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-sky-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export function BookDemoContent() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const selectedSummary = useMemo(() => {
    if (form.productInterest.length === 0) return "General FlowSmartly walkthrough";
    return form.productInterest.slice(0, 3).join(", ");
  }, [form.productInterest]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleProduct = (option: string) => {
    setForm((current) => {
      const hasOption = current.productInterest.includes(option);
      const next = hasOption
        ? current.productInterest.filter((item) => item !== option)
        : [...current.productInterest, option];

      return { ...current, productInterest: next };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Unable to submit your request.");
      }

      setSubmitted(true);
      setForm(initialForm);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit your request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overflow-x-hidden bg-background text-foreground">
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-sky-50/80 via-background to-background px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 dark:from-slate-950 dark:via-background">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border bg-card/85 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur">
              <CalendarCheck className="h-4 w-4 text-sky-600 dark:text-sky-300" />
              15-minute guided walkthrough
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Book a FlowSmartly demo
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Show us the growth workflow you want to improve and we will tailor the demo around your team, channels, store, listings, and compliance needs.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { value: "1-on-1", label: "workspace review" },
                { value: "15 min", label: "focused walkthrough" },
                { value: "Next step", label: "clear rollout path" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card/80 p-4 shadow-sm">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              {[
                { icon: Sparkles, text: "AI content and campaign planning" },
                { icon: Users, text: "Agent and team workflows" },
                { icon: ShieldCheck, text: "Consent, opt-out, and policy review" },
                { icon: MessageSquare, text: "Email, SMS, social, and commerce paths" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                    <span>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-8 z-10 hidden rounded-lg border bg-card/90 px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur sm:block">
              <Clock3 className="mr-2 inline h-4 w-4 text-emerald-500" />
              Demo fit review
            </div>
            <div className="relative mx-auto aspect-[4/3] max-w-2xl">
              <Image
                src={illustrationImages.pricingPageOperator}
                alt="FlowSmartly operator reviewing a workspace on a tablet"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                unoptimized
                className="object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                What we will cover
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                A practical look at your next growth move
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                The demo starts with your current workflow, then shows the shortest path through the FlowSmartly tools that matter.
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Where AI content, automation, and approvals sit in your process.",
                "How FlowShop, ListSmartly, and campaign tools connect to revenue.",
                "Which plan or credit path fits your first launch.",
                "When an expert agent makes more sense than doing it alone.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Prefer email?</p>
              <Link
                href="mailto:info@flowsmartly.com"
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-300"
              >
                <Mail className="h-4 w-4" />
                info@flowsmartly.com
              </Link>
            </div>
          </aside>

          <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-6 lg:p-8">
            {submitted ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="mt-6 text-3xl font-bold">Demo request received</h2>
                <p className="mt-4 max-w-md text-muted-foreground">
                  Thanks. We have your request and will follow up with demo times that match your workflow.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild>
                    <Link href="/pricing">
                      Review pricing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setSubmitted(false)}>
                    Submit another request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                    Demo request
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">
                    Tell us what to tailor
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected focus: {selectedSummary}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" required>
                    <Input
                      required
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      placeholder="Your name"
                    />
                  </Field>
                  <Field label="Work email" required>
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="you@company.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={form.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        placeholder="+1 555 000 0000"
                        className="pl-10"
                      />
                    </div>
                  </Field>
                  <Field label="Company">
                    <Input
                      value={form.company}
                      onChange={(event) => updateField("company", event.target.value)}
                      placeholder="Company name"
                    />
                  </Field>
                  <Field label="Role">
                    <Input
                      value={form.role}
                      onChange={(event) => updateField("role", event.target.value)}
                      placeholder="Founder, marketer, operator"
                    />
                  </Field>
                  <Field label="Company size">
                    <select
                      value={form.companySize}
                      onChange={(event) => updateField("companySize", event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Select size</option>
                      {companySizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-foreground">
                    Product focus
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {productOptions.map((option) => {
                      const checked = form.productInterest.includes(option);
                      return (
                        <label
                          key={option}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleProduct(option)}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Preferred time">
                    <Input
                      value={form.preferredTime}
                      onChange={(event) => updateField("preferredTime", event.target.value)}
                      placeholder="Weekday mornings, after 2 PM"
                    />
                  </Field>
                  <Field label="Timezone">
                    <Input
                      value={form.timezone}
                      onChange={(event) => updateField("timezone", event.target.value)}
                      placeholder="Eastern, Central, GMT"
                    />
                  </Field>
                </div>

                <Field label="What should we focus on?">
                  <Textarea
                    value={form.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    placeholder="Tell us about your store, campaigns, listings, team, or the main outcome you want."
                    rows={5}
                  />
                </Field>

                {submitError && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                    {submitError}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? "Submitting..." : "Request demo"}
                  {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
