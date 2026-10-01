import { PageSchema } from "@/types";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const safeUrl = (value: unknown) => { const url = String(value || ""); return /^(https?:\/\/|\/api\/attachments\/)/i.test(url) ? url : ""; };
const children = (node: any) => (node?.content || []) as any[];
const text = (node: any): string => (node?.text || "") + children(node).map(text).join("");
const legacyNode = (block: any) => block.content?.node || { type: block.type.startsWith("heading_") ? "heading" : block.type === "code" ? "codeBlock" : "paragraph", attrs: block.type.startsWith("heading_") ? { level: Number(block.type.slice(-1)) } : {}, content: [{ type: "text", text: block.content?.text || block.content?.code || "" }] };

function markdown(node: any): string {
  const body = children(node).map(markdown).join("");
  switch (node.type) {
    case "text": {
      let value = String(node.text || "");
      for (const mark of node.marks || []) { if (mark.type === "bold") value = `**${value}**`; if (mark.type === "italic") value = `*${value}*`; if (mark.type === "code") value = `\`${value}\``; if (mark.type === "link" && safeUrl(mark.attrs?.href)) value = `[${value}](${mark.attrs.href})`; }
      return value;
    }
    case "paragraph": return `${body}\n\n`;
    case "heading": return `${"#".repeat(Math.min(3, node.attrs?.level || 1))} ${body}\n\n`;
    case "bulletList": return children(node).map(item => `- ${text(item)}\n`).join("") + "\n";
    case "orderedList": return children(node).map((item, index) => `${index + 1}. ${text(item)}\n`).join("") + "\n";
    case "taskList": return children(node).map(item => `- [${item.attrs?.checked ? "x" : " "}] ${text(item)}\n`).join("") + "\n";
    case "codeBlock": return `\`\`\`${node.attrs?.language || ""}\n${text(node)}\n\`\`\`\n\n`;
    case "blockquote": return text(node).split("\n").map(line => `> ${line}`).join("\n") + "\n\n";
    case "horizontalRule": return "---\n\n";
    case "image": return `![${node.attrs?.alt || "Image"}](${safeUrl(node.attrs?.src)})\n\n`;
    case "callout": return `> **${node.attrs?.variant || "Info"}:** ${text(node)}\n\n`;
    case "toggleBlock": return `<details><summary>Toggle</summary>\n\n${body}</details>\n\n`;
    case "columns": return children(node).map((column, index) => `### Column ${index + 1}\n\n${markdown(column)}`).join("\n");
    case "table": return children(node).map(row => `| ${children(row).map(cell => text(cell).replace(/\|/g, "\\|")).join(" | ")} |\n`).join("") + "\n";
    case "mermaidBlock": return `\`\`\`mermaid\n${node.attrs?.source || ""}\n\`\`\`\n\n`;
    case "mathBlock": return `$$\n${node.attrs?.source || ""}\n$$\n\n`;
    case "progressBlock": return `${node.attrs?.label || "Progress"}: ${node.attrs?.value || 0}/${node.attrs?.max || 100}\n\n`;
    case "videoEmbed": return `${safeUrl(node.attrs?.url)}\n\n`;
    case "bookmark": return `[${node.attrs?.title || node.attrs?.url || "Bookmark"}](${safeUrl(node.attrs?.url)})\n\n`;
    case "keyboardBadge": return `\`${node.attrs?.keys || ""}\``;
    case "syncedBlock": return body;
    default: return body;
  }
}

function html(node: any): string {
  const body = children(node).map(html).join("");
  switch (node.type) {
    case "text": {
      let value = escapeHtml(node.text);
      for (const mark of node.marks || []) { if (mark.type === "bold") value = `<strong>${value}</strong>`; if (mark.type === "italic") value = `<em>${value}</em>`; if (mark.type === "code") value = `<code>${value}</code>`; if (mark.type === "link" && safeUrl(mark.attrs?.href)) value = `<a href="${escapeHtml(mark.attrs.href)}">${value}</a>`; }
      return value;
    }
    case "paragraph": return `<p>${body}</p>`;
    case "heading": { const level = Math.min(3, Math.max(1, Number(node.attrs?.level || 1))); return `<h${level}>${body}</h${level}>`; }
    case "bulletList": return `<ul>${body}</ul>`;
    case "orderedList": return `<ol>${body}</ol>`;
    case "listItem": return `<li>${body}</li>`;
    case "taskList": return `<ul>${body}</ul>`;
    case "taskItem": return `<li><input type="checkbox" disabled ${node.attrs?.checked ? "checked" : ""}>${body}</li>`;
    case "codeBlock": return `<pre><code>${escapeHtml(text(node))}</code></pre>`;
    case "blockquote": return `<blockquote>${body}</blockquote>`;
    case "horizontalRule": return "<hr>";
    case "image": return `<img src="${escapeHtml(safeUrl(node.attrs?.src))}" alt="${escapeHtml(node.attrs?.alt || "Image")}">`;
    case "callout": return `<aside><strong>${escapeHtml(node.attrs?.variant || "Info")}</strong>${body}</aside>`;
    case "toggleBlock": return `<details open><summary>Toggle</summary>${body}</details>`;
    case "columns": return `<div class="columns">${body}</div>`;
    case "column": return `<div class="column">${body}</div>`;
    case "table": return `<table>${body}</table>`;
    case "tableRow": return `<tr>${body}</tr>`;
    case "tableCell": return `<td>${body}</td>`;
    case "tableHeader": return `<th>${body}</th>`;
    case "mermaidBlock": return `<pre class="mermaid">${escapeHtml(node.attrs?.source)}</pre>`;
    case "mathBlock": return `<pre>${escapeHtml(node.attrs?.source)}</pre>`;
    case "progressBlock": return `<label>${escapeHtml(node.attrs?.label || "Progress")} <progress value="${Number(node.attrs?.value) || 0}" max="${Number(node.attrs?.max) || 100}"></progress></label>`;
    case "videoEmbed": return `<p><a href="${escapeHtml(safeUrl(node.attrs?.url))}">Video</a></p>`;
    case "bookmark": return `<p><a href="${escapeHtml(safeUrl(node.attrs?.url))}">${escapeHtml(node.attrs?.title || node.attrs?.url || "Bookmark")}</a></p>`;
    case "keyboardBadge": return `<kbd>${escapeHtml(node.attrs?.keys)}</kbd>`;
    case "syncedBlock": return `<section>${body}</section>`;
    default: return body;
  }
}

export function exportPage(page: PageSchema, format: "md" | "html" | "json") {
  if (format === "json") return JSON.stringify(page, null, 2);
  const nodes = (page.blocks || []).map(legacyNode);
  if (format === "md") return `# ${page.title}\n\n${nodes.map(markdown).join("")}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(page.title)}</title><style>body{font:16px/1.6 system-ui;max-width:800px;margin:3rem auto;padding:0 1rem}.columns{display:flex;gap:1rem}.column{flex:1}table,td,th{border:1px solid #ccc;border-collapse:collapse;padding:.4rem}img{max-width:100%}</style></head><body><h1>${escapeHtml(page.title)}</h1>${nodes.map(html).join("")}</body></html>`;
}
