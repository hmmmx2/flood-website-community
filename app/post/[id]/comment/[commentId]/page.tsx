import { redirect } from "next/navigation";

export default async function CommentPermalink({
  params,
}: {
  params: Promise<{ id: string; commentId: string }>;
}) {
  const { id, commentId } = await params;
  redirect(`/post/${id}#comment-${commentId}`);
}
