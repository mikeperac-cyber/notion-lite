import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePageMetaTable } from "@/lib/schema-upgrade";

export const dynamic = "force-dynamic";

export interface PageTask { id: string; title: string; dueAt: string | null; completed: boolean; notified: boolean }
const parse = (value: string) => { try { return JSON.parse(value); } catch { return []; } };

export async function GET(_request: Request, { params }: { params: { pageId: string } }) {
  await ensurePageMetaTable();
  const page = await prisma.page.findUnique({ where: { id: params.pageId }, select: { id: true } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  const meta = await prisma.pageMeta.findUnique({ where: { pageId: params.pageId } });
  return NextResponse.json({ tags: parse(meta?.tags || "[]"), tasks: parse(meta?.tasks || "[]") });
}

export async function PATCH(request: Request, { params }: { params: { pageId: string } }) {
  await ensurePageMetaTable();
  const body = await request.json();
  const data: { tags?: string; tasks?: string } = {};
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > 30 || !body.tags.every((tag: unknown) => typeof tag === "string" && tag.trim().length > 0 && tag.trim().length <= 40)) return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
    data.tags = JSON.stringify(Array.from(new Set<string>(body.tags.map((tag: string) => tag.trim()))));
  }
  if (body.tasks !== undefined) {
    if (!Array.isArray(body.tasks) || body.tasks.length > 200 || !body.tasks.every((task: PageTask) => task && typeof task.id === "string" && /^[a-f0-9-]{36}$/i.test(task.id) && typeof task.title === "string" && task.title.trim().length > 0 && task.title.length <= 200 && (task.dueAt === null || typeof task.dueAt === "string" && !Number.isNaN(Date.parse(task.dueAt))) && typeof task.completed === "boolean")) return NextResponse.json({ error: "Invalid tasks" }, { status: 400 });
    data.tasks = JSON.stringify(body.tasks.map((task: PageTask) => ({ id: task.id, title: task.title.trim(), dueAt: task.dueAt, completed: task.completed, notified: Boolean(task.notified) })));
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const page = await prisma.page.findUnique({ where: { id: params.pageId }, select: { id: true } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  const meta = await prisma.pageMeta.upsert({
    where: { pageId: params.pageId },
    create: { pageId: params.pageId, ...data },
    update: data,
  });
  return NextResponse.json({ tags: parse(meta.tags), tasks: parse(meta.tasks) });
}
