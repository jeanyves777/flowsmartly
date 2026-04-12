import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyCustomerToken } from "@/lib/store/customer-auth";
import { prisma } from "@/lib/db/client";

interface AccountPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StoreAccountPage({ params }: AccountPageProps) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("sc_session")?.value;
  if (!token) redirect(`/store/${slug}/account/login`);

  const payload = await verifyCustomerToken(token);
  if (!payload) redirect(`/store/${slug}/account/login`);

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, currency: true },
  });
  if (!store || payload.storeId !== store.id) redirect(`/store/${slug}/account/login`);

  // Fetch customer + recent orders in parallel
  const [customer, recentOrders] = await Promise.all([
    prisma.storeCustomer.findUnique({
      where: { id: payload.customerId },
      select: { name: true, email: true, addresses: true },
    }),
    prisma.order.findMany({
      where: { storeId: store.id, customerEmail: payload.email },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  if (!customer) redirect(`/store/${slug}/account/login`);

  let addressCount = 0;
  try {
    const parsed = JSON.parse(customer.addresses || "[]");
    addressCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    addressCount = 0;
  }

  const currency = store.currency || "USD";

  function formatMoney(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  }

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PROCESSING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    SHIPPED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    REFUNDED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold"
          style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
        >
          Welcome back, {customer.name.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-sm opacity-60">{customer.email}</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Link
          href={`/store/${slug}/account/orders`}
          className="block rounded-lg border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">My Orders</p>
              <p className="text-xs opacity-50">{recentOrders.length} recent</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/store/${slug}/account/wishlist`}
          className="block rounded-lg border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: "var(--store-primary)" }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Wishlist</p>
              <p className="text-xs opacity-50">Saved favorites</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/store/${slug}/account/saved`}
          className="block rounded-lg border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: "var(--store-primary)" }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Saved for Later</p>
              <p className="text-xs opacity-50">Items to buy later</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/store/${slug}/account/addresses`}
          className="block rounded-lg border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Addresses</p>
              <p className="text-xs opacity-50">{addressCount} saved</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/store/${slug}/account/settings`}
          className="block rounded-lg border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Settings</p>
              <p className="text-xs opacity-50">Profile &amp; password</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            Recent Orders
          </h2>
          <Link
            href={`/store/${slug}/account/orders`}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--store-primary)" }}
          >
            View all
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div
            className="rounded-lg border p-8 text-center"
            style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
          >
            <p className="opacity-50">No orders yet</p>
            <Link
              href={`/store/${slug}/products`}
              className="inline-block mt-3 text-sm font-medium hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "color-mix(in srgb, var(--store-text) 4%, transparent)" }}>
                    <th className="text-left px-4 py-3 font-medium opacity-70">Order</th>
                    <th className="text-left px-4 py-3 font-medium opacity-70">Date</th>
                    <th className="text-left px-4 py-3 font-medium opacity-70">Total</th>
                    <th className="text-left px-4 py-3 font-medium opacity-70">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--store-text) 8%, transparent)" }}>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:opacity-80 transition-opacity">
                      <td className="px-4 py-3">
                        <Link
                          href={`/store/${slug}/account/orders/${order.id}`}
                          className="font-medium hover:underline"
                          style={{ color: "var(--store-primary)" }}
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 opacity-60">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatMoney(order.totalCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="mt-8 pt-6" style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
        <form action={`/api/store/${slug}/auth/logout`} method="POST">
          <button
            type="submit"
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
