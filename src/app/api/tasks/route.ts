import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePageMetaTable } from "@/lib/schema-upgrade";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensurePageMetaTable();
    const [metadata, rows] = await Promise.all([
      prisma.pageMeta.findMany({ include: { page: { select: { id: true, title: true, isArchived: true } } } }),
      prisma.row.findMany({ include: { page: { select: { id: true, title: true, isArchived: true } }, database: { include: { page: { select: { id: true, title: true, isArchived: true } }, properties: true } } } }),
    ]);
    const tasks: Array<Record<string, unknown>> = [];
    for (const meta of metadata) {
      if (meta.page.isArchived) continue;
      let pageTasks: any[] = [];
      try { pageTasks = JSON.parse(meta.tasks); } catch {}
      if (!Array.isArray(pageTasks)) continue;
      for (const task of pageTasks) {
        if (!task || typeof task.id !== "string" || typeof task.title !== "string") continue;
        tasks.push({ id: `page:${meta.pageId}:${task.id}`, source: "page", title: task.title, pageId: meta.pageId, pageTitle: meta.page.title, dueAt: task.dueAt || null, completed: Boolean(task.completed), taskId: task.id });
      }
    }
    for (const row of rows) {
      if (row.page?.isArchived || row.database.page?.isArchived) continue;
      const properties = row.database.properties;
      const date = properties.find(property => property.type === "date" && /due|deadline/i.test(property.name));
      const checkbox = properties.find(property => property.type === "checkbox" && /complete|done/i.test(property.name));
      const status = properties.find(property => property.type === "status");
      if (!date && !checkbox && !status) continue;
      const titleProperty = properties.find(property => property.type === "title");
      let values: Record<string, any> = {};
      try { values = JSON.parse(row.properties); } catch {}
      const title = String((titleProperty && values[titleProperty.id]) || row.page?.title || "Untitled task");
      const dueAt = date ? values[date.id] || null : null;
      const statusValue = status ? String(values[status.id] || "") : "";
      let doneStatus: string | null = null;
      try { doneStatus = JSON.parse(status?.config || "{}").options?.find((option: { name: string }) => /^(done|complete|completed)$/i.test(option.name))?.name || null; } catch {}
      tasks.push({ id: `row:${row.id}`, source: "database", title, pageId: row.pageId || row.database.pageId, pageTitle: row.database.page?.title || row.database.title, dueAt, completed: Boolean((checkbox && values[checkbox.id]) || /^(done|complete|completed)$/i.test(statusValue)), databaseId: row.databaseId, rowId: row.id, datePropertyId: date?.id || null, checkboxPropertyId: checkbox?.id || null, statusPropertyId: status?.id || null, doneStatus });
    }
    return NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("List tasks failed", error);
    return NextResponse.json({ error: "Could not load tasks" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { pageId, taskId, action } = await request.json();
    if (typeof pageId !== "string" || typeof taskId !== "string" || !["complete", "snooze"].includes(action)) return NextResponse.json({ error: "Invalid task update" }, { status: 400 });
    const changed = await prisma.$transaction(async tx => {
      const meta = await tx.pageMeta.findUnique({ where: { pageId } });
      if (!meta) return false;
      const tasks = JSON.parse(meta.tasks);
      if (!Array.isArray(tasks)) return false;
      const task = tasks.find(item => item.id === taskId);
      if (!task) return false;
      if (action === "complete") task.completed = true;
      else { task.dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); task.notified = false; }
      await tx.pageMeta.update({ where: { pageId }, data: { tasks: JSON.stringify(tasks) } });
      return true;
    });
    return changed ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Task not found" }, { status: 404 });
  } catch (error) {
    console.error("Update task failed", error);
    return NextResponse.json({ error: "Could not update task" }, { status: 500 });
  }
}
