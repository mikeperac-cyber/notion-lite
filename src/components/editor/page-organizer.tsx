"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface Choice { id: string; title: string; icon: string | null; parentId: string | null }
interface Task { id: string; title: string; dueAt: string | null; completed: boolean; notified: boolean }

export function PageOrganizer({ pageId, initialParentId }: { pageId: string; initialParentId: string | null }) {
  const { setPagesTree } = useAppStore();
  const [choices, setChoices] = useState<Choice[]>([]);
  const [backlinks, setBacklinks] = useState<Choice[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parentId, setParentId] = useState(initialParentId || "");
  const [tagInput, setTagInput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/pages/${pageId}/meta`).then(response => response.json()),
      fetch("/api/pages/choices").then(response => response.json()),
      fetch(`/api/pages/${pageId}/backlinks`).then(response => response.json()),
    ]).then(([meta, options, links]) => {
      if (!alive) return;
      setTags(meta.tags || []);
      setTasks(meta.tasks || []);
      setChoices(options.pages || []);
      setBacklinks(links.pages || []);
      setParentId(initialParentId || "");
    }).catch(() => { if (alive) setStatus("Could not load page organization."); });
    return () => { alive = false; };
  }, [pageId, initialParentId]);

  const saveTags = async (next: string[]) => {
    const before = tags;
    setTags(next);
    try {
      const response = await fetch(`/api/pages/${pageId}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: next }) });
      if (!response.ok) throw new Error("Could not save tags");
      setStatus("");
      window.dispatchEvent(new Event("pages-meta-updated"));
    } catch (error) { setTags(before); setStatus(error instanceof Error ? error.message : "Could not save tags"); }
  };
  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.some(existing => existing.toLowerCase() === tag.toLowerCase())) return;
    void saveTags([...tags, tag]);
    setTagInput("");
  };
  const saveTasks = async (next: Task[]) => {
    const before = tasks;
    setTasks(next);
    try {
      const response = await fetch(`/api/pages/${pageId}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: next }) });
      if (!response.ok) throw new Error("Could not save tasks");
      setStatus("");
    } catch (error) { setTasks(before); setStatus(error instanceof Error ? error.message : "Could not save tasks"); }
  };
  const addTask = () => {
    if (!taskTitle.trim()) return;
    const dueAt = taskDue ? new Date(taskDue).toISOString() : null;
    void saveTasks([...tasks, { id: crypto.randomUUID(), title: taskTitle.trim(), dueAt, completed: false, notified: false }]);
    setTaskTitle(""); setTaskDue("");
  };
  const moveToNotebook = async (nextParentId: string) => {
    const previous = parentId;
    setParentId(nextParentId);
    try {
      const response = await fetch(`/api/pages/${pageId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: nextParentId || null }) });
      if (!response.ok) throw new Error((await response.json()).error || "Could not move page");
      const workspace = await fetch("/api/workspace").then(result => result.json());
      setPagesTree(workspace.pages || []);
      setStatus("");
    } catch (error) { setParentId(previous); setStatus(error instanceof Error ? error.message : "Could not move page"); }
  };
  const descendants = new Set([pageId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const choice of choices) if (choice.parentId && descendants.has(choice.parentId) && !descendants.has(choice.id)) { descendants.add(choice.id); changed = true; }
  }

  return <section aria-label="Page organization" className="mx-auto mt-2 w-full max-w-4xl rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="notebook-picker" className="font-semibold">Notebook</label>
      <select id="notebook-picker" value={parentId} onChange={event => void moveToNotebook(event.target.value)} className="rounded border border-border bg-background px-2 py-1 max-w-52">
        <option value="">Top level</option>
        {choices.filter(choice => !descendants.has(choice.id)).map(choice => <option key={choice.id} value={choice.id}>{choice.icon || "📄"} {choice.title}</option>)}
      </select>
      <span className="text-muted-foreground">Place this page inside another page.</span>
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold mr-1">Tags</span>
      {tags.map(tag => <span key={tag} className="rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5">{tag} <button aria-label={`Remove ${tag} tag`} onClick={() => void saveTags(tags.filter(item => item !== tag))}>×</button></span>)}
      <input aria-label="New tag" value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="Add tag" className="w-24 rounded border border-border bg-background px-2 py-1" />
      <Button variant="outline" size="xs" onClick={addTag}>Add</Button>
    </div>
    <div className="space-y-1.5 border-t border-border/60 pt-2">
      <p className="font-semibold">Tasks and reminders</p>
      {tasks.map(task => <div key={task.id} className="flex flex-wrap items-center gap-2">
        <input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.completed} onChange={event => void saveTasks(tasks.map(item => item.id === task.id ? { ...item, completed: event.target.checked } : item))} />
        <span className={task.completed ? "line-through text-muted-foreground" : ""}>{task.title}</span>
        {task.dueAt && <time className="text-muted-foreground" dateTime={task.dueAt}>Due {new Date(task.dueAt).toLocaleString()}</time>}
        <button aria-label={`Delete task ${task.title}`} onClick={() => void saveTasks(tasks.filter(item => item.id !== task.id))} className="text-red-600">Delete</button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        <input aria-label="Task title" value={taskTitle} onChange={event => setTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTask(); } }} placeholder="New task" className="min-w-40 rounded border border-border bg-background px-2 py-1" />
        <input aria-label="Task due time" type="datetime-local" value={taskDue} onChange={event => setTaskDue(event.target.value)} className="rounded border border-border bg-background px-2 py-1" />
        <Button variant="outline" size="xs" onClick={addTask}>Add task</Button>
      </div>
    </div>
    <div className="border-t border-border/60 pt-2">
      <span className="font-semibold">Backlinks</span>
      {backlinks.length ? <div className="flex flex-wrap gap-2 mt-1">{backlinks.map(link => <Link key={link.id} href={`/editor/${link.id}`} className="text-indigo-600 hover:underline">{link.icon || "📄"} {link.title}</Link>)}</div> : <p className="text-muted-foreground mt-1">Pages linking here will appear here.</p>}
    </div>
    {status && <p role="status" className="text-red-600">{status}</p>}
  </section>;
}
