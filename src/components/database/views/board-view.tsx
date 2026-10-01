"use client";

import React from "react";
import {
  PropertySchema,
  DatabaseRow,
  SelectOption,
} from "@/types";
import { Badge, safeBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Maximize2, Calendar } from "lucide-react";

interface BoardViewProps {
  properties: PropertySchema[];
  rows: DatabaseRow[];
  groupByPropertyId?: string;
  onUpdateRow: (rowId: string, properties: Record<string, any>) => void;
  onAddRow: (initialProps?: Record<string, any>) => void;
  onOpenRow: (row: DatabaseRow) => void;
}

export function BoardView({
  properties,
  rows,
  groupByPropertyId,
  onUpdateRow,
  onAddRow,
  onOpenRow,
}: BoardViewProps) {
  // Find grouping property (default to first status or select property)
  const groupProp =
    properties.find((p) => p.id === groupByPropertyId) ||
    properties.find((p) => p.type === "status") ||
    properties.find((p) => p.type === "select") ||
    properties[1];

  const titleProp = properties.find((p) => p.type === "title") || properties[0];
  const dateProp = properties.find((p) => p.type === "date");
  const priorityProp = properties.find((p) => p.name.toLowerCase().includes("priority"));

  const options: SelectOption[] =
    groupProp && groupProp.config.options
      ? groupProp.config.options
      : [
          { id: "todo", name: "To Do", color: "gray" },
          { id: "in_progress", name: "In Progress", color: "blue" },
          { id: "done", name: "Done", color: "green" },
        ];

  // Group rows by option name
  const columns = options.map((opt) => {
    const colRows = rows.filter((r) => {
      const val = groupProp ? r.properties[groupProp.id] : null;
      return val === opt.name || val === opt.id;
    });
    return {
      option: opt,
      rows: colRows,
    };
  });

  // Uncategorized / No Status column
  const uncategorizedRows = rows.filter((r) => {
    const val = groupProp ? r.properties[groupProp.id] : null;
    return !val || !options.some((opt) => opt.name === val || opt.id === val);
  });

  if (uncategorizedRows.length > 0) {
    columns.unshift({
      option: { id: "no_status", name: "No Status", color: "gray" },
      rows: uncategorizedRows,
    });
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetOptName: string) => {
    e.preventDefault();
    const rowId = e.dataTransfer.getData("text/plain");
    if (rowId && groupProp) {
      onUpdateRow(rowId, { [groupProp.id]: targetOptName });
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[450px]">
      {columns.map(({ option, rows: colRows }) => (
        <div
          key={option.id}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, option.name)}
          className="w-72 shrink-0 rounded-xl bg-muted/40 border border-border flex flex-col max-h-[700px] p-2"
        >
          {/* Column Header */}
          <div className="flex items-center justify-between px-2 py-1.5 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant={safeBadgeVariant(option.color)}>{option.name}</Badge>
              <span className="text-xs text-muted-foreground font-semibold">
                {colRows.length}
              </span>
            </div>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                if (groupProp) {
                  onAddRow({ [groupProp.id]: option.name });
                } else {
                  onAddRow();
                }
              }}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {colRows.map((row) => {
              const rowTitle = titleProp ? row.properties[titleProp.id] || "Untitled" : "Untitled";
              const rowDate = dateProp ? row.properties[dateProp.id] : null;
              const rowPriority = priorityProp ? row.properties[priorityProp.id] : null;

              return (
                <div
                  key={row.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", row.id);
                  }}
                  onClick={() => onOpenRow(row)}
                  className="p-3 rounded-lg border border-border bg-card hover:border-indigo-400 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-xs text-foreground line-clamp-2">
                      {rowTitle}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRow(row);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-indigo-500 transition-opacity"
                      title="Open page"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex items-center gap-2 mt-2 pt-1">
                    {rowPriority && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                        {rowPriority}
                      </span>
                    )}

                    {rowDate && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(rowDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Column bottom add button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (groupProp) {
                onAddRow({ [groupProp.id]: option.name });
              } else {
                onAddRow();
              }
            }}
            className="w-full text-xs h-7 mt-2 text-muted-foreground hover:text-foreground justify-start gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </Button>
        </div>
      ))}
    </div>
  );
}
