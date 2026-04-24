import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-tight py-32 text-center animate-fade-up">
      <p className="font-mono text-sm text-accent mb-6">404</p>
      <h1 className="text-3xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
        this page doesn&apos;t exist.
      </h1>
      <p className="text-muted mt-6 max-w-md mx-auto">
        or it used to, and i broke it. either way, it&apos;s not here.
      </p>
      <div className="mt-10 flex gap-3 justify-center">
        <Link href="/" className="btn-primary">
          back home
        </Link>
        <Link href="/projects" className="btn-ghost">
          see projects
        </Link>
      </div>
    </div>
  );
}
