import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const PROJECTS_DIR =
  process.env.PROJECTS_DIR || "/mnt/PLIKI/Dokumenty HDD/PROJECTS";

// 4 status folders → project status
const STATUS_FOLDERS: Record<string, DynamicProject["status"]> = {
  Finished: "done",
  "In progress": "wip",
  Planned: "planned",
  "Left out": "paused",
};

export type DynamicProject = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  tech: string[];
  cover: string | null; // served as /api/project-cover?slug=...
  status: "wip" | "done" | "paused" | "planned";
  source: "dynamic";
};

const VainieJsonSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(240).optional().default(""),
  description: z.string().max(10_000).optional().default(""),
  tech: z.array(z.string().max(40)).max(20).optional().default([]),
  cover: z.string().max(260).optional(), // relative filename inside the dir
});

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Guard against path traversal: only allow covers within the project dir.
function safeJoin(base: string, rel: string): string | null {
  const resolved = path.resolve(base, rel);
  const baseResolved = path.resolve(base);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    return null;
  }
  return resolved;
}

export type ProjectLocator = {
  slug: string;
  absDir: string; // absolute path to project dir
  coverAbs: string | null;
};

// Cache: slug → absolute dir (for cover-serving without re-scanning each time)
const globalForCache = globalThis as unknown as {
  __projectLocators?: Map<string, ProjectLocator>;
  __projectLocatorsAt?: number;
};
const LOCATOR_TTL_MS = 30_000;

async function readStatusDir(
  statusDir: string,
  status: DynamicProject["status"],
  out: DynamicProject[],
  locators: Map<string, ProjectLocator>,
): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(statusDir);
  } catch {
    return; // dir doesn't exist, skip
  }

  for (const entry of entries) {
    const projectDir = path.join(statusDir, entry);
    try {
      const st = await fs.stat(projectDir);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }

    const jsonPath = path.join(projectDir, "vainie.json");
    let raw: string;
    try {
      raw = await fs.readFile(jsonPath, "utf8");
    } catch {
      continue; // no vainie.json → skip silently
    }

    let parsed;
    try {
      const data = JSON.parse(raw);
      parsed = VainieJsonSchema.parse(data);
    } catch (err) {
      console.warn(`[projects] invalid vainie.json in ${projectDir}:`, err);
      continue;
    }

    const slug = toSlug(parsed.name) || toSlug(entry);
    if (!slug) continue;

    let coverAbs: string | null = null;
    if (parsed.cover) {
      const joined = safeJoin(projectDir, parsed.cover);
      if (joined) {
        try {
          const cst = await fs.stat(joined);
          if (cst.isFile() && cst.size > 0 && cst.size < 15 * 1024 * 1024) {
            coverAbs = joined;
          }
        } catch {
          /* missing cover file, ignore */
        }
      }
    }

    // dedupe: last one wins, but warn
    if (locators.has(slug)) {
      console.warn(`[projects] duplicate slug "${slug}" — overwriting`);
    }
    locators.set(slug, { slug, absDir: projectDir, coverAbs });

    out.push({
      slug,
      name: parsed.name,
      tagline: parsed.tagline,
      description: parsed.description,
      tech: parsed.tech,
      cover: coverAbs ? `/api/project-cover?slug=${encodeURIComponent(slug)}` : null,
      status,
      source: "dynamic",
    });
  }
}

async function loadAll(): Promise<{
  projects: DynamicProject[];
  locators: Map<string, ProjectLocator>;
}> {
  const all: DynamicProject[] = [];
  const locators = new Map<string, ProjectLocator>();

  for (const [folder, status] of Object.entries(STATUS_FOLDERS)) {
    const abs = path.join(PROJECTS_DIR, folder);
    await readStatusDir(abs, status, all, locators);
  }

  return { projects: all, locators };
}

export async function getDynamicProjects(): Promise<DynamicProject[]> {
  const { projects, locators } = await loadAll();
  globalForCache.__projectLocators = locators;
  globalForCache.__projectLocatorsAt = Date.now();
  return projects;
}

export async function getDynamicProject(
  slug: string,
): Promise<DynamicProject | null> {
  const list = await getDynamicProjects();
  return list.find((p) => p.slug === slug) ?? null;
}

export async function getProjectLocator(
  slug: string,
): Promise<ProjectLocator | null> {
  const now = Date.now();
  const cached = globalForCache.__projectLocators;
  const at = globalForCache.__projectLocatorsAt ?? 0;
  if (cached && now - at < LOCATOR_TTL_MS) {
    return cached.get(slug) ?? null;
  }
  // refresh
  await getDynamicProjects();
  return globalForCache.__projectLocators?.get(slug) ?? null;
}

export function getProjectsRoot(): string {
  return PROJECTS_DIR;
}
