import { redirect } from "next/navigation";

export default async function LegacyPostsPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  redirect(`/post/${encodeURIComponent(postId)}`);
}
