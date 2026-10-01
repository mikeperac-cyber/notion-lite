"use client";

import React from "react";
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
import {
  Kanban,
  FileCode2,
  CalendarCheck2,
  Sparkles,
  ClipboardList,
} from "lucide-react";

interface TemplateOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  action: (workspaceId: string) => Promise<string>;
}

export function TemplateModal() {
  const router = useRouter();
  const { templateModalOpen, setTemplateModalOpen, currentWorkspace } = useAppStore();

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
      action: async (workspaceId) => {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            title: "RFC: System Architecture",
            icon: "📐",
          }),
        });
        const page = await res.json();

        await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: page.id,
            blocks: [
              { type: "heading_1", content: { text: "RFC: System Architecture & Design" }, order: 0 },
              { type: "callout", content: { icon: "📌", text: "Status: Proposed | Authors: Engineering Lead | Target Release: v1.0" }, order: 1 },
              { type: "heading_2", content: { text: "1. Problem Statement & Motivation" }, order: 2 },
              { type: "paragraph", content: { text: "Explain why this feature or architectural change is necessary." }, order: 3 },
              { type: "heading_2", content: { text: "2. Proposed Architecture" }, order: 4 },
              { type: "code", content: { language: "typescript", code: "interface ServiceProtocol {\n  connect(): Promise<void>;\n  dispatch(event: Event): void;\n}" }, order: 5 },
              { type: "heading_2", content: { text: "3. Action Items" }, order: 6 },
              { type: "todo", content: { text: "Complete schema definition", checked: false }, order: 7 },
              { type: "todo", content: { text: "Implement unit tests", checked: false }, order: 8 },
            ],
          }),
        });

        return page.id;
      },
    },
    {
      id: "meeting_notes",
      title: "Meeting Notes & Action Extractor",
      description: "Structured agenda, key discussion points, and AI-ready action item extraction.",
      icon: "🎙️",
      badge: "Document",
      action: async (workspaceId) => {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            title: "Team Sync & Meeting Notes",
            icon: "🎙️",
          }),
        });
        const page = await res.json();

        await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: page.id,
            blocks: [
              { type: "heading_1", content: { text: "Weekly Team Sync" }, order: 0 },
              { type: "callout", content: { icon: "📅", text: `Date: ${new Date().toLocaleDateString()} | Attendees: Team` }, order: 1 },
              { type: "heading_2", content: { text: "Discussion Agenda" }, order: 2 },
              { type: "bullet_list", content: { text: "Review sprint deliverables" }, order: 3 },
              { type: "bullet_list", content: { text: "Identify blockers and dependencies" }, order: 4 },
              { type: "heading_2", content: { text: "Action Items" }, order: 5 },
              { type: "todo", content: { text: "Deploy staging environment", checked: false }, order: 6 },
            ],
          }),
        });

        return page.id;
      },
    },
  ];

  const handleApply = async (template: TemplateOption) => {
    if (!currentWorkspace?.id) return;
    try {
      const pageId = await template.action(currentWorkspace.id);
      setTemplateModalOpen(false);
      router.push(`/editor/${pageId}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Template Gallery
          </DialogTitle>
          <DialogDescription>
            Choose a starter template to fast-track your docs, trackers, and databases.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => handleApply(tpl)}
              className="p-4 rounded-xl border border-border bg-card hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
            >
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
                <Button size="sm" variant="default" className="text-xs h-7">
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
