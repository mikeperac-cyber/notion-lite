"use client";

import React, { useEffect, useState } from "react";
import {
  PropertySchema,
  PropertyType,
  SelectOption,
} from "@/types";
import { Badge, safeBadgeVariant } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { evaluateFormula } from "@/lib/formula";
import { formatDateTime } from "@/lib/utils";
import { ExternalLink, Calendar, Check, Hash, Type, Sparkles } from "lucide-react";

interface PropertyCellProps {
  property: PropertySchema;
  value: any;
  allRowProperties?: Record<string, any>;
  allProperties?: PropertySchema[];
  onChange: (val: any) => void;
  readOnly?: boolean;
  rowId?: string;
}

const DEFAULT_COLORS = [
  "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"
];

export function PropertyCell({
  property,
  value,
  allRowProperties = {},
  allProperties = [],
  onChange,
  readOnly = false,
  rowId,
}: PropertyCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState(value !== undefined && value !== null ? String(value) : "");
  const [relationRows, setRelationRows] = useState<Array<{ id: string; title: string }>>([]);
  const [rollupValue, setRollupValue] = useState<number | null>(null);
  // Stable snapshot of just the relation value feeding this rollup — depending on
  // the whole allRowProperties object refires the fetch on every parent render.
  const rollupRelationId = property.config?.rollupRelationPropId;
  const rollupInput = JSON.stringify(rollupRelationId ? allRowProperties[rollupRelationId] ?? null : null);
  useEffect(() => {
    if (property.type !== "relation" || !property.config.relationDatabaseId) return;
    if (!isOpen && relationRows.length > 0) return;
    let alive = true;
    fetch(`/api/databases/${property.config.relationDatabaseId}/rows`)
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(data => { if (alive) setRelationRows(data.rows || []); })
      .catch(() => { if (alive) setRelationRows([]); });
    return () => { alive = false; };
  }, [property.type, property.config.relationDatabaseId, isOpen, relationRows.length]);
  useEffect(() => {
    if (property.type !== "rollup" || !rowId) return;
    let alive = true;
    fetch(`/api/databases/${property.databaseId}/rollup?rowId=${encodeURIComponent(rowId)}&propertyId=${encodeURIComponent(property.id)}`)
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(data => { if (alive) setRollupValue(data.value ?? null); })
      .catch(() => { if (alive) setRollupValue(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.type, property.databaseId, property.id, rowId, rollupInput]);

  if (property.type === "relation") {
    const ids: string[] = Array.isArray(value) ? value : [];
    const labels = ids.map(id => relationRows.find(row => row.id === id)?.title || "Removed row");
    if (readOnly) return <span className="text-xs">{labels.join(", ") || "—"}</span>;
    return <Popover open={isOpen} onOpenChange={setIsOpen}><PopoverTrigger asChild><button type="button" className="text-xs text-left min-h-7 w-full px-1 hover:bg-muted rounded">{labels.join(", ") || "Select related rows..."}</button></PopoverTrigger><PopoverContent className="w-60 max-h-64 overflow-y-auto p-2"><div className="space-y-1">{relationRows.map(row => <label key={row.id} className="flex items-center gap-2 text-xs p-1 hover:bg-muted rounded"><input type="checkbox" checked={ids.includes(row.id)} onChange={event => onChange(event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} />{row.title}</label>)}{relationRows.length === 0 && <p className="text-xs text-muted-foreground">No rows in related database.</p>}</div></PopoverContent></Popover>;
  }
  if (property.type === "rollup") return <span className="text-xs font-mono">{rollupValue ?? "—"}</span>;

  // Text / Title / Email / URL
  if (property.type === "text" || property.type === "title" || property.type === "email") {
    if (readOnly) {
      return <span className="text-sm truncate">{value || ""}</span>;
    }
    return (
      <input
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onBlur={() => {
          if (inputText !== value) onChange(inputText);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="Empty"
        className="w-full bg-transparent text-sm outline-none px-1 py-0.5 rounded hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-ring"
      />
    );
  }

  // URL
  if (property.type === "url") {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={() => {
            if (inputText !== value) onChange(inputText);
          }}
          placeholder="https://"
          className="flex-1 bg-transparent text-sm outline-none px-1 py-0.5 rounded hover:bg-muted/40 focus:bg-background"
        />
        {value && (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  // Number
  if (property.type === "number") {
    return (
      <input
        type="number"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onBlur={() => {
          const num = inputText === "" ? null : Number(inputText);
          if (num !== value) onChange(num);
        }}
        placeholder="0"
        className="w-full bg-transparent text-sm outline-none px-1 py-0.5 text-right font-mono rounded hover:bg-muted/40 focus:bg-background"
      />
    );
  }

  // Checkbox
  if (property.type === "checkbox") {
    return (
      <div className="flex items-center justify-center p-1">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
        />
      </div>
    );
  }

  // Date
  if (property.type === "date") {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="date"
          value={value ? String(value).split("T")[0] : ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-sm outline-none cursor-pointer"
        />
      </div>
    );
  }

  // Select / Status
  if (property.type === "select" || property.type === "status") {
    const options: SelectOption[] = property.config.options || [
      { id: "opt1", name: "Option 1", color: "blue" },
      { id: "opt2", name: "Option 2", color: "green" },
    ];
    const selected = options.find((o) => o.name === value || o.id === value);

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer min-h-[28px] flex items-center px-1">
            {selected ? (
              <Badge variant={safeBadgeVariant(selected.color)}>{selected.name}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">Select...</span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1.5">
          <div className="space-y-1">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onChange(opt.name);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted"
              >
                <Badge variant={safeBadgeVariant(opt.color)}>{opt.name}</Badge>
                {value === opt.name && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {value && (
              <button
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-destructive hover:bg-muted rounded"
              >
                Clear
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Multi-Select
  if (property.type === "multi_select") {
    const options: SelectOption[] = property.config.options || [
      { id: "tag1", name: "Tag 1", color: "purple" },
      { id: "tag2", name: "Tag 2", color: "orange" },
    ];
    const currentValues: string[] = Array.isArray(value) ? value : value ? [value] : [];

    const toggleOption = (optName: string) => {
      if (currentValues.includes(optName)) {
        onChange(currentValues.filter((v) => v !== optName));
      } else {
        onChange([...currentValues, optName]);
      }
    };

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer min-h-[28px] flex flex-wrap gap-1 items-center px-1">
            {currentValues.length > 0 ? (
              currentValues.map((val) => {
                const opt = options.find((o) => o.name === val) || { color: "gray", name: val };
                return (
                  <Badge key={val} variant={safeBadgeVariant(opt.color)}>
                    {val}
                  </Badge>
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">Empty</span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-1.5">
          <div className="space-y-1">
            {options.map((opt) => {
              const isChecked = currentValues.includes(opt.name);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.name)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted"
                >
                  <Badge variant={safeBadgeVariant(opt.color)}>{opt.name}</Badge>
                  {isChecked && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Formula Evaluator Cell (Phase 4)
  if (property.type === "formula") {
    const expr = property.config.formulaExpr || "";
    const nameMap: Record<string, string> = {};
    allProperties.forEach((p) => {
      nameMap[p.name] = p.id;
    });

    const evaluated = evaluateFormula(expr, {
      properties: allRowProperties,
      propNameMap: nameMap,
    });

    return (
      <div className="flex items-center gap-1 text-xs font-mono text-indigo-600 dark:text-indigo-400">
        <Sparkles className="h-3 w-3 opacity-60" />
        <span>{evaluated !== null ? String(evaluated) : "—"}</span>
      </div>
    );
  }

  return <span className="text-sm truncate">{String(value || "")}</span>;
}
