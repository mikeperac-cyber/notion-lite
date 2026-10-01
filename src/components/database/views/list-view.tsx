"use client";

import React from "react";
import {
  PropertySchema,
  DatabaseRow,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Plus, Maximize2, Trash2, Calendar, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListViewProps {
  properties: PropertySchema[];
  rows: DatabaseRow[];
  onUpdateRow: (rowId: string, properties: Record<string, any>) => void;
  onOpenRow: (row: DatabaseRow) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
}

export function ListView({
  properties,
  rows,
  onUpdateRow,
  onOpenRow,
  onAddRow,
  onDeleteRow,
}: ListViewProps) {
  const titleProp = properties.find((p) => p.type === "title") || properties[0];
  const checkboxProp = properties.find((p) => p.type === "checkbox");
  const statusProp = properties.find((p) => p.type === "status");
  const dateProp = properties.find((p) => p.type === "date");

  return (
    <div className="w-full space-y-1 py-1">
      {rows.map((row) => {
        const title = titleProp ? row.properties[titleProp.id] || "Untitled" : "Untitled";
        const isChecked = checkboxProp ? Boolean(row.properties[checkboxProp.id]) : false;
        const status = statusProp ? row.properties[statusProp.id] : null;
        const date = dateProp ? row.properties[dateProp.id] : null;

        return (
          <div
            key={row.id}
            onClick={() => onOpenRow(row)}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {checkboxProp && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateRow(row.id, { [checkboxProp.id]: !isChecked });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isChecked ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
              )}

              <span className="text-sm font-medium text-foreground truncate">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {status && (
                <Badge variant="blue" className="text-[10px]">
                  {status}
                </Badge>
              )}

              {date && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRow(row);
                  }}
                  className="p-1 rounded hover:bg-muted text-indigo-500"
                  title="Open row as page"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRow(row.id);
                  }}
                  className="p-1 rounded hover:bg-muted text-destructive"
                  title="Delete row"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        onClick={onAddRow}
        className="w-full text-xs h-8 text-muted-foreground hover:text-foreground justify-start gap-2"
      >
        <Plus className="h-3.5 w-3.5" />
        New item
      </Button>
    </div>
  );
}
