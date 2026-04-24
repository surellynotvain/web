#!/usr/bin/env node
/* eslint-disable */
/**
 * Build a bloom filter from all .txt wordlists in additions/blockedpsswd/.
 * Output: data/blocked-passwords.bloom  (binary — bit array + header)
 *
 * Run:  npm run passwords:build
 *
 * Re-run whenever you add new wordlists.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const WORDLIST_DIR = path.join(ROOT, "additions", "blockedpsswd");
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "blocked-passwords.bloom");

// bloom-filter sizing (m bits, k hashes)
// choose m + k for target false-positive rate p at capacity n:
//   m = -n * ln(p) / (ln(2)^2)
//   k = (m/n) * ln(2)
// for p=1% and n=3.5M → m ≈ 33.5M bits (~4 MB), k ≈ 7
const TARGET_FP = 0.01;
const CAPACITY = 4_000_000;

function computeParams(n, p) {
  const m = Math.ceil((-n * Math.log(p)) / Math.LN2 ** 2);
  // round m up to byte boundary for clean serialization
  const mBytes = Math.ceil(m / 8);
  const mBits = mBytes * 8;
  const k = Math.max(1, Math.round((mBits / n) * Math.LN2));
  return { mBits, mBytes, k };
}

// Double-hashing: h_i(x) = (h1(x) + i * h2(x)) mod m
// We use SHA-256: first 8 bytes = h1, next 8 = h2 (as BigInt).
function hashIndices(str, m, k) {
  const h = crypto.createHash("sha256").update(str).digest();
  // read two 64-bit big-uint from the digest
  const h1 = h.readBigUInt64BE(0);
  const h2 = h.readBigUInt64BE(8);
  const mB = BigInt(m);
  const indices = new Array(k);
  for (let i = 0; i < k; i++) {
    let v = (h1 + BigInt(i) * h2) % mB;
    if (v < 0n) v += mB;
    indices[i] = Number(v);
  }
  return indices;
}

function normalizePassword(raw) {
  // use lowercased form so we block case-variations of the same leak
  // (we still enforce real password rules separately in auth)
  return raw.trim().toLowerCase();
}

function main() {
  if (!fs.existsSync(WORDLIST_DIR)) {
    console.error(`! wordlist dir not found: ${WORDLIST_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(WORDLIST_DIR)
    .filter((f) => f.toLowerCase().endsWith(".txt"));

  if (files.length === 0) {
    console.error(`! no .txt files in ${WORDLIST_DIR}`);
    process.exit(1);
  }

  const { mBits, mBytes, k } = computeParams(CAPACITY, TARGET_FP);
  console.log(
    `bloom: ${mBits.toLocaleString()} bits (${(mBytes / 1024 / 1024).toFixed(2)} MB), k=${k}, target fp=${TARGET_FP}`,
  );

  const bits = new Uint8Array(mBytes);
  let added = 0;
  let skipped = 0;

  for (const file of files) {
    const full = path.join(WORDLIST_DIR, file);
    const size = fs.statSync(full).size;
    process.stdout.write(`  ${file}  (${(size / 1024 / 1024).toFixed(1)} MB)  `);

    // stream line by line for memory safety
    const buf = fs.readFileSync(full);
    // normalize line endings
    const lines = buf.toString("latin1").split(/\r?\n/);
    let fileAdded = 0;
    for (const line of lines) {
      if (!line) continue;
      const pw = normalizePassword(line);
      if (!pw || pw.length < 4) {
        skipped++;
        continue;
      }
      const idxs = hashIndices(pw, mBits, k);
      for (const idx of idxs) {
        bits[idx >>> 3] |= 1 << (idx & 7);
      }
      fileAdded++;
    }
    added += fileAdded;
    console.log(`+${fileAdded.toLocaleString()} entries`);
  }

  // serialize: 32-byte header + bit array
  //   magic "VBLOOM01"  (8 bytes)
  //   k (uint32 LE)     (4 bytes)
  //   m (uint64 LE)     (8 bytes) — bit count
  //   n_added (uint64 LE) (8 bytes) — total entries added
  //   reserved          (4 bytes)
  const header = Buffer.alloc(32);
  header.write("VBLOOM01", 0, 8, "ascii");
  header.writeUInt32LE(k, 8);
  header.writeBigUInt64LE(BigInt(mBits), 12);
  header.writeBigUInt64LE(BigInt(added), 20);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fd = fs.openSync(OUT_FILE, "w");
  fs.writeSync(fd, header);
  fs.writeSync(fd, bits);
  fs.closeSync(fd);

  console.log();
  console.log(
    `done: ${added.toLocaleString()} passwords added, ${skipped.toLocaleString()} skipped`,
  );
  console.log(`wrote: ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log();
  console.log(
    `estimated false-positive rate at this fill: ${estimateFpRate(added, mBits, k).toFixed(4)}`,
  );
}

function estimateFpRate(n, m, k) {
  // (1 - e^(-k*n/m))^k
  return Math.pow(1 - Math.exp((-k * n) / m), k);
}

main();
