// SERVER component. Next 15 provides dynamic params as a Promise, so resolve
// them before passing to the client component.

import CategoryClient from "./CategoryClient";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <CategoryClient params={resolvedParams} />;
}
