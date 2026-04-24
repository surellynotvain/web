import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

// Persistent cache for "which openrouter model is currently working".
// - First AI request probes the configured chain; whichever responds first
//   becomes the preferred model.
// - Subsequent requests try the preferred model first, falling back on 429/etc.
// - File location: $DATA_DIR/.openrouter-state.json
// - Invalidated on server restart: we tag the cache with process.pid and
//   reject stale entries written by a prior process.

const DATA_DIR = process.env.DATA_DIR || "./data";
const STATE_FILE = path.join(DATA_DIR, ".openrouter-state.json");

export type OpenRouterState = {
  pid: number;
  startedAt: string;          // ISO
  preferredModel: string | null;
  lastCheckedAt: string;      // ISO
};

// in-memory cache; avoids re-reading the file on every request
let mem: OpenRouterState | null = null;

async function loadFromFile(): Promise<OpenRouterState | null> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as OpenRouterState;
    if (typeof parsed?.pid !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeToFile(state: OpenRouterState): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), {
      mode: 0o640,
    });
  } catch (err) {
    console.warn("[openrouter-state] persist failed", err);
  }
}

/**
 * Get the currently preferred model.
 * Returns null if no valid cache (cold start or cache written by a previous
 * server process — we treat cross-process cache as a hint only, not authoritative).
 */
export async function getPreferredModel(): Promise<string | null> {
  if (mem && mem.pid === process.pid) return mem.preferredModel;

  const onDisk = await loadFromFile();
  if (onDisk && onDisk.pid === process.pid) {
    mem = onDisk;
    return onDisk.preferredModel;
  }

  // file belongs to a previous server instance — keep it as a hint for the
  // next probe, but don't use it blindly. we'll validate by actually calling.
  mem = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    preferredModel: null,
    lastCheckedAt: new Date().toISOString(),
  };
  return null;
}

/**
 * Record `model` as the currently preferred model. Updates both the in-memory
 * cache and the JSON file on disk.
 */
export async function setPreferredModel(model: string): Promise<void> {
  const now = new Date().toISOString();
  mem = {
    pid: process.pid,
    startedAt: mem?.startedAt ?? now,
    preferredModel: model,
    lastCheckedAt: now,
  };
  await writeToFile(mem);
}

/**
 * Clear the preferred model (e.g. if all configured candidates are failing
 * and we want the next request to re-probe from scratch).
 */
export async function clearPreferredModel(): Promise<void> {
  const now = new Date().toISOString();
  mem = {
    pid: process.pid,
    startedAt: mem?.startedAt ?? now,
    preferredModel: null,
    lastCheckedAt: now,
  };
  await writeToFile(mem);
}
