export type Project = {
  slug: string;
  name: string;
  tagline: string;
  about: string;
  tech: string[];
  status: "wip" | "done" | "paused" | "concept" | "planned";
  cover?: string | null;
  source?: "static" | "dynamic";
  links?: { label: string; href: string }[];
};

// The static archive is intentionally empty — all projects now come from
// vainie.json files under /mnt/PLIKI/Dokumenty HDD/PROJECTS/<status>/<project>/
// See src/lib/projects-dynamic.ts. Use the GUI to create entries:
//   npm run project:editor
export const projects: Project[] = [];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
