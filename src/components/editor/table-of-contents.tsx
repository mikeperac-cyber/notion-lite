"use client";

import React, { useState, useEffect, useRef } from "react";
import { ListTree, ChevronDown, ChevronUp } from "lucide-react";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<MutationObserver | null>(null);

  const scanHeadings = () => {
    const editorEl = document.querySelector(".tiptap");
    if (!editorEl) {
      setHeadings([]);
      return;
    }

    const elements = editorEl.querySelectorAll("h1, h2, h3");
    const items: HeadingItem[] = [];

    elements.forEach((el, index) => {
      const text = el.textContent || "";
      if (text.trim()) {
        const id = `heading-${index}`;
        if (el.id !== id) el.id = id;
        const level = parseInt(el.tagName.replace("H", ""), 10);
        items.push({ id, text, level });
      }
    });

    setHeadings((prev) => {
      // Avoid re-rendering if headings haven't changed
      if (
        prev.length === items.length &&
        prev.every((p, i) => p.id === items[i].id && p.text === items[i].text)
      ) {
        return prev;
      }
      return items;
    });
  };

  useEffect(() => {
    scanHeadings();

    // Observe DOM mutations on editor instead of expensive polling
    const target = document.querySelector(".tiptap");
    if (target) {
      observerRef.current = new MutationObserver(() => {
        scanHeadings();
      });
      observerRef.current.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } else {
      // Fallback one-shot check if editor mounts slightly after
      const timeout = setTimeout(scanHeadings, 800);
      return () => clearTimeout(timeout);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  if (headings.length === 0) return null;

  const scrollToHeading = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="fixed top-16 right-6 z-30 hidden xl:flex flex-col items-end">
      <div className="bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg p-2.5 w-64 max-h-[70vh] flex flex-col transition-all">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between cursor-pointer text-xs font-semibold text-muted-foreground pb-1 border-b border-border/40 select-none hover:text-foreground"
        >
          <div className="flex items-center gap-1.5">
            <ListTree className="h-3.5 w-3.5 text-indigo-500" />
            <span>Table of Contents ({headings.length})</span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </div>

        {isOpen && (
          <div className="space-y-0.5 mt-2 overflow-y-auto pr-1 max-h-64">
            {headings.map((h) => (
              <button
                key={h.id}
                onClick={() => scrollToHeading(h.id)}
                style={{ paddingLeft: `${(h.level - 1) * 10 + 6}px` }}
                className={`w-full text-left py-1 text-xs rounded truncate transition-colors ${
                  activeId === h.id
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {h.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
