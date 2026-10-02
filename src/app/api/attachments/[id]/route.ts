import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const mime: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[a-f0-9-]{36}\.(png|jpe?g|gif|webp)$/i.test(id)) return new NextResponse(null, { status: 400 });
  const db = process.env.DATABASE_URL?.replace(/^file:/, "");
  if (!db && !process.env.ATTACHMENTS_DIR) return new NextResponse(null, { status: 500 });
  try {
    const directory = process.env.ATTACHMENTS_DIR || path.join(path.dirname(db!), "attachments");
    const file = await fs.readFile(path.join(directory, id));
    return new NextResponse(file, { headers: { "Content-Type": mime[path.extname(id).toLowerCase()], "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
