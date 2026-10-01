"use client";

import React from "react";
import {
  PropertySchema,
  DatabaseRow,
} from "@/types";
import { Plus, Calendar as CalIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineViewProps {
  properties: PropertySchema[];
  rows: DatabaseRow[];
  onOpenRow: (row: DatabaseRow) => void;
  onAddRow: () => void;
}

export function TimelineView({
  properties,
  rows,
  onOpenRow,
  onAddRow,
}: TimelineViewProps) {
  const titleProp = properties.find((p) => p.type === "title") || properties[0];
  const dateProp = properties.find((p) => p.type === "date");
  const estimateProp = properties.find((p) => p.name.toLowerCase().includes("estimate") || p.type === "number");

  // Timeline spans current month + next 14 days
  const today = new Date();
  const timelineDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i - 2);
    return d;
  });

  return (
    <div className="w-full border border-border rounded-xl bg-card overflow-x-auto shadow-xs">
      {/* Header bar */}
      <div className="flex border-b border-border bg-muted/40 min-w-[800px]">
        <div className="w-60 p-2.5 font-semibold text-xs text-muted-foreground border-r border-border shrink-0">
          Items
        </div>
        <div className="flex-1 grid grid-cols-14 divide-x divide-border/60 text-center text-[11px] text-muted-foreground py-2 font-medium">
          {timelineDays.map((d, i) => (
            <div
              key={i}
              className={`px-1 ${
                d.toDateString() === today.toDateString()
                  ? "bg-indigo-500/10 text-indigo-600 font-bold"
                  : ""
              }`}
            >
              <div>{d.toLocaleDateString("en-US", { weekday: "narrow" })}</div>
              <div className="text-[10px]">{d.getDate()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60 min-w-[800px]">
        {rows.map((row) => {
          const title = titleProp ? row.properties[titleProp.id] || "Untitled" : "Untitled";
          const date = dateProp ? row.properties[dateProp.id] : null;
          const estimate = estimateProp ? Number(row.properties[estimateProp.id]) || 1 : 1;

          // Compute relative offset on timeline
          let startIndex = 2; // default to today
          if (date) {
            const targetDate = new Date(date);
            if (!isNaN(targetDate.getTime())) {
              const diffDays = Math.round(
                (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );
              startIndex = Math.max(0, Math.min(12, diffDays + 2));
            }
          }

          const validEstimate = isNaN(estimate) || estimate <= 0 ? 1 : estimate;
          const barWidthDays = Math.max(1, Math.min(4, Math.ceil(validEstimate / 4)));

          return (
            <div
              key={row.id}
              onClick={() => onOpenRow(row)}
              className="flex items-center hover:bg-muted/20 cursor-pointer transition-colors h-11 group"
            >
              <div className="w-60 px-3 text-xs font-medium text-foreground truncate border-r border-border/60 shrink-0">
                {title}
              </div>

              <div className="flex-1 h-full relative flex items-center px-1">
                {/* Visual duration bar */}
                <div
                  style={{
                    marginLeft: `${(startIndex / 14) * 100}%`,
                    width: `${(barWidthDays / 14) * 100}%`,
                  }}
                  className="h-7 rounded-md bg-indigo-500/80 hover:bg-indigo-600 text-white text-[11px] px-2 flex items-center justify-between shadow-xs truncate transition-all cursor-pointer"
                >
                  <span className="truncate font-medium">{title}</span>
                  <span className="text-[9px] opacity-80 shrink-0 ml-1">
                    {estimate}h
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-border/40">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddRow}
          className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add timeline task
        </Button>
      </div>
    </div>
  );
}
