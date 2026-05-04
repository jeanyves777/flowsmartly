import {
  BarChart3,
  CalendarDays,
  Globe2,
  Mail,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";

const connectedWorkflows = [
  { label: "AI Studio", icon: Sparkles },
  { label: "Social Calendar", icon: CalendarDays },
  { label: "Email", icon: Mail },
  { label: "SMS", icon: MessageSquare },
  { label: "Storefront", icon: ShoppingBag },
  { label: "Local Listings", icon: Globe2 },
  { label: "Agents", icon: Users },
  { label: "Analytics", icon: BarChart3 },
];

export function ProofStripSection() {
  return (
    <section className="relative z-10 border-y bg-white px-4 pb-4 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[260px_1fr] lg:items-end">
        <div>
          <p className="text-sm font-bold text-foreground">One connected growth stack</p>
          <p className="mt-1 text-sm text-muted-foreground">
            AI content, channels, commerce, listings, people, and reporting.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {connectedWorkflows.map((item) => (
            <div
              key={item.label}
              className="flex min-h-16 flex-col items-center justify-center rounded-lg border bg-zinc-50 p-2.5 text-center text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <item.icon className="mb-2 h-5 w-5 text-brand-600 dark:text-brand-300" />
              <span className="text-xs font-semibold leading-5">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
