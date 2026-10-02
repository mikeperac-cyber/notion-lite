import React from "react";
import { Inline, parseMarkdown } from "@/lib/ai-markdown";

function renderInline(parts: Inline[]) {
  return parts.map((part, i) => {
    if (part.code) return <code key={i} className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.9em]">{part.text}</code>;
    if (part.bold) return <strong key={i}>{part.text}</strong>;
    if (part.italic) return <em key={i}>{part.text}</em>;
    return <React.Fragment key={i}>{part.text}</React.Fragment>;
  });
}

export function MarkdownText({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  if (!blocks.length) return null;
  return (
    <div className="space-y-1.5 break-words">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <p key={i} className="font-semibold">{renderInline(block.inline)}</p>;
          case "bullet":
            return <ul key={i} className="list-disc space-y-0.5 pl-4">{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
          case "ordered":
            return <ol key={i} className="list-decimal space-y-0.5 pl-4">{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ol>;
          case "code":
            return <pre key={i} className="overflow-x-auto rounded bg-foreground/10 p-2 font-mono text-[0.9em]">{block.text}</pre>;
          default:
            return <p key={i}>{renderInline(block.inline)}</p>;
        }
      })}
    </div>
  );
}
