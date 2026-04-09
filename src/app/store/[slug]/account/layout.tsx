import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCustomerToken } from "@/lib/store/customer-auth";
import { prisma } from "@/lib/db/client";

interface AccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StoreAccountLayout({ children, params }: AccountLayoutProps) {
  const { slug } = await params;

  // Auth pages (login/register) don't need session verification
  // We check the cookie name to detect path — Next.js doesn't expose pathname in layouts,
  // so we rely on the route group structure. Login/register are nested routes that render
  // directly without auth check.
  // Actually, we use headers to get the URL path.
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const url = headersList.get("x-invoke-path") || headersList.get("x-matched-path") || headersList.get("x-url") || "";

  const isAuthPage = url.includes("/login") || url.includes("/register");

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Protected pages: verify JWT
  const cookieStore = await cookies();
  const token = cookieStore.get("sc_session")?.value;

  if (!token) {
    redirect(`/store/${slug}/account/login`);
  }

  const payload = await verifyCustomerToken(token);
  if (!payload) {
    redirect(`/store/${slug}/account/login`);
  }

  // Verify the store exists and token belongs to it
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!store || payload.storeId !== store.id) {
    redirect(`/store/${slug}/account/login`);
  }

  return <>{children}</>;
}
