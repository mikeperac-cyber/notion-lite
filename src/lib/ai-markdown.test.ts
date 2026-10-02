import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Node as PMNode } from "@tiptap/pm/model";
import { parseInline, parseMarkdown, toTiptapBlocks, toTiptapContent } from "./ai-markdown";

describe("parseInline", () => {
  it("handles bold, italic and code", () => {
    expect(parseInline("a **b** *c* `d` e")).toEqual([
      { text: "a " }, { text: "b", bold: true }, { text: " " }, { text: "c", italic: true },
      { text: " " }, { text: "d", code: true }, { text: " e" },
    ]);
  });

  it("supports underscore styles", () => {
    expect(parseInline("__bold__ and _it_")).toEqual([{ text: "bold", bold: true }, { text: " and " }, { text: "it", italic: true }]);
  });

  it("leaves unmatched markers and snake_case alone", () => {
    expect(parseInline("2 * 3 and snake_case_name")).toEqual([{ text: "2 * 3 and snake_case_name" }]);
  });

  it("never produces markup from HTML-looking text", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ text: "<img src=x onerror=alert(1)>" }]);
  });
});

describe("parseMarkdown", () => {
  it("groups consecutive bullets into one list", () => {
    expect(parseMarkdown("- one\n- two\n* three")).toEqual([
      { type: "bullet", items: [[{ text: "one" }], [{ text: "two" }], [{ text: "three" }]] },
    ]);
  });

  it("parses ordered lists", () => {
    const [block] = parseMarkdown("1. first\n2) second");
    expect(block).toMatchObject({ type: "ordered" });
    expect((block as any).items).toHaveLength(2);
  });

  it("parses headings and caps the level at 3", () => {
    expect(parseMarkdown("# A\n##### B")).toMatchObject([{ type: "heading", level: 1 }, { type: "heading", level: 3 }]);
  });

  it("splits paragraphs on blank lines and joins wrapped lines", () => {
    expect(parseMarkdown("one\ntwo\n\nthree")).toEqual([
      { type: "paragraph", inline: [{ text: "one two" }] },
      { type: "paragraph", inline: [{ text: "three" }] },
    ]);
  });

  it("keeps fenced code verbatim, including markdown characters", () => {
    expect(parseMarkdown("```js\nconst a = **1**;\n```")).toEqual([{ type: "code", text: "const a = **1**;" }]);
  });

  it("tolerates an unclosed code fence", () => {
    expect(parseMarkdown("```\nlet x")).toEqual([{ type: "code", text: "let x" }]);
  });

  it("returns nothing for empty input", () => {
    expect(parseMarkdown("  \n\n")).toEqual([]);
  });
});

describe("toTiptapContent", () => {
  it("returns inline text nodes for a single paragraph so it can replace a selection", () => {
    expect(toTiptapContent("I went to the **store**.")).toEqual([
      { type: "text", text: "I went to the " },
      { type: "text", text: "store", marks: [{ type: "bold" }] },
      { type: "text", text: "." },
    ]);
  });

  it("turns bullets into a real list", () => {
    expect(toTiptapContent("- a\n- b")).toEqual([
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] },
        ],
      },
    ]);
  });

  it("builds headings, ordered lists and code blocks", () => {
    const nodes = toTiptapContent("## Title\n\n1. x\n\n```\ncode\n```");
    expect(nodes.map(node => node.type)).toEqual(["heading", "orderedList", "codeBlock"]);
    expect(nodes[0].attrs).toEqual({ level: 2 });
  });

  it("never emits an empty text node (TipTap rejects them)", () => {
    const json = JSON.stringify(toTiptapContent("# \n- \n\n**x**"));
    expect(json).not.toContain('"text":""');
  });

  it("returns an empty array for empty input", () => {
    expect(toTiptapContent("")).toEqual([]);
  });
});

describe("toTiptapBlocks", () => {
  it("wraps a single sentence in a paragraph instead of returning inline text", () => {
    expect(toTiptapBlocks("Just a sentence.")).toEqual([{ type: "paragraph", content: [{ type: "text", text: "Just a sentence." }] }]);
  });

  it("matches toTiptapContent for multi-block results", () => {
    const source = "# Title\n\n- a\n- b";
    expect(toTiptapBlocks(source)).toEqual(toTiptapContent(source));
  });

  it("returns nothing for empty input", () => {
    expect(toTiptapBlocks("")).toEqual([]);
  });

  it("always produces valid top-level blocks", () => {
    const schema = getSchema([StarterKit]);
    for (const source of ["One line.", "- x\n- y", "## H\n\ntext", "```\ncode\n```"]) {
      expect(() => PMNode.fromJSON(schema, { type: "doc", content: toTiptapBlocks(source) }).check()).not.toThrow();
    }
  });
});

describe("toTiptapContent against the real editor schema", () => {
  const schema = getSchema([StarterKit]);
  const valid = (source: string) => {
    const content = toTiptapContent(source);
    // Inline results are wrapped in a paragraph, as they would be when replacing a selection.
    const blocks = content[0]?.type === "text" ? [{ type: "paragraph", content }] : content;
    expect(() => PMNode.fromJSON(schema, { type: "doc", content: blocks }).check()).not.toThrow();
  };

  it.each([
    ["inline formatting", "I went to the **store** and bought *apples* and `code`."],
    ["bullet summary", "- Sarah to send Q3 budget\n- Fix the **urgent** login bug\n- Book venue (~3 hrs)"],
    ["ordered list", "1. first\n2. second"],
    ["mixed document", "# Title\n\nIntro paragraph.\n\n- a\n- b\n\n1. x\n\n```js\nconst a = 1;\n```\n\nOutro."],
    ["empty fenced code", "```\n```"],
    ["heading only", "### Just a heading"],
  ])("produces a valid document for %s", (_name, source) => valid(source));
});
