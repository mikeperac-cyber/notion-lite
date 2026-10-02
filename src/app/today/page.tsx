"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar/sidebar";
import { SearchModal } from "@/components/search/search-modal";
import { TemplateModal } from "@/components/templates/template-modal";
import { AiChatDrawer } from "@/components/ai/ai-chat-drawer";
import { Button } from "@/components/ui/button";

interface Task {
  id: string;
  source: "page" | "database";
  title: string;
  pageId: string | null;
  pageTitle: string;
  dueAt: string | null;
  completed: boolean;
  taskId?: string;
  databaseId?: string;
  rowId?: string;
  datePropertyId?: string | null;
  checkboxPropertyId?: string | null;
  statusPropertyId?: string | null;
  doneStatus?: string | null;
}

type Filter = "inbox" | "overdue" | "upcoming" | "completed";

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("inbox");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/tasks");
    if (!response.ok) throw new Error("Could not load tasks");
    setTasks((await response.json()).tasks || []);
  }, []);
  useEffect(() => { void load().catch(error => setError(error.message)); }, [load]);

  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();
  const visible = useMemo(() => tasks.filter(task => {
    const due = task.dueAt ? Date.parse(task.dueAt) : null;
    if (filter === "completed") return task.completed;
    if (task.completed) return false;
    if (filter === "overdue") return due !== null && due < now;
    if (filter === "upcoming") return due !== null && due > endOfTodayMs;
    return due === null || due <= endOfTodayMs;
  }).sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)), [tasks, filter, now, endOfTodayMs]);

  const update = async (task: Task, action: "complete" | "snooze") => {
    setBusy(task.id);
    setError("");
    try {
      const nextDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      let response: Response;
      if (task.source === "page") {
        response = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: task.pageId, taskId: task.taskId, action }) });
      } else {
        const propertyId = action === "snooze" ? task.datePropertyId : task.checkboxPropertyId || task.statusPropertyId;
        if (!propertyId) throw new Error("Open the database row to update this task.");
        response = await fetch(`/api/databases/${task.databaseId}/rows`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowId: task.rowId, properties: { [propertyId]: action === "snooze" ? nextDue : task.checkboxPropertyId ? true : task.doneStatus } }) });
      }
      if (!response.ok) throw new Error("Could not update task");
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update task"); }
    finally { setBusy(null); }
  };

  return <div className="flex h-screen w-full overflow-hidden bg-background">
    <Sidebar />
    <main className="h-screen flex-1 overflow-y-auto p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div><h1 className="text-3xl font-bold">Today</h1><p className="mt-1 text-sm text-muted-foreground">Tasks from pages and databases, together in one place.</p></div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Task filter">
          {([ ["inbox", "Today & unscheduled"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["completed", "Completed"] ] as const).map(([id, label]) => <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</Button>)}
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="space-y-2">
          {visible.map(task => <div key={task.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
            <input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.completed} disabled={task.completed || busy === task.id || (task.source === "database" && !task.checkboxPropertyId && !task.doneStatus)} onChange={() => void update(task, "complete")} />
            <div className="min-w-0 flex-1"><p className="font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.pageId ? <Link href={`/editor/${task.pageId}`} className="hover:underline">{task.pageTitle}</Link> : task.pageTitle} · {task.source === "page" ? "Page task" : "Database row"}</p></div>
            {task.dueAt && <time className="text-xs text-muted-foreground" dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleString()}</time>}
            {!task.completed && (task.source === "page" || task.datePropertyId) && <Button size="xs" variant="outline" disabled={busy === task.id} onClick={() => void update(task, "snooze")}>Snooze 1 day</Button>}
          </div>)}
          {!visible.length && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No tasks in this view.</p>}
        </div>
      </div>
    </main>
    <SearchModal /><TemplateModal /><AiChatDrawer />
  </div>;
}
