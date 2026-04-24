import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, generateCsrfToken } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "settings — vainie",
  description: "your account preferences and data controls.",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  const csrf = await generateCsrfToken();

  return (
    <div className="container-tight py-12 md:py-16 animate-fade-up">
      <div className="eyebrow mb-5">settings</div>
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        your <span className="text-accent-light">data</span>, your call.
      </h1>
      <p className="text-muted mt-5 max-w-2xl leading-relaxed">
        signed in as <b>@{user.username}</b>. use this page to control what
        vainie.pl remembers about you, and to export or delete it.
      </p>

      <SettingsForm
        csrf={csrf}
        initial={{
          username: user.username,
          email: user.email ?? "",
          allowAiTraining: user.allowAiTraining ?? false,
        }}
      />

      <p className="mt-10 text-[11px] font-mono text-subtle">
        see also: <Link href="/privacy" className="link-accent">privacy policy</Link> ·{" "}
        <Link href="/credits" className="link-accent">credits</Link>
      </p>
    </div>
  );
}
