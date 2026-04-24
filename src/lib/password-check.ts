import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BLOOM_PATH = path.join(process.cwd(), "data", "blocked-passwords.bloom");

type BloomData = {
  bits: Uint8Array;
  k: number;
  mBits: number;
  nAdded: number;
};

const globalForBloom = globalThis as unknown as {
  __passwordBloom?: BloomData | null;
  __passwordBloomLoadedAt?: number;
};

function loadBloom(): BloomData | null {
  if (globalForBloom.__passwordBloom !== undefined) {
    return globalForBloom.__passwordBloom;
  }
  try {
    if (!fs.existsSync(BLOOM_PATH)) {
      console.warn(
        `[password-check] bloom file not found at ${BLOOM_PATH}. run: npm run passwords:build`,
      );
      globalForBloom.__passwordBloom = null;
      return null;
    }
    const buf = fs.readFileSync(BLOOM_PATH);
    if (buf.length < 32) throw new Error("bloom file too small");
    const magic = buf.slice(0, 8).toString("ascii");
    if (magic !== "VBLOOM01") {
      throw new Error(`bad magic: '${magic}'`);
    }
    const k = buf.readUInt32LE(8);
    const mBits = Number(buf.readBigUInt64LE(12));
    const nAdded = Number(buf.readBigUInt64LE(20));
    const mBytes = Math.ceil(mBits / 8);
    const bits = new Uint8Array(
      buf.buffer,
      buf.byteOffset + 32,
      mBytes,
    );

    console.log(
      `[password-check] loaded bloom: ${nAdded.toLocaleString()} entries, ${(mBytes / 1024 / 1024).toFixed(2)} MB, k=${k}`,
    );
    const data = { bits, k, mBits, nAdded };
    globalForBloom.__passwordBloom = data;
    globalForBloom.__passwordBloomLoadedAt = Date.now();
    return data;
  } catch (err) {
    console.error("[password-check] failed to load bloom:", err);
    globalForBloom.__passwordBloom = null;
    return null;
  }
}

function hashIndices(str: string, m: number, k: number): number[] {
  const h = crypto.createHash("sha256").update(str).digest();
  const h1 = h.readBigUInt64BE(0);
  const h2 = h.readBigUInt64BE(8);
  const mB = BigInt(m);
  const out = new Array<number>(k);
  for (let i = 0; i < k; i++) {
    let v = (h1 + BigInt(i) * h2) % mB;
    if (v < 0n) v += mB;
    out[i] = Number(v);
  }
  return out;
}

/**
 * Returns true if the password is (probably) in one of the leaked wordlists.
 * False positives are possible at ~1% rate but they're a feature here, not a
 * bug — we'd rather reject a few safe passwords than let a known-leaked one
 * through.
 *
 * If the bloom file is missing, returns false (fail-open) and logs a warning.
 * That way a misconfigured deploy doesn't break signup entirely.
 */
export function isPasswordLeaked(password: string): boolean {
  const b = loadBloom();
  if (!b) return false;

  const normalized = password.trim().toLowerCase();
  if (normalized.length < 4) return false;

  const idxs = hashIndices(normalized, b.mBits, b.k);
  for (const idx of idxs) {
    const byte = b.bits[idx >>> 3];
    if ((byte & (1 << (idx & 7))) === 0) {
      return false; // definitely not in set
    }
  }
  return true; // probably in set
}

export function getBloomStats(): { loaded: boolean; entries: number; sizeBytes: number } {
  const b = loadBloom();
  return {
    loaded: Boolean(b),
    entries: b?.nAdded ?? 0,
    sizeBytes: b ? Math.ceil(b.mBits / 8) : 0,
  };
}
