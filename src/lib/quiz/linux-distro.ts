// Linux distro quiz — data & scoring only. Pure module, no react, no dom.
// Questions and distros live here so the UI stays a thin shell.

export type DistroId =
  | "ubuntu"
  | "mint"
  | "fedora"
  | "debian"
  | "arch"
  | "pop"
  | "nixos";

export type Distro = {
  id: DistroId;
  name: string;
  tagline: string;
  /** short bullet points of strengths */
  pros: string[];
  /** caveats / who it's NOT for */
  cons: string[];
  /** official homepage for the "install" / "learn more" link */
  site: string;
  /** single-sentence "what this actually is" */
  summary: string;
};

export const DISTROS: Record<DistroId, Distro> = {
  ubuntu: {
    id: "ubuntu",
    name: "Ubuntu",
    tagline: "the default, and for good reason",
    pros: [
      "enormous community — every error you hit has a stackoverflow answer",
      "LTS releases are rock solid for 5 years",
      "snap + apt cover almost any software you need",
      "great laptop hardware support out of the box",
    ],
    cons: [
      "snaps are controversial; some prefer flatpak or native packages",
      "GNOME is fine but not everyone loves it",
    ],
    site: "https://ubuntu.com/",
    summary:
      "debian-based, polished, opinionated. canonical keeps the lights on.",
  },
  mint: {
    id: "mint",
    name: "Linux Mint",
    tagline: "linux for people who used windows yesterday",
    pros: [
      "cinnamon feels like windows 7 with a soul",
      "boring and stable on purpose — based on ubuntu LTS",
      "apt + a real software manager, no snaps forced on you",
      "low RAM footprint with XFCE edition",
    ],
    cons: [
      "very conservative with newer kernels / packages",
      "not ideal if you want rolling or bleeding-edge",
    ],
    site: "https://linuxmint.com/",
    summary: "ubuntu's sensible cousin with a windows-like desktop.",
  },
  fedora: {
    id: "fedora",
    name: "Fedora",
    tagline: "stable but always fresh",
    pros: [
      "newest stable kernel, GNOME, mesa — without going full rolling",
      "upstream-first, so tech lands here before it hits debian-ish distros",
      "great for development: modern toolchains by default",
      "SELinux enabled, solid security posture",
    ],
    cons: [
      "6-month release cycle means bigger jumps than ubuntu LTS",
      "proprietary codecs need RPM Fusion setup",
    ],
    site: "https://fedoraproject.org/",
    summary: "red hat's community desktop. new tech without breakage.",
  },
  debian: {
    id: "debian",
    name: "Debian",
    tagline: "the ur-distro. runs forever.",
    pros: [
      "legendary stability — the default choice for servers for a reason",
      "strict free-software philosophy (non-free is opt-in)",
      "apt is the original, and it's great",
      "huge package selection, meticulously tested",
    ],
    cons: [
      "stable can feel old — packages lag behind",
      "not the friendliest for desktop newbies",
    ],
    site: "https://www.debian.org/",
    summary: "the universal os. boring is the point.",
  },
  arch: {
    id: "arch",
    name: "Arch Linux",
    tagline: "btw",
    pros: [
      "rolling release — you always have the newest version",
      "the AUR covers literally every piece of niche software",
      "the wiki is the best linux docs on the internet, period",
      "you build only what you want — no bloat",
    ],
    cons: [
      "installation is manual; expect to read",
      "occasional manual intervention when updates break something",
      "not for people who don't want to fiddle",
    ],
    site: "https://archlinux.org/",
    summary: "minimalist rolling distro. you build your own system.",
  },
  pop: {
    id: "pop",
    name: "Pop!_OS",
    tagline: "linux for people who game and work",
    pros: [
      "nvidia ISO with drivers pre-installed — plug and play",
      "excellent for gaming (steam, proton, game mode)",
      "COSMIC tiling is great once you learn it",
      "hardware-tuned by system76 for their laptops",
    ],
    cons: [
      "smaller community than ubuntu itself",
      "release cadence is tied to ubuntu LTS",
    ],
    site: "https://pop.system76.com/",
    summary: "system76's ubuntu-based distro, optimized for gaming + work.",
  },
  nixos: {
    id: "nixos",
    name: "NixOS",
    tagline: "your system is a function",
    pros: [
      "declarative configuration — your entire system is one file",
      "reproducible builds, rollbacks that actually work",
      "atomic upgrades: never end up in a half-updated state",
      "the Nix ecosystem is genuinely revolutionary",
    ],
    cons: [
      "steep learning curve — nix language is weird",
      "some software packaging is DIY",
      "docs are improving but still a sore spot",
    ],
    site: "https://nixos.org/",
    summary: "declarative, reproducible linux. the future (if you're brave).",
  },
};

export const DISTRO_ORDER: DistroId[] = [
  "ubuntu",
  "mint",
  "fedora",
  "debian",
  "arch",
  "pop",
  "nixos",
];

// ---------- questions ----------

export type QuizOption = {
  value: string;
  label: string;
  /** optional clarification shown under the label */
  desc?: string;
  /** how many points this option contributes to each distro */
  scores: Partial<Record<DistroId, number>>;
};

export type QuizQuestion = {
  id: string;
  title: string;
  desc?: string;
  options: QuizOption[];
};

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "experience",
    title: "how comfortable are you with linux?",
    options: [
      {
        value: "none",
        label: "zero — i just heard it's good",
        scores: { ubuntu: 3, mint: 3, pop: 2 },
      },
      {
        value: "some",
        label: "i've dual-booted, fixed a few things",
        scores: { ubuntu: 2, mint: 2, pop: 2, fedora: 2 },
      },
      {
        value: "intermediate",
        label: "i'm comfortable in the terminal",
        scores: { fedora: 3, debian: 2, arch: 1, pop: 1 },
      },
      {
        value: "advanced",
        label: "i compile kernels for fun",
        scores: { arch: 3, nixos: 3, debian: 1 },
      },
    ],
  },
  {
    id: "usecase",
    title: "what are you mostly going to do on it?",
    options: [
      {
        value: "daily",
        label: "daily driver — browsing, docs, some dev",
        scores: { ubuntu: 2, mint: 3, pop: 2, fedora: 2 },
      },
      {
        value: "gaming",
        label: "gaming (steam, proton, maybe emulators)",
        scores: { pop: 3, fedora: 2, arch: 2, mint: 1 },
      },
      {
        value: "dev",
        label: "dev workstation — web / ai / systems",
        scores: { fedora: 3, arch: 2, ubuntu: 2, debian: 2, nixos: 3 },
      },
      {
        value: "server",
        label: "server / homelab / headless",
        scores: { debian: 3, ubuntu: 2, arch: 1, nixos: 2 },
      },
      {
        value: "minimal",
        label: "minimal, weird, i know what i want",
        scores: { arch: 3, nixos: 3, debian: 2 },
      },
    ],
  },
  {
    id: "updates",
    title: "how do you feel about updates?",
    options: [
      {
        value: "boring",
        label: "boring & stable — don't break my system",
        scores: { debian: 3, mint: 3, ubuntu: 2 },
      },
      {
        value: "balanced",
        label: "balanced — new-ish stuff, but tested",
        scores: { fedora: 3, ubuntu: 2, pop: 2 },
      },
      {
        value: "latest",
        label: "latest everything, rolling release",
        scores: { arch: 3, nixos: 2, fedora: 1 },
      },
    ],
  },
  {
    id: "hardware",
    title: "what's the target machine?",
    options: [
      {
        value: "old",
        label: "older / low RAM (<= 4 GB)",
        scores: { mint: 3, debian: 2, arch: 1 },
      },
      {
        value: "midrange",
        label: "a normal modern laptop or desktop",
        scores: { ubuntu: 1, mint: 1, fedora: 1, pop: 1, arch: 1 },
      },
      {
        value: "workstation",
        label: "beefy workstation or gaming rig",
        scores: { pop: 2, fedora: 2, arch: 2, nixos: 1 },
      },
    ],
  },
  {
    id: "tinkering",
    title: "how much tinkering do you actually enjoy?",
    options: [
      {
        value: "none",
        label: "zero — i want it to just work",
        scores: { mint: 3, ubuntu: 3, pop: 2 },
      },
      {
        value: "some",
        label: "some — i like a few knobs",
        scores: { fedora: 2, pop: 2, debian: 2 },
      },
      {
        value: "a-lot",
        label: "a lot — building from scratch is the fun part",
        scores: { arch: 3, nixos: 3, debian: 1 },
      },
    ],
  },
  {
    id: "proprietary",
    title: "proprietary stuff (nvidia, codecs, steam)?",
    options: [
      {
        value: "just-work",
        label: "i want it to just work out of the box",
        scores: { pop: 3, ubuntu: 2, mint: 2 },
      },
      {
        value: "ill-set-up",
        label: "i'll configure it if needed",
        scores: { fedora: 2, arch: 2, debian: 1, nixos: 1 },
      },
      {
        value: "avoid",
        label: "avoid non-free where possible",
        scores: { debian: 3, nixos: 1 },
      },
    ],
  },
  {
    id: "community",
    title: "how important is a big, friendly community?",
    options: [
      {
        value: "critical",
        label: "critical — i'll be googling errors",
        scores: { ubuntu: 3, mint: 3, arch: 1, fedora: 1 },
      },
      {
        value: "nice",
        label: "nice to have",
        scores: { fedora: 2, pop: 1, debian: 1 },
      },
      {
        value: "whatever",
        label: "whatever — the wiki is enough",
        scores: { arch: 3, nixos: 3, debian: 1 },
      },
    ],
  },
];

// ---------- scoring ----------

export type QuizAnswers = Record<string, string>;

export type DistroScore = {
  id: DistroId;
  distro: Distro;
  score: number;
  /** normalized 0..1 for bar display (relative to the top scorer) */
  normalized: number;
};

/**
 * Given the answers map (questionId → optionValue), compute total scores
 * for every distro and return them sorted high → low.
 */
export function scoreAnswers(answers: QuizAnswers): DistroScore[] {
  const totals: Record<DistroId, number> = {
    ubuntu: 0,
    mint: 0,
    fedora: 0,
    debian: 0,
    arch: 0,
    pop: 0,
    nixos: 0,
  };

  for (const q of QUESTIONS) {
    const answer = answers[q.id];
    if (!answer) continue;
    const opt = q.options.find((o) => o.value === answer);
    if (!opt) continue;
    for (const [distro, pts] of Object.entries(opt.scores)) {
      if (typeof pts === "number") {
        totals[distro as DistroId] += pts;
      }
    }
  }

  const entries = DISTRO_ORDER.map((id) => ({
    id,
    distro: DISTROS[id],
    score: totals[id],
  }));

  entries.sort((a, b) => b.score - a.score);
  const topScore = Math.max(1, entries[0]?.score ?? 1);

  return entries.map((e) => ({
    ...e,
    normalized: e.score / topScore,
  }));
}

export function isQuizComplete(answers: QuizAnswers): boolean {
  return QUESTIONS.every((q) => Boolean(answers[q.id]));
}
