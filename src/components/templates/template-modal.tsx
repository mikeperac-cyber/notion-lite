"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { Sparkles } from "lucide-react";

interface TemplateOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  action: (workspaceId: string) => Promise<string>;
}

type BlockSeed = { type: "heading_1" | "heading_2" | "paragraph" | "callout" | "bullet_list" | "todo"; text: string };
type PropertySeed = { name: string; type: string; config?: Record<string, unknown> };
type ViewSeed = { name: string; type: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not create template content");
  return data as T;
}

function blockNode(seed: BlockSeed, id: string) {
  const text = [{ type: "text", text: seed.text }];
  const paragraph = { type: "paragraph", content: text };
  if (seed.type.startsWith("heading_")) return { type: "heading", attrs: { id, level: Number(seed.type.slice(-1)) }, content: text };
  if (seed.type === "callout") return { type: "callout", attrs: { id, variant: "info" }, content: [paragraph] };
  if (seed.type === "bullet_list") return { type: "bulletList", attrs: { id }, content: [{ type: "listItem", content: [paragraph] }] };
  if (seed.type === "todo") return { type: "taskList", attrs: { id }, content: [{ type: "taskItem", attrs: { checked: false }, content: [paragraph] }] };
  return { type: "paragraph", attrs: { id }, content: text };
}

async function createDocument(workspaceId: string, title: string, icon: string, blocks: BlockSeed[]) {
  const page = await postJson<{ id: string }>("/api/pages", { workspaceId, title, icon });
  const previousResponse = await fetch(`/api/pages/${page.id}`);
  if (!previousResponse.ok) throw new Error("Could not load the new page");
  const previous = await previousResponse.json();
  const changedBlocks = blocks.map((seed, order) => {
    const id = crypto.randomUUID();
    return { id, type: seed.type, order, content: { text: seed.text, node: blockNode(seed, id) } };
  });
  await postJson("/api/blocks", { pageId: page.id, deletedBlockIds: (previous.blocks || []).map((block: { id: string }) => block.id), changedBlocks });
  return page.id;
}

async function createDatabase(workspaceId: string, title: string, icon: string, properties: PropertySeed[], views: ViewSeed[]) {
  const page = await postJson<{ id: string; database?: { id: string } }>("/api/pages", { workspaceId, title, icon, isDatabase: true });
  if (!page.database?.id) throw new Error("Database was not created");
  for (const property of properties) await postJson(`/api/databases/${page.database.id}/properties`, property);
  for (const view of views) await postJson(`/api/databases/${page.database.id}/views`, view);
  return page.id;
}

const selectOptions = (entries: Array<[string, string]>) => ({ options: entries.map(([name, color]) => ({ id: name.toLowerCase().replace(/\W+/g, "_"), name, color })) });

export function TemplateModal() {
  const router = useRouter();
  const { templateModalOpen, setTemplateModalOpen, currentWorkspace, setPagesTree } = useAppStore();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const templates: TemplateOption[] = [
    {
      id: "sprint_board",
      title: "Sprint & Kanban Board",
      description: "Agile task tracking with Status board, Priorities, Estimates, and Calendar views.",
      icon: "⚡",
      badge: "Database",
      action: async (workspaceId) => {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            title: "Sprint Tracker",
            icon: "⚡",
            isDatabase: true,
          }),
        });
        const page = await res.json();
        if (!res.ok || !page.database?.id) throw new Error("Could not create Sprint Tracker");
        for (const property of [
          { name: "Priority", type: "select", config: { options: [{ id: "high", name: "High", color: "red" }, { id: "medium", name: "Medium", color: "yellow" }, { id: "low", name: "Low", color: "blue" }] } },
          { name: "Estimate (hrs)", type: "number", config: {} },
          { name: "Due Date", type: "date", config: {} },
          { name: "Sprint", type: "text", config: {} },
        ]) {
          const created = await fetch(`/api/databases/${page.database.id}/properties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(property) });
          if (!created.ok) throw new Error("Could not seed Sprint properties");
        }
        const calendar = await fetch(`/api/databases/${page.database.id}/views`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Calendar", type: "calendar" }) });
        if (!calendar.ok) throw new Error("Could not create Calendar view");
        return page.id;
      },
    },
    {
      id: "rfc_doc",
      title: "Technical Architecture RFC",
      description: "Standard engineering RFC structure: context, system architecture, API spec, and rollout plan.",
      icon: "📐",
      badge: "Document",
      action: workspaceId => createDocument(workspaceId, "RFC: System Architecture", "📐", [
        { type: "heading_1", text: "System Architecture RFC" },
        { type: "callout", text: "Status: Proposed · Owner: · Target date:" },
        { type: "heading_2", text: "Problem and context" }, { type: "paragraph", text: "What needs to change, and why now?" },
        { type: "heading_2", text: "Proposal" }, { type: "paragraph", text: "Describe the design and alternatives considered." },
        { type: "heading_2", text: "Risks and rollout" }, { type: "paragraph", text: "List risks, mitigations and release steps." },
        { type: "heading_2", text: "Action items" }, { type: "todo", text: "Review the proposal with the team" },
      ]),
    },
    {
      id: "meeting_notes",
      title: "Meeting Notes & Action Extractor",
      description: "Structured agenda, key discussion points, and AI-ready action item extraction.",
      icon: "🎙️",
      badge: "Document",
      action: workspaceId => createDocument(workspaceId, "Meeting Notes", "🎙️", [
        { type: "heading_1", text: "Meeting Notes" }, { type: "callout", text: "Date: · Attendees: · Purpose:" },
        { type: "heading_2", text: "Agenda" }, { type: "bullet_list", text: "Add the first agenda item" },
        { type: "heading_2", text: "Discussion" }, { type: "paragraph", text: "Record key points and questions." },
        { type: "heading_2", text: "Decisions" }, { type: "paragraph", text: "What did the group decide?" },
        { type: "heading_2", text: "Action items" }, { type: "todo", text: "Assign the first follow-up" },
      ]),
    },
    {
      id: "project_planner", title: "Project Planner", description: "Plan deliverables with priority, deadlines, progress and timeline views.", icon: "🗂️", badge: "Database",
      action: workspaceId => createDatabase(workspaceId, "Project Planner", "🗂️", [
        { name: "Priority", type: "select", config: selectOptions([["High", "red"], ["Medium", "yellow"], ["Low", "blue"]]) },
        { name: "Deadline", type: "date" }, { name: "Progress (%)", type: "number" },
        { name: "Workstream", type: "select", config: selectOptions([["Planning", "purple"], ["Delivery", "blue"], ["Review", "green"]]) },
      ], [{ name: "Timeline", type: "timeline" }, { name: "Calendar", type: "calendar" }]),
    },
    {
      id: "daily_planner", title: "Daily Planner", description: "Set top priorities, time blocks and a realistic task list for today.", icon: "☀️", badge: "Document",
      action: workspaceId => createDocument(workspaceId, "Daily Planner", "☀️", [
        { type: "heading_1", text: "Daily Planner" }, { type: "callout", text: "Date: · Main focus:" },
        { type: "heading_2", text: "Top priorities" }, { type: "todo", text: "Finish the most important task" },
        { type: "todo", text: "Make progress on the second priority" },
        { type: "heading_2", text: "Time blocks" }, { type: "paragraph", text: "Morning: · Afternoon: · Evening:" },
        { type: "heading_2", text: "Notes and follow-ups" }, { type: "paragraph", text: "Capture interruptions and ideas here." },
      ]),
    },
    {
      id: "weekly_review", title: "Weekly Review", description: "Review wins, blockers, unfinished work and next week's priorities.", icon: "🔄", badge: "Document",
      action: workspaceId => createDocument(workspaceId, "Weekly Review", "🔄", [
        { type: "heading_1", text: "Weekly Review" }, { type: "callout", text: "Week of: · Overall progress:" },
        { type: "heading_2", text: "Wins" }, { type: "bullet_list", text: "What went well?" },
        { type: "heading_2", text: "Blockers and lessons" }, { type: "paragraph", text: "What slowed you down, and what did you learn?" },
        { type: "heading_2", text: "Carry forward" }, { type: "todo", text: "Review unfinished tasks" },
        { type: "heading_2", text: "Next week" }, { type: "todo", text: "Choose the top priority" },
      ]),
    },
    {
      id: "habit_tracker", title: "Habit Tracker", description: "Log routines with frequency, goals, completion and calendar views.", icon: "✅", badge: "Database",
      action: workspaceId => createDatabase(workspaceId, "Habit Tracker", "✅", [
        { name: "Frequency", type: "select", config: selectOptions([["Daily", "blue"], ["Weekly", "purple"], ["Monthly", "orange"]]) },
        { name: "Goal", type: "number" }, { name: "Completed", type: "checkbox" }, { name: "Date", type: "date" },
      ], [{ name: "Calendar", type: "calendar" }, { name: "Checklist", type: "list" }]),
    },
    {
      id: "reading_list", title: "Reading List", description: "Organize books and articles by format, rating and reading dates.", icon: "📚", badge: "Database",
      action: workspaceId => createDatabase(workspaceId, "Reading List", "📚", [
        { name: "Author or Source", type: "text" },
        { name: "Format", type: "select", config: selectOptions([["Book", "purple"], ["Article", "blue"], ["Paper", "green"]]) },
        { name: "Rating", type: "number" }, { name: "Started", type: "date" }, { name: "Finished", type: "date" },
      ], [{ name: "Gallery", type: "gallery" }, { name: "Reading List", type: "list" }]),
    },
  ];

  const handleApply = async (template: TemplateOption) => {
    if (!currentWorkspace?.id || applyingId) return;
    setApplyingId(template.id);
    setError("");
    try {
      const pageId = await template.action(currentWorkspace.id);
      const workspaceResponse = await fetch("/api/workspace");
      if (!workspaceResponse.ok) throw new Error("Could not refresh workspace");
      const workspace = await workspaceResponse.json();
      setPagesTree(workspace.pages || []);
      setTemplateModalOpen(false);
      router.push(`/editor/${pageId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create template");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Template Gallery
          </DialogTitle>
          <DialogDescription>
            Choose a starter template to fast-track your docs, trackers, and databases.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{tpl.icon}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {tpl.badge}
                  </span>
                </div>
                <h4 className="font-semibold text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {tpl.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <Button size="sm" variant="default" className="text-xs h-7" disabled={Boolean(applyingId)} onClick={() => void handleApply(tpl)}>
                  {applyingId === tpl.id ? "Creating..." : `Use ${tpl.title}`}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
