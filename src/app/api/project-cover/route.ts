import { NextRequest, NextResponse } from "next/server";
import { getProjectLocator } from "@/lib/projects-dynamic";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function makeEtag(size: number, mtimeMs: number): string {
  const h = createHash("sha1")
    .update(`${size}:${Math.floor(mtimeMs)}`)
    .digest("hex")
    .slice(0, 16);
  return `W/"${h}"`;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || !/^[a-z0-9-]{1,80}$/i.test(slug)) {
    return new NextResponse("bad slug", { status: 400 });
  }

  const loc = await getProjectLocator(slug);
  if (!loc || !loc.coverAbs) {
    return new NextResponse("not found", { status: 404 });
  }

  // final path traversal check
  if (!path.resolve(loc.coverAbs).startsWith(path.resolve(loc.absDir) + path.sep)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let stat;
  try {
    stat = await fs.promises.stat(loc.coverAbs);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }

  const etag = makeEtag(stat.size, stat.mtimeMs);
  const lastModified = new Date(stat.mtimeMs).toUTCString();

  // conditional GET handling
  const ifNoneMatch = req.headers.get("if-none-match");
  const ifModSince = req.headers.get("if-modified-since");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Last-Modified": lastModified },
    });
  }
  if (ifModSince) {
    const since = Date.parse(ifModSince);
    if (!Number.isNaN(since) && since >= Math.floor(stat.mtimeMs / 1000) * 1000) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Last-Modified": lastModified },
      });
    }
  }

  const ext = path.extname(loc.coverAbs).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";

  const stream = fs.createReadStream(loc.coverAbs);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ETag: etag,
      "Last-Modified": lastModified,
    },
  });
}
