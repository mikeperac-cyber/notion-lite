"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard, Command } from "lucide-react";

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);
  const shortcuts = [
    {
      category: "Navigation & App",
      items: [
        { keys: ["⌘ / Ctrl", "K"], action: "Quick search & jump to page" },
        { keys: ["⌘ / Ctrl", "N"], action: "Create new page" },
        { keys: ["⌘ / Ctrl", "/"], action: "Open this keyboard shortcuts modal" },
      ],
    },
    {
      category: "Block Commands & Insertion",
      items: [
        { keys: ["/"], action: "Open slash command menu for blocks" },
        { keys: ["#", "Space"], action: "Insert Heading 1" },
        { keys: ["##", "Space"], action: "Insert Heading 2" },
        { keys: ["-", "Space"], action: "Insert Bullet List" },
        { keys: ["[]", "Space"], action: "Insert To-do Checklist" },
        { keys: [">", "Space"], action: "Insert Quote / Callout" },
        { keys: ["```", "Space"], action: "Insert Code Block" },
        { keys: ["---"], action: "Insert Horizontal Divider" },
      ],
    },
    {
      category: "Rich Formatting",
      items: [
        { keys: ["⌘ / Ctrl", "B"], action: "Bold text" },
        { keys: ["⌘ / Ctrl", "I"], action: "Italicize text" },
        { keys: ["⌘ / Ctrl", "E"], action: "Inline code" },
        { keys: ["⌘ / Ctrl", "Shift", "S"], action: "Strikethrough text" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-indigo-500" />
            Keyboard Shortcuts & Syntax
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {shortcuts.map((section) => (
            <div key={section.category} className="space-y-2">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {section.category}
              </h4>
              <div className="space-y-1.5">
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/40"
                  >
                    <span className="text-foreground">{item.action}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kidx) => (
                        <kbd
                          key={kidx}
                          className="bg-muted px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-muted-foreground shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
