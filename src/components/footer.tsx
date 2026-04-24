import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 md:mt-32 border-t border-default">
      <div className="container-x py-10 md:py-12 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold"
              style={{ background: "rgb(var(--accent))", color: "rgb(var(--bg))" }}
            >
              v
            </span>
            <span className="font-semibold text-[15px]">vainie.pl</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 md:gap-x-10 gap-y-2 text-sm">
          <div className="flex flex-col gap-2">
            <p className="eyebrow mb-1">site</p>
            <Link href="/#about" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">about</Link>
            <Link href="/projects" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">projects</Link>
            <Link href="/blog" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">blog</Link>
            <Link href="/quiz" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">quizzes</Link>
            <Link href="/contact" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">contact</Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="eyebrow mb-1">social</p>
            <a href="https://github.com/surellynotvain" target="_blank" rel="noreferrer" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">github ↗</a>
            <a href="https://www.youtube.com/@surelynotvain" target="_blank" rel="noreferrer" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">youtube ↗</a>
          </div>
          <div className="flex flex-col gap-2 col-span-2 sm:col-span-1">
            <p className="eyebrow mb-1">legal</p>
            <Link href="/privacy" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">privacy &amp; data</Link>
            <Link href="/credits" className="text-muted hover:text-[rgb(var(--fg))] transition-colors">credits</Link>
            <a href="mailto:hi@vainie.pl" className="text-muted hover:text-[rgb(var(--fg))] transition-colors break-all">hi@vainie.pl</a>
          </div>
        </div>
      </div>
      <div className="border-t border-default">
        <div className="container-x py-5 flex items-center justify-between text-xs gap-4">
          <p className="text-subtle font-mono">© {new Date().getFullYear()} vainie</p>
          <p className="text-subtle font-mono">v0.1 — PL</p>
        </div>
      </div>
    </footer>
  );
}
