import type { Metadata } from "next";
import { generateCsrfToken, getCurrentUser } from "@/lib/auth";
import { listConfiguredProviders } from "@/lib/oauth";
import { SignupForm } from "./signup-form";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "sign up — vainie",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const current = await getCurrentUser();
  if (current) redirect("/");

  const csrf = await generateCsrfToken();
  const providers = listConfiguredProviders();

  return (
    <div className="container-tight py-16 md:py-24">
      <div className="max-w-sm mx-auto animate-fade-up">
        <div className="eyebrow mb-6">sign up</div>
        <h1 className="text-4xl font-semibold tracking-tight">
          make an <span className="text-accent-light">account</span>.
        </h1>
        <p className="text-muted text-sm mt-3">
          totally optional — you can also comment anonymously.
        </p>

        <SignupForm csrf={csrf} providers={providers} />

        <p className="mt-6 text-sm text-muted">
          already have one?{" "}
          <a href="/login" className="link-accent font-medium">log in →</a>
        </p>
      </div>
    </div>
  );
}
