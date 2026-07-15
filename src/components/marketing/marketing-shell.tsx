import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Forces the cinematic dark marketing look regardless of the user's app theme.
 * Tokens come from the `.dark` CSS variable set; Tailwind `dark:` variants fire
 * for descendants via the project's darkMode selector.
 */
export function MarketingShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dark min-h-screen bg-background text-foreground antialiased",
        "selection:bg-brand-500/30 selection:text-white",
        className,
      )}
    >
      {children}
    </div>
  );
}
