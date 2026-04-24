"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  QUESTIONS,
  isQuizComplete,
  scoreAnswers,
  type QuizAnswers,
  type DistroScore,
} from "@/lib/quiz/linux-distro";

type View =
  | { kind: "intro" }
  | { kind: "question"; index: number }
  | { kind: "result" };

export function LinuxDistroQuiz() {
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [view, setView] = useState<View>({ kind: "intro" });

  const results = useMemo<DistroScore[] | null>(() => {
    if (!isQuizComplete(answers)) return null;
    return scoreAnswers(answers);
  }, [answers]);

  function start() {
    setAnswers({});
    setView({ kind: "question", index: 0 });
  }

  function answer(questionId: string, value: string) {
    const nextAnswers = { ...answers, [questionId]: value };
    setAnswers(nextAnswers);

    const currentIndex =
      view.kind === "question" ? view.index : 0;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= QUESTIONS.length) {
      setView({ kind: "result" });
    } else {
      setView({ kind: "question", index: nextIndex });
    }
  }

  function back() {
    if (view.kind !== "question") return;
    if (view.index === 0) {
      setView({ kind: "intro" });
      return;
    }
    setView({ kind: "question", index: view.index - 1 });
  }

  function retake() {
    setAnswers({});
    setView({ kind: "intro" });
  }

  // ------------- intro -------------
  if (view.kind === "intro") {
    return (
      <div className="border border-default rounded-xl p-6 md:p-8 bg-app">
        <p className="eyebrow mb-4">how it works</p>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--fg))] max-w-2xl">
          {QUESTIONS.length} quick questions about your experience, hardware,
          and what you actually want to do. each answer nudges the score of
          one or more distros. at the end you get a ranked list with a short
          explanation of each pick.
        </p>
        <p className="text-sm text-muted mt-4 max-w-2xl leading-relaxed">
          this is my opinionated take — there is no single &ldquo;correct&rdquo;
          linux distro. if you disagree with the verdict, good. you&apos;ve
          already done the work of thinking about it.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={start} className="btn-primary">
            start the quiz
          </button>
          <Link href="/" className="btn-ghost">
            back home
          </Link>
        </div>
      </div>
    );
  }

  // ------------- result -------------
  if (view.kind === "result" && results) {
    const winner = results[0];
    const runnersUp = results.slice(1, 4);
    return (
      <div>
        <div className="border border-default rounded-xl p-6 md:p-8 bg-app">
          <p className="eyebrow mb-3">your pick</p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            <span className="text-accent-light">{winner.distro.name}</span>
          </h2>
          <p className="text-muted mt-3 text-[15px] md:text-[17px]">
            {winner.distro.tagline}
          </p>
          <p className="mt-6 text-[15px] leading-relaxed max-w-2xl">
            {winner.distro.summary}
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div>
              <p className="eyebrow mb-2">why it wins</p>
              <ul className="space-y-1.5 text-sm">
                {winner.distro.pros.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-accent-light shrink-0">+</span>
                    <span className="text-[rgb(var(--fg))]">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-2">keep in mind</p>
              <ul className="space-y-1.5 text-sm">
                {winner.distro.cons.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="text-subtle shrink-0">—</span>
                    <span className="text-muted">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <a
              href={winner.distro.site}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary"
            >
              get {winner.distro.name} ↗
            </a>
            <button type="button" onClick={retake} className="btn-ghost">
              retake quiz
            </button>
          </div>
        </div>

        {/* runners-up */}
        <div className="mt-8">
          <p className="eyebrow mb-4">runners-up</p>
          <ul className="border border-default rounded-xl divide-y divide-default overflow-hidden bg-app">
            {runnersUp.map((r, i) => (
              <li key={r.id} className="p-4 md:p-5 hover:bg-surface transition-colors">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-subtle tabular-nums pt-0.5 w-6">
                    #{i + 2}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-base font-semibold tracking-tight">
                        {r.distro.name}
                      </h3>
                      <span className="text-[13px] text-accent-light font-medium">
                        {r.distro.tagline}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1 leading-relaxed">
                      {r.distro.summary}
                    </p>
                  </div>
                  <a
                    href={r.distro.site}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono text-[11px] text-subtle hover:text-accent-light shrink-0 pt-1"
                  >
                    site ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* all scores (debug-ish but nice) */}
        <details className="mt-8 border border-default rounded-xl p-5 bg-surface/40 group">
          <summary className="cursor-pointer select-none text-sm font-mono text-subtle hover:text-[rgb(var(--fg))] transition-colors">
            all scores →
          </summary>
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24 shrink-0">
                  {r.distro.name}
                </span>
                <div className="flex-1 h-2 bg-surface rounded overflow-hidden">
                  <div
                    className="h-full bg-[rgb(var(--accent-light))] transition-[width]"
                    style={{ width: `${Math.max(4, r.normalized * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-subtle tabular-nums w-8 text-right">
                  {r.score}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  // ------------- question -------------
  if (view.kind === "question") {
    const q = QUESTIONS[view.index];
    const current = answers[q.id];
    const pct = Math.round(((view.index + 1) / QUESTIONS.length) * 100);

    return (
      <div>
        {/* progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] text-subtle">
              question {view.index + 1} / {QUESTIONS.length}
            </span>
            <span className="font-mono text-[11px] text-subtle">{pct}%</span>
          </div>
          <div
            className="h-1 bg-surface rounded overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full bg-[rgb(var(--accent-light))] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <fieldset className="border-0 p-0">
          <legend className="mb-5">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
              {q.title}
            </h2>
            {q.desc && (
              <p className="text-muted text-sm mt-2 max-w-2xl">{q.desc}</p>
            )}
          </legend>

          <div className="space-y-2.5">
            {q.options.map((opt) => {
              const selected = current === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => answer(q.id, opt.value)}
                  aria-pressed={selected}
                  className={`w-full text-left border rounded-xl p-4 md:p-5 transition-colors ${
                    selected
                      ? "border-[rgb(var(--accent-light))] bg-[rgb(var(--accent-light)/0.08)]"
                      : "border-default bg-app hover:bg-surface"
                  }`}
                >
                  <p
                    className={`text-[15px] font-medium ${
                      selected ? "text-[rgb(var(--fg))]" : ""
                    }`}
                  >
                    {opt.label}
                  </p>
                  {opt.desc && (
                    <p className="text-[13px] text-muted leading-snug mt-1">
                      {opt.desc}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            className="btn-ghost !h-9 !px-4"
          >
            ← back
          </button>
          <span className="font-mono text-[11px] text-subtle">
            pick one to continue →
          </span>
        </div>
      </div>
    );
  }

  return null;
}
