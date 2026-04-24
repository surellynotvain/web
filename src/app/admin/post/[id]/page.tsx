import { redirect, notFound } from "next/navigation";
import { getCurrentUser, generateCsrfToken } from "@/lib/auth";
import { getPostByIdForEdit } from "@/lib/blog";
import { PostEditor } from "@/components/post-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "edit post — vainie",
  robots: { index: false, follow: false },
};

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const { id } = await params;
  const post = await getPostByIdForEdit(id);
  if (!post) notFound();

  const csrf = await generateCsrfToken();

  return (
    <div className="container-x py-12 md:py-16">
      <PostEditor
        mode="edit"
        csrf={csrf}
        initial={{
          id: post.id,
          title: post.title,
          excerpt: post.excerpt ?? "",
          content: post.content,
          coverUrl: post.coverUrl ?? "",
          published: Boolean(post.published),
          slug: post.slug,
        }}
      />
    </div>
  );
}
