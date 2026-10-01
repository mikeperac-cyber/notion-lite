import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
export const dynamic = "force-dynamic";

export async function GET() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "notionlite-snapshot-"));
  const snapshot = path.join(directory, "workspace.db");
  try {
    await prisma.$executeRawUnsafe("VACUUM INTO ?", snapshot);
    const bytes = await fs.readFile(snapshot);
    return new NextResponse(bytes, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SQLite snapshot failed", error);
    return NextResponse.json({ error: "Could not create a database snapshot" }, { status: 500 });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
