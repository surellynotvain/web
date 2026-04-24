import type { Metadata } from "next";
import { LinuxDistroQuiz } from "@/components/quiz/linux-distro-quiz";

export const metadata: Metadata = {
  title: "which linux distro is for you? — vainie",
  description:
    "a short, opinionated quiz that points you at the right linux distro for how you actually use a computer.",
};

export default function LinuxDistroQuizPage() {
  return (
    <div className="container-tight py-12 md:py-16 animate-fade-up">
      <div className="eyebrow mb-5">quiz · linux</div>
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        which linux distro is <span className="text-accent-light">for you</span>?
      </h1>
      <p className="text-muted mt-5 text-[16px] leading-relaxed max-w-2xl">
        seven questions, one opinionated answer. pick whichever option
        closest matches the truth — close is fine, this is not a job interview.
      </p>

      <div className="mt-10">
        <LinuxDistroQuiz />
      </div>
    </div>
  );
}
