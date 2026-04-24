import { redirect } from "next/navigation";
import { getCurrentUser, generateCsrfToken } from "@/lib/auth";
import { PostEditor } from "@/components/post-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "new post — vainie",
  robots: { index: false, follow: false },
};

export default async function NewPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const csrf = await generateCsrfToken();

  return (
    <div className="container-x py-12 md:py-16">
      <PostEditor mode="create" csrf={csrf} />
    </div>
  );
}
