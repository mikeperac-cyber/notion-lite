export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { type: "paragraph"; inline: Inline[] }
  | { type: "heading"; level: 1 | 2 | 3; inline: Inline[] }
  | { type: "bullet" | "ordered"; items: Inline[][] }
  | { type: "code"; text: string };

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|(?<![A-Za-z0-9_])__[^_\n]+__(?![A-Za-z0-9_])|\*[^*\s][^*\n]*\*|(?<![A-Za-z0-9_])_[^_\s][^_\n]*_(?![A-Za-z0-9_]))/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*```/;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  for (const part of source.split(INLINE)) {
    if (!part) continue;
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) out.push({ text: part.slice(1, -1), code: true });
    else if (part.length > 4 && (part.startsWith("**") || part.startsWith("__")) && part.slice(0, 2) === part.slice(-2)) out.push({ text: part.slice(2, -2), bold: true });
    else if (part.length > 2 && (part[0] === "*" || part[0] === "_") && part[0] === part[part.length - 1]) out.push({ text: part.slice(1, -1), italic: true });
    else out.push({ text: part });
  }
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, inline: parseInline(heading[2]) });
      continue;
    }
    const kind = BULLET.test(line) ? "bullet" : ORDERED.test(line) ? "ordered" : null;
    if (kind) {
      flush();
      const match = kind === "bullet" ? BULLET : ORDERED;
      const last = blocks[blocks.length - 1];
      const item = parseInline(match.exec(line)![1]);
      if (last && last.type === kind) last.items.push(item);
      else blocks.push({ type: kind, items: [item] });
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

const marks = (inline: Inline) => {
  const list: Array<{ type: string }> = [];
  if (inline.bold) list.push({ type: "bold" });
  if (inline.italic) list.push({ type: "italic" });
  if (inline.code) list.push({ type: "code" });
  return list.length ? list : undefined;
};

const textNodes = (inline: Inline[]) =>
  inline.filter(part => part.text).map(part => ({ type: "text", text: part.text, ...(marks(part) ? { marks: marks(part) } : {}) }));

const paragraphNode = (inline: Inline[]) => ({ type: "paragraph", content: textNodes(inline) });

/** Inline text nodes for a single-paragraph result, so it can replace a selection in place. */
export function toTiptapContent(source: string): any[] {
  const blocks = parseMarkdown(source);
  if (blocks.length === 1 && blocks[0].type === "paragraph") return textNodes(blocks[0].inline);
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph": return paragraphNode(block.inline);
      case "heading": return { type: "heading", attrs: { level: block.level }, content: textNodes(block.inline) };
      case "code": return { type: "codeBlock", ...(block.text ? { content: [{ type: "text", text: block.text }] } : {}) };
      case "bullet":
      case "ordered":
        return {
          type: block.type === "bullet" ? "bulletList" : "orderedList",
          content: block.items.map(item => ({ type: "listItem", content: [paragraphNode(item)] })),
        };
    }
  });
}
