import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCustomerToken } from "@/lib/store/customer-auth";
import { prisma } from "@/lib/db/client";

interface AccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StoreAccountLayout({ children, params }: AccountLayoutProps) {
  const { slug } = await params;

  // Detect auth pages from the URL path.
  // Try multiple header sources: Next.js internal headers, then x-url from nginx.
  // Fallback: check the referer which is more reliable across deployments.
  const headersList = await headers();
  const url =
    headersList.get("x-invoke-path") ||
    headersList.get("x-matched-path") ||
    headersList.get("x-url") ||
    headersList.get("x-nextjs-data") ||
    headersList.get("referer") ||
    "";

  const isAuthPage = url.includes("/login") || url.includes("/register") || url.includes("/complete-profile");

  // Auth pages (login/register/complete-profile) don't need session verification
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
