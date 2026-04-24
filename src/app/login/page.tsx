import type { Metadata } from "next";
import { generateCsrfToken } from "@/lib/auth";
import { listConfiguredProviders } from "@/lib/oauth";
import { LoginForm } from "./login-form";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "log in — vainie",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const current = await getCurrentUser();
  if (current) redirect("/");

  const csrf = await generateCsrfToken();
  const providers = listConfiguredProviders();
  const { error } = await searchParams;

  return (
    <div className="container-tight py-16 md:py-24">
      <div className="max-w-sm mx-auto animate-fade-up">
        <div className="eyebrow mb-6">log in</div>
        <h1 className="text-4xl font-semibold tracking-tight">
          welcome <span className="text-accent-light">back</span>.
        </h1>
        <p className="text-muted text-sm mt-3">
          sign in to comment as yourself, or keep scrolling and comment
          anonymously.
        </p>

        <LoginForm csrf={csrf} errorHint={error} providers={providers} />

        <p className="mt-6 text-sm text-muted">
          don&apos;t have an account?{" "}
          <a href="/signup" className="link-accent font-medium">create one →</a>
        </p>
      </div>
    </div>
  );
}
