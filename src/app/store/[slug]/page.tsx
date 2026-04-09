import { redirect } from "next/navigation";

/**
 * /store/{slug} — redirects to the static V2 store at /stores/{slug}.
 * All storefront rendering is handled by the static export served by nginx.
 * This route only exists so old URLs and direct links still work.
 */
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/stores/${slug}`);
}
