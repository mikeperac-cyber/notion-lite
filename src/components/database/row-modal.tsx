"use client";

import React, { useState, useEffect } from "react";
import {
  DatabaseRow,
  PropertySchema,
  PropertyType,
  PageSchema,
} from "@/types";
import { PropertyCell } from "./property-cell";
import { BlockEditor } from "../editor/block-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Calendar, Sparkles } from "lucide-react";
import Link from "next/link";

interface RowModalProps {
  row: DatabaseRow | null;
  properties: PropertySchema[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateRow: (rowId: string, properties: Record<string, any>) => void;
  onDeleteRow: (rowId: string) => void;
}

export function RowModal({
  row,
  properties,
  open,
  onOpenChange,
  onUpdateRow,
  onDeleteRow,
}: RowModalProps) {
  const [rowPage, setRowPage] = useState<PageSchema | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const pageId = row?.pageId;

  useEffect(() => {
    if (!open) { setRowPage(null); return; }
    if (!pageId) return;
    let alive = true;
    setLoadingPage(true);
    fetch(`/api/pages/${pageId}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => { if (alive) setRowPage(data); })
      .catch((error) => { if (alive) console.error(error); })
      .finally(() => { if (alive) setLoadingPage(false); });
    return () => { alive = false; };
  }, [pageId, open]);

  if (!row) return null;

  const titleProp = properties.find((p) => p.type === "title") || properties[0];
  const rowTitle = titleProp ? row.properties[titleProp.id] || "Untitled" : "Untitled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden border-border shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">{row.page?.icon || "📝"}</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Database Row as Page
            </span>
          </div>

          <div className="flex items-center gap-2">
            {row.pageId && (
              <Link href={`/editor/${row.pageId}`} target="_blank">
                <Button variant="ghost" size="xs" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Full page
                </Button>
              </Link>
            )}

            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                onDeleteRow(row.id);
                onOpenChange(false);
              }}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Body */}
        <ScrollArea className="flex-1 p-6 md:p-8">
          {/* Row Title */}
          <div className="mb-6">
            <input
              value={rowTitle}
              onChange={(e) => {
                if (titleProp) {
                  onUpdateRow(row.id, { [titleProp.id]: e.target.value });
                }
              }}
              placeholder="Untitled"
              className="text-2xl md:text-3xl font-bold bg-transparent outline-none w-full border-none placeholder:text-muted-foreground/40 text-foreground"
            />
          </div>

          {/* Properties Grid */}
          <div className="border border-border/80 rounded-xl p-4 bg-muted/20 mb-8 space-y-2.5">
            <div className="text-xs font-semibold text-muted-foreground mb-3">
              Properties
            </div>
            {properties.map((prop) => {
              const val = row.properties[prop.id];

              return (
                <div
                  key={prop.id}
                  className="grid grid-cols-12 gap-3 items-center text-xs"
                >
                  <div className="col-span-4 font-medium text-muted-foreground truncate">
                    {prop.name}
                  </div>
                  <div className="col-span-8">
                    <PropertyCell
                      rowId={row.id}
                      property={prop}
                      value={val}
                      allRowProperties={row.properties}
                      allProperties={properties}
                      onChange={(newVal) =>
                        onUpdateRow(row.id, { [prop.id]: newVal })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row Companion Page Notes & Blocks */}
          <div className="pt-4 border-t border-border/60">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
              Notes & Content
            </h4>

            {row.pageId && (
              <BlockEditor
                key={row.pageId}
                pageId={row.pageId}
                initialBlocks={rowPage?.blocks || []}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
