import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { newId } from "@/lib/crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw input
const MAX_WIDTH = 1600;            // downscale any larger
const LQIP_WIDTH = 20;             // blur placeholder width
const WEBP_QUALITY = 85;

const ACCEPTED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

// magic-byte check. we don't trust the client MIME header.
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return "image/png";
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  )
    return "image/gif";
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    const brand = buf.slice(8, 12).toString("ascii");
    if (["avif", "avis", "heic", "heix", "mif1"].includes(brand)) {
      return "image/avif";
    }
  }
  return null;
}

export type UploadResult = {
  url: string;          // public URL of the stored (processed) image
  size: number;         // final file size on disk
  width: number;
  height: number;
  mime: string;         // final mime type (image/webp usually)
  placeholder: string;  // base64 data URL for blur-up
  originalMime: string; // what we detected on upload
  originalSize: number; // raw input size
};

/**
 * Pipeline:
 *   1. sniff magic bytes, reject anything not in ACCEPTED_MIMES
 *   2. GIFs pass through unchanged (preserve animation)
 *   3. Everything else: sharp → downscale (if >MAX_WIDTH) → re-encode to webp
 *   4. Generate a tiny LQIP base64 for blur placeholders
 */
export async function saveUploadedImage(file: File): Promise<UploadResult> {
  if (file.size === 0) throw new Error("empty file");
  if (file.size > MAX_BYTES) {
    throw new Error(`file too big (max ${MAX_BYTES / 1024 / 1024}MB)`);
  }
  const inputBuf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(inputBuf);
  if (!mime || !ACCEPTED_MIMES.has(mime)) {
    throw new Error("not a recognized image format");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const stem = `${new Date().toISOString().slice(0, 10)}-${newId(10)}`;

  // --- GIF: keep as-is to preserve animation ---
  if (mime === "image/gif") {
    const name = `${stem}.gif`;
    const dest = path.join(UPLOAD_DIR, name);
    await fs.writeFile(dest, inputBuf, { mode: 0o644 });
    // best-effort metadata (static frame metadata from sharp)
    let width = 0;
    let height = 0;
    try {
      const meta = await sharp(inputBuf).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
    } catch {
      /* ignore */
    }
    const placeholder = await makeLqip(inputBuf).catch(() => "");
    return {
      url: `/uploads/${name}`,
      size: inputBuf.length,
      width,
      height,
      mime: "image/gif",
      placeholder,
      originalMime: mime,
      originalSize: file.size,
    };
  }

  // --- still images: resize + re-encode to webp ---
  const pipeline = sharp(inputBuf, { failOn: "none" }).rotate(); // honor EXIF
  const meta = await pipeline.metadata();
  const srcWidth = meta.width ?? 0;
  const srcHeight = meta.height ?? 0;

  const resized =
    srcWidth > MAX_WIDTH
      ? pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : pipeline;

  const outBuf = await resized
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();

  const outMeta = await sharp(outBuf).metadata();
  const width = outMeta.width ?? srcWidth;
  const height = outMeta.height ?? srcHeight;

  const name = `${stem}.webp`;
  const dest = path.join(UPLOAD_DIR, name);
  await fs.writeFile(dest, outBuf, { mode: 0o644 });

  const placeholder = await makeLqip(outBuf).catch(() => "");

  return {
    url: `/uploads/${name}`,
    size: outBuf.length,
    width,
    height,
    mime: "image/webp",
    placeholder,
    originalMime: mime,
    originalSize: file.size,
  };
}

async function makeLqip(buf: Buffer): Promise<string> {
  const lqip = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: LQIP_WIDTH })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${lqip.toString("base64")}`;
}
