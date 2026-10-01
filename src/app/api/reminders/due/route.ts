import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePageMetaTable } from "@/lib/schema-upgrade";
import type { PageTask } from "@/app/api/pages/[pageId]/meta/route";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensurePageMetaTable();
    const rows = await prisma.pageMeta.findMany();
    const pages = await prisma.page.findMany({ where: { id: { in: rows.map(row => row.pageId) }, isArchived: false }, select: { id: true, title: true } });
    const titles = new Map(pages.map(page => [page.id, page.title]));
    const due: Array<{ pageId: string; pageTitle: string; taskId: string; title: string; dueAt: string }> = [];
    for (const row of rows) {
      if (!titles.has(row.pageId)) continue;
      let tasks: PageTask[] = [];
      try { tasks = JSON.parse(row.tasks); } catch {}
      if (!Array.isArray(tasks)) continue;
      for (const task of tasks) if (!task.completed && !task.notified && task.dueAt && Date.parse(task.dueAt) <= Date.now()) {
        due.push({ pageId: row.pageId, pageTitle: titles.get(row.pageId)!, taskId: task.id, title: task.title, dueAt: task.dueAt });
      }
    }
    return NextResponse.json({ due });
  } catch (error: any) {
    console.error("List Due Reminders Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list reminders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensurePageMetaTable();
    const { pageId, taskId } = await request.json();
    if (typeof pageId !== "string" || typeof taskId !== "string") return NextResponse.json({ error: "Invalid reminder" }, { status: 400 });
    const meta = await prisma.pageMeta.findUnique({ where: { pageId } });
    if (!meta) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    let tasks: PageTask[] = [];
    try { tasks = JSON.parse(meta.tasks); } catch { return NextResponse.json({ error: "Reminder data is invalid" }, { status: 400 }); }
    if (!Array.isArray(tasks)) return NextResponse.json({ error: "Reminder data is invalid" }, { status: 400 });
    const task = tasks.find(item => item.id === taskId);
    if (!task) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    task.notified = true;
    await prisma.pageMeta.update({ where: { pageId }, data: { tasks: JSON.stringify(tasks) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Acknowledge Reminder Error:", error);
    return NextResponse.json({ error: error.message || "Failed to acknowledge reminder" }, { status: 500 });
  }
}
