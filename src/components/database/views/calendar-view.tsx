"use client";

import React, { useState } from "react";
import {
  PropertySchema,
  DatabaseRow,
} from "@/types";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarViewProps {
  properties: PropertySchema[];
  rows: DatabaseRow[];
  onOpenRow: (row: DatabaseRow) => void;
  onAddRow: (initialProps?: Record<string, any>) => void;
}

export function CalendarView({
  properties,
  rows,
  onOpenRow,
  onAddRow,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const dateProp = properties.find((p) => p.type === "date");
  const titleProp = properties.find((p) => p.type === "title") || properties[0];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  return (
    <div className="w-full border border-border rounded-xl bg-card overflow-hidden shadow-xs">
      {/* Calendar Header Nav */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <CalIcon className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-sm">
            {monthName} {year}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="xs" onClick={today} className="text-xs h-7">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground py-2">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-7 auto-rows-[110px] divide-x divide-y divide-border/60">
        {paddingArray.map((_, i) => (
          <div key={`pad-${i}`} className="bg-muted/10 p-1.5" />
        ))}

        {daysArray.map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayRows = rows.filter((r) => {
            if (!dateProp) return false;
            const rDate = r.properties[dateProp.id];
            if (!rDate) return false;
            const str = String(rDate);
            return str.startsWith(dateStr) || str.slice(0, 10) === dateStr;
          });

          const isCurrentDay =
            new Date().toDateString() === new Date(year, month, day).toDateString();

          return (
            <div
              key={day}
              className={`p-1.5 flex flex-col justify-between group/day hover:bg-muted/30 transition-colors ${
                isCurrentDay ? "bg-indigo-500/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    isCurrentDay
                      ? "bg-indigo-600 text-white font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {day}
                </span>

                <button
                  onClick={() => {
                    if (dateProp) {
                      onAddRow({ [dateProp.id]: dateStr });
                    } else {
                      onAddRow();
                    }
                  }}
                  className="opacity-0 group-hover/day:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground"
                  title="Add task on this date"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Event items on this day */}
              <div className="space-y-1 overflow-y-auto max-h-[75px] mt-1">
                {dayRows.map((row) => {
                  const title = titleProp ? row.properties[titleProp.id] || "Untitled" : "Untitled";
                  return (
                    <div
                      key={row.id}
                      onClick={() => onOpenRow(row)}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium truncate cursor-pointer hover:bg-indigo-500/20 border border-indigo-500/20"
                    >
                      {title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
