import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "quizzes — vainie",
  description: "short, opinionated quizzes.",
};

type QuizCard = {
  href: string;
  title: string;
  tagline: string;
  tag: string;
  minutes: number;
};

const QUIZZES: QuizCard[] = [
  {
    href: "/quiz/linux-distro",
    title: "which linux distro is for you?",
    tagline: "7 questions, one opinionated answer.",
    tag: "linux",
    minutes: 2,
  },
];

export default function QuizIndex() {
  return (
    <div className="container-tight py-12 md:py-16 animate-fade-up">
      <div className="eyebrow mb-5">quizzes</div>
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        short, <span className="text-accent-light">opinionated</span> quizzes.
      </h1>
      <p className="text-muted mt-5 text-[16px] leading-relaxed max-w-2xl">
        little things to answer mostly-serious questions. more added as i
        think of them.
      </p>

      <ul className="mt-10 border border-default rounded-xl overflow-hidden divide-y divide-default bg-app">
        {QUIZZES.map((q) => (
          <li key={q.href}>
            <Link
              href={q.href}
              className="group block px-5 md:px-6 py-5 hover:bg-surface transition-colors"
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h2 className="text-lg md:text-xl font-semibold tracking-tight group-hover:text-accent-light transition-colors">
                  {q.title}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="chip">{q.tag}</span>
                  <span className="font-mono text-[11px] text-subtle">
                    ~{q.minutes} min
                  </span>
                </div>
              </div>
              <p className="text-muted text-sm mt-1.5">{q.tagline}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
