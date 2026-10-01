"use client";

import React, { useState } from "react";
import {
  PropertySchema,
  DatabaseRow,
  PropertyType,
} from "@/types";
import { PropertyCell } from "../property-cell";
import {
  Plus,
  Maximize2,
  Trash2,
  MoreHorizontal,
  Type,
  Hash,
  CheckSquare,
  Calendar,
  Tag,
  Link2,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TableViewProps {
  properties: PropertySchema[];
  rows: DatabaseRow[];
  onUpdateRow: (rowId: string, properties: Record<string, any>) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onAddProperty: (name: string, type: PropertyType, config?: Record<string, any>) => void;
  onDeleteProperty: (propertyId: string) => void;
  onOpenRow: (row: DatabaseRow) => void;
}

const PROPERTY_TYPES: { type: PropertyType; label: string; icon: any }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "number", label: "Number", icon: Hash },
  { type: "select", label: "Select", icon: Tag },
  { type: "multi_select", label: "Multi-select", icon: Tag },
  { type: "status", label: "Status", icon: Tag },
  { type: "date", label: "Date", icon: Calendar },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "url", label: "URL", icon: Link2 },
  { type: "formula", label: "Formula", icon: Sparkles },
  { type: "relation", label: "Relation", icon: Link2 },
  { type: "rollup", label: "Rollup", icon: Sparkles },
];

export function TableView({
  properties,
  rows,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
  onAddProperty,
  onDeleteProperty,
  onOpenRow,
}: TableViewProps) {
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState<PropertyType>("text");
  const [addPropOpen, setAddPropOpen] = useState(false);
  const [databaseChoices, setDatabaseChoices] = useState<Array<{ id: string; title: string; properties: PropertySchema[] }>>([]);
  const [targetDatabaseId, setTargetDatabaseId] = useState("");
  const [relationPropertyId, setRelationPropertyId] = useState("");
  const [targetPropertyId, setTargetPropertyId] = useState("");
  const [rollupFunction, setRollupFunction] = useState("count_all");

  React.useEffect(() => { if (addPropOpen) fetch("/api/databases/choices").then(response => response.json()).then(data => setDatabaseChoices(data.databases || [])).catch(() => setDatabaseChoices([])); }, [addPropOpen]);

  const handleCreateProp = () => {
    if (!newPropName.trim()) return;
    const relation = properties.find(property => property.id === relationPropertyId);
    const config = newPropType === "relation" ? { relationDatabaseId: targetDatabaseId } : newPropType === "rollup" ? { rollupRelationPropId: relationPropertyId, rollupTargetPropId: targetPropertyId, rollupFunction } : {};
    if (newPropType === "relation" && !targetDatabaseId) return;
    if (newPropType === "rollup" && (!relation || !targetPropertyId)) return;
    onAddProperty(newPropName.trim(), newPropType, config);
    setNewPropName("");
    setNewPropType("text");
    setAddPropOpen(false);
  };

  const getPropIcon = (type: PropertyType) => {
    const item = PROPERTY_TYPES.find((p) => p.type === type);
    const Icon = item ? item.icon : Type;
    return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="w-full overflow-x-auto border border-border rounded-lg bg-card shadow-xs">
      <table className="w-full text-left border-collapse text-sm">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-10 px-2 py-2 text-center text-xs text-muted-foreground font-normal border-r border-border">
              #
            </th>
            {properties.map((prop, idx) => (
              <th
                key={prop.id}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground border-r border-border min-w-[160px] group/col"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    {getPropIcon(prop.type)}
                    <span className="truncate text-foreground font-medium">
                      {prop.name}
                    </span>
                  </div>

                  {prop.type !== "title" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={() => onDeleteProperty(prop.id)}
                          className="text-destructive focus:text-destructive text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete column
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </th>
            ))}

            {/* Add Column Button */}
            <th className="w-12 px-2 py-2">
              <Popover open={addPropOpen} onOpenChange={setAddPropOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="xs" className="h-6 w-6 p-0 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-3">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold">New Column Property</p>
                    <input
                      value={newPropName}
                      onChange={(e) => setNewPropName(e.target.value)}
                      placeholder="Property name..."
                      className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-transparent outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Property Type</label>
                      <select
                        value={newPropType}
                        onChange={(e) => setNewPropType(e.target.value as PropertyType)}
                        className="w-full text-xs p-1.5 rounded-md border border-border bg-background outline-none"
                      >
                        {PROPERTY_TYPES.map((t) => (
                          <option key={t.type} value={t.type}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {newPropType === "relation" && <select aria-label="Related database" className="w-full text-xs p-1.5 border rounded bg-background" value={targetDatabaseId} onChange={event => setTargetDatabaseId(event.target.value)}><option value="">Choose a database</option>{databaseChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.title}</option>)}</select>}
                    {newPropType === "rollup" && <>
                      <select aria-label="Relation property" className="w-full text-xs p-1.5 border rounded bg-background" value={relationPropertyId} onChange={event => { setRelationPropertyId(event.target.value); setTargetPropertyId(""); }}><option value="">Choose a relation</option>{properties.filter(property => property.type === "relation").map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
                      <select aria-label="Related property" className="w-full text-xs p-1.5 border rounded bg-background" value={targetPropertyId} onChange={event => setTargetPropertyId(event.target.value)}><option value="">Choose a property</option>{databaseChoices.find(choice => choice.id === properties.find(property => property.id === relationPropertyId)?.config.relationDatabaseId)?.properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
                      <select aria-label="Rollup function" className="w-full text-xs p-1.5 border rounded bg-background" value={rollupFunction} onChange={event => setRollupFunction(event.target.value)}>{["count_all", "count_values", "count_unique", "sum", "avg", "min", "max", "percent_checked"].map(value => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select>
                    </>}
                    <Button size="sm" onClick={handleCreateProp} className="w-full text-xs h-7">
                      Create Column
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className="border-b border-border/60 hover:bg-muted/30 transition-colors group/row"
            >
              <td className="px-2 py-2 text-center text-xs text-muted-foreground/60 border-r border-border/60">
                <span className="group-hover/row:hidden">{index + 1}</span>
                <button
                  onClick={() => onDeleteRow(row.id)}
                  title="Delete row"
                  className="hidden group-hover/row:inline-block text-destructive hover:text-destructive/80 p-0.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>

              {properties.map((prop) => {
                const cellVal = row.properties[prop.id];
                const isTitle = prop.type === "title";

                return (
                  <td
                    key={prop.id}
                    className="px-2.5 py-1.5 border-r border-border/60 align-middle relative group/cell"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <PropertyCell
                          rowId={row.id}
                          property={prop}
                          value={cellVal}
                          allRowProperties={row.properties}
                          allProperties={properties}
                          onChange={(newVal) =>
                            onUpdateRow(row.id, { [prop.id]: newVal })
                          }
                        />
                      </div>

                      {isTitle && (
                        <button
                          onClick={() => onOpenRow(row)}
                          className="opacity-0 group-hover/row:opacity-100 flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-600 bg-background/80 shadow-xs border border-border px-1.5 py-0.5 rounded transition-all ml-1 shrink-0"
                          title="Open row as full page"
                        >
                          <Maximize2 className="h-3 w-3" />
                          <span>Open</span>
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Row Button at Bottom */}
      <div className="p-2 border-t border-border/40 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddRow}
          className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New row
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
      </div>
    </div>
  );
}
