"use client";

import React, { useState } from "react";
import {
  DatabaseSchema,
  PropertySchema,
  DatabaseRow,
  DatabaseViewSchema,
  ViewType,
  PropertyType,
} from "@/types";
import { TableView } from "./views/table-view";
import { BoardView } from "./views/board-view";
import { CalendarView } from "./views/calendar-view";
import { GalleryView } from "./views/gallery-view";
import { ListView } from "./views/list-view";
import { TimelineView } from "./views/timeline-view";
import { RowModal } from "./row-modal";
import {
  Table as TableIcon,
  Kanban,
  Calendar as CalendarIcon,
  LayoutGrid,
  List as ListIcon,
  Clock,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DatabaseContainerProps {
  database: DatabaseSchema;
  onRefresh?: () => void;
}

const VIEW_ICONS: Record<ViewType, any> = {
  table: TableIcon,
  board: Kanban,
  calendar: CalendarIcon,
  gallery: LayoutGrid,
  list: ListIcon,
  timeline: Clock,
};

export function DatabaseContainer({ database: initialDb, onRefresh }: DatabaseContainerProps) {
  const [database, setDatabase] = useState<DatabaseSchema>(initialDb);
  const [activeViewId, setActiveViewId] = useState<string>(
    initialDb.views[0]?.id || "default"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<DatabaseRow | null>(null);
  const [rowModalOpen, setRowModalOpen] = useState(false);
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewType, setNewViewType] = useState<ViewType>("board");

  // Sync state when initialDb changes from parent
  React.useEffect(() => {
    setDatabase(initialDb);
    if (!activeViewId || !initialDb.views.some((v) => v.id === activeViewId)) {
      setActiveViewId(initialDb.views[0]?.id || "default");
    }
  }, [initialDb, activeViewId]);

  const activeView = React.useMemo(() => {
    return database.views.find((v) => v.id === activeViewId) || database.views[0];
  }, [database.views, activeViewId]);

  // Update a row
  const handleUpdateRow = async (rowId: string, properties: Record<string, any>) => {
    const original = database.rows.find(row => row.id === rowId)?.properties;
    // Optimistic update
    setDatabase((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.id === rowId ? { ...r, properties: { ...r.properties, ...properties } } : r
      ),
    }));

    try {
      const response = await fetch(`/api/databases/${database.id}/rows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId, properties }),
      });
      if (!response.ok) throw new Error("Could not update row");
      setDatabase(prev => ({ ...prev, rows: prev.rows.map(row => row.id === rowId ? { ...row, properties: { ...row.properties } } : row) }));
    } catch (err) {
      console.error(err);
      if (original) setDatabase(prev => ({ ...prev, rows: prev.rows.map(row => row.id === rowId ? { ...row, properties: original } : row) }));
    }
  };

  // Add a row
  const handleAddRow = async (initialProps: Record<string, any> = {}) => {
    try {
      const res = await fetch(`/api/databases/${database.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: initialProps }),
      });
      const newRow = await res.json();
      setDatabase((prev) => ({
        ...prev,
        rows: [...prev.rows, newRow],
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Delete a row
  const handleDeleteRow = async (rowId: string) => {
    setDatabase((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }));

    try {
      await fetch(`/api/databases/${database.id}/rows?rowId=${rowId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Add a property column
  const handleAddProperty = async (name: string, type: PropertyType, config: Record<string, any> = {}) => {
    try {
      const res = await fetch(`/api/databases/${database.id}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, config }),
      });
      const newProp = await res.json();
      setDatabase((prev) => ({
        ...prev,
        properties: [...prev.properties, newProp],
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Delete a property column
  const handleDeleteProperty = async (propertyId: string) => {
    setDatabase((prev) => ({
      ...prev,
      properties: prev.properties.filter((p) => p.id !== propertyId),
    }));

    try {
      await fetch(`/api/databases/${database.id}/properties?propertyId=${propertyId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Add a new view
  const handleCreateView = async () => {
    try {
      const res = await fetch(`/api/databases/${database.id}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newViewName || `${newViewType.toUpperCase()} View`,
          type: newViewType,
        }),
      });
      const newView = await res.json();
      setDatabase((prev) => ({
        ...prev,
        views: [...prev.views, newView],
      }));
      setActiveViewId(newView.id);
      setAddViewOpen(false);
      setNewViewName("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenRow = (row: DatabaseRow) => {
    setSelectedRow(row);
    setRowModalOpen(true);
  };

  // Search and filter rows with memoization
  const filteredRows = React.useMemo(() => {
    if (!searchQuery.trim()) return database.rows;
    const query = searchQuery.toLowerCase();
    return database.rows.filter((row) =>
      Object.values(row.properties).some((val) =>
        String(val).toLowerCase().includes(query)
      )
    );
  }, [database.rows, searchQuery]);

  return (
    <div className="w-full space-y-4 my-6">
      {/* Top Views Tabs Bar & Controls */}
      <div className="flex items-center justify-between border-b border-border pb-2 gap-2 flex-wrap">
        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {database.views.map((view) => {
            const Icon = VIEW_ICONS[view.type] || TableIcon;
            const isActive = view.id === (activeView?.id || database.views[0]?.id);

            return (
              <button
                key={view.id}
                onClick={() => setActiveViewId(view.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{view.name}</span>
              </button>
            );
          })}

          <Button
            variant="ghost"
            size="xs"
            onClick={() => setAddViewOpen(true)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add View
          </Button>
        </div>

        {/* Action & Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="h-7 text-xs pl-7 pr-2.5 rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring w-32 md:w-40"
            />
          </div>

          <Button
            size="xs"
            onClick={() => handleAddRow()}
            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      {/* Render Active View */}
      {activeView && (
        <div className="w-full">
          {activeView.type === "table" && (
            <TableView
              properties={database.properties}
              rows={filteredRows}
              onUpdateRow={handleUpdateRow}
              onAddRow={() => handleAddRow()}
              onDeleteRow={handleDeleteRow}
              onAddProperty={handleAddProperty}
              onDeleteProperty={handleDeleteProperty}
              onOpenRow={handleOpenRow}
            />
          )}

          {activeView.type === "board" && (
            <BoardView
              properties={database.properties}
              rows={filteredRows}
              groupByPropertyId={
                activeView.grouping?.propertyId
                  ? database.properties.find(
                      (p) => p.name === activeView.grouping?.propertyId
                    )?.id
                  : undefined
              }
              onUpdateRow={handleUpdateRow}
              onAddRow={handleAddRow}
              onOpenRow={handleOpenRow}
            />
          )}

          {activeView.type === "calendar" && (
            <CalendarView
              properties={database.properties}
              rows={filteredRows}
              onOpenRow={handleOpenRow}
              onAddRow={handleAddRow}
            />
          )}

          {activeView.type === "gallery" && (
            <GalleryView
              properties={database.properties}
              rows={filteredRows}
              onOpenRow={handleOpenRow}
              onAddRow={() => handleAddRow()}
            />
          )}

          {activeView.type === "list" && (
            <ListView
              properties={database.properties}
              rows={filteredRows}
              onUpdateRow={handleUpdateRow}
              onOpenRow={handleOpenRow}
              onAddRow={() => handleAddRow()}
              onDeleteRow={handleDeleteRow}
            />
          )}

          {activeView.type === "timeline" && (
            <TimelineView
              properties={database.properties}
              rows={filteredRows}
              onOpenRow={handleOpenRow}
              onAddRow={() => handleAddRow()}
            />
          )}
        </div>
      )}

      {/* Add View Modal */}
      <Dialog open={addViewOpen} onOpenChange={setAddViewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Database View</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">View Name</label>
              <input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g. Kanban Board"
                className="w-full text-xs p-2 rounded-md border border-border bg-background outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">View Layout</label>
              <select
                value={newViewType}
                onChange={(e) => setNewViewType(e.target.value as ViewType)}
                className="w-full text-xs p-2 rounded-md border border-border bg-background outline-none"
              >
                <option value="table">Table</option>
                <option value="board">Board (Kanban)</option>
                <option value="calendar">Calendar</option>
                <option value="gallery">Gallery</option>
                <option value="list">List</option>
                <option value="timeline">Timeline</option>
              </select>
            </div>

            <Button onClick={handleCreateView} className="w-full text-xs mt-2">
              Create View
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Row as Page Modal */}
      <RowModal
        row={selectedRow}
        properties={database.properties}
        open={rowModalOpen}
        onOpenChange={setRowModalOpen}
        onUpdateRow={handleUpdateRow}
        onDeleteRow={handleDeleteRow}
      />
    </div>
  );
}
