import { cookies } from "next/headers";
import { verifyCustomerToken } from "@/lib/store/customer-auth";
import { prisma } from "@/lib/db/client";

interface AccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Account layout — renders children directly.
 *
 * Auth protection is handled by individual pages, NOT this layout.
 * Previous approach tried to detect login/register pages via headers,
 * but Next.js 15 App Router doesn't reliably expose the URL path in
 * server component headers, causing infinite redirect loops.
 *
 * Instead: each protected page (orders, wishlist, settings, etc.)
 * checks auth itself. Login/register pages render without auth check.
 * The account dashboard page.tsx handles the redirect to login.
 */
export default async function StoreAccountLayout({ children, params }: AccountLayoutProps) {
  // Just render children — auth is handled per-page
  return <>{children}</>;
}
