/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import {
  PropertySchema,
  DatabaseRow,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Plus, Maximize2, Calendar } from "lucide-react";

interface GalleryViewProps {
  properties: PropertySchema[];
  rows: DatabaseRow[];
  onOpenRow: (row: DatabaseRow) => void;
  onAddRow: () => void;
}

export function GalleryView({
  properties,
  rows,
  onOpenRow,
  onAddRow,
}: GalleryViewProps) {
  const titleProp = properties.find((p) => p.type === "title") || properties[0];
  const statusProp = properties.find((p) => p.type === "status");
  const priorityProp = properties.find((p) => p.name.toLowerCase().includes("priority"));
  const dateProp = properties.find((p) => p.type === "date");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2">
      {rows.map((row) => {
        const title = titleProp ? row.properties[titleProp.id] || "Untitled" : "Untitled";
        const status = statusProp ? row.properties[statusProp.id] : null;
        const priority = priorityProp ? row.properties[priorityProp.id] : null;
        const date = dateProp ? row.properties[dateProp.id] : null;

        const cover = row.page?.cover || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";

        return (
          <div
            key={row.id}
            onClick={() => onOpenRow(row)}
            className="rounded-xl border border-border bg-card overflow-hidden hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all flex flex-col group"
          >
            {/* Cover image */}
            <div className="h-28 w-full bg-muted overflow-hidden relative">
              <img
                src={cover}
                alt="Card cover"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur rounded p-1 shadow-xs transition-opacity">
                <Maximize2 className="h-3.5 w-3.5 text-indigo-500" />
              </div>
            </div>

            {/* Card Content */}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-base">{row.page?.icon || "📝"}</span>
                  <h4 className="font-semibold text-xs line-clamp-1 text-foreground">
                    {title}
                  </h4>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {status && (
                    <Badge variant="blue" className="text-[10px]">
                      {status}
                    </Badge>
                  )}
                  {priority && (
                    <Badge variant="orange" className="text-[10px]">
                      {priority}
                    </Badge>
                  )}
                </div>
              </div>

              {date && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/40">
                  <Calendar className="h-3 w-3" />
                  {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Card Button */}
      <button
        onClick={onAddRow}
        className="h-44 rounded-xl border border-dashed border-border hover:border-indigo-400 hover:bg-muted/20 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all gap-2"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-medium">Add new card</span>
      </button>
    </div>
  );
}
