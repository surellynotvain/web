import "server-only";
import { projects as staticProjects, type Project } from "./projects";
import { getDynamicProjects, getDynamicProject } from "./projects-dynamic";

export type { Project };

/**
 * Returns all projects — dynamic (from HDD) first, then static fallbacks that
 * aren't already represented by a dynamic one (by slug).
 */
export async function getAllProjects(): Promise<Project[]> {
  let dynamic: Project[] = [];
  try {
    const d = await getDynamicProjects();
    dynamic = d.map((dp) => ({
      slug: dp.slug,
      name: dp.name,
      tagline: dp.tagline,
      about: dp.description,
      tech: dp.tech,
      status: dp.status,
      cover: dp.cover,
      source: "dynamic" as const,
    }));
  } catch (err) {
    console.warn("[projects] dynamic load failed:", err);
  }

  const dynamicSlugs = new Set(dynamic.map((p) => p.slug));
  const fallback = staticProjects
    .filter((p) => !dynamicSlugs.has(p.slug))
    .map<Project>((p) => ({ ...p, source: "static" }));

  return [...dynamic, ...fallback];
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const dp = await getDynamicProject(slug);
  if (dp) {
    return {
      slug: dp.slug,
      name: dp.name,
      tagline: dp.tagline,
      about: dp.description,
      tech: dp.tech,
      status: dp.status,
      cover: dp.cover,
      source: "dynamic",
    };
  }
  const s = staticProjects.find((p) => p.slug === slug);
  return s ? { ...s, source: "static" } : null;
}

export const STATUS_ORDER: Project["status"][] = [
  "wip",
  "done",
  "planned",
  "paused",
  "concept",
];

export const STATUS_LABEL: Record<Project["status"], string> = {
  wip: "in progress",
  done: "done",
  planned: "planned",
  paused: "paused",
  concept: "concept",
};
