"use client";

import React, { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

const attrs = { id: { default: null }, };
const block = (name: string, tag: string, className: string, extra: Record<string, any> = {}) => Node.create({
  name, group: "block", content: "block+", defining: true,
  addAttributes: () => ({ ...attrs, ...extra }),
  parseHTML: () => [{ tag: `${tag}[data-type="${name}"]` }],
  renderHTML: ({ HTMLAttributes }) => [tag, mergeAttributes(HTMLAttributes, { "data-type": name, class: className }), 0],
});

export const Callout = block("callout", "aside", "nl-callout", { variant: { default: "info" } });
const ToggleView = ({ node, updateAttributes }: any) => <NodeViewWrapper className="nl-toggle"><button type="button" contentEditable={false} onClick={() => updateAttributes({ open: !node.attrs.open })} className="text-xs text-muted-foreground font-semibold">{node.attrs.open ? "▾" : "▸"} Toggle</button><NodeViewContent className={node.attrs.open ? "" : "hidden"} /></NodeViewWrapper>;
export const ToggleBlock = Node.create({
  name: "toggleBlock", group: "block", content: "block+", defining: true,
  addAttributes: () => ({ ...attrs, open: { default: true } }),
  parseHTML: () => [{ tag: 'details[data-type="toggleBlock"]' }],
  renderHTML: ({ HTMLAttributes }) => ["details", mergeAttributes(HTMLAttributes, { "data-type": "toggleBlock", class: "nl-toggle" }), 0],
  addNodeView: () => ReactNodeViewRenderer(ToggleView),
});
export const Column = Node.create({
  name: "column", content: "block+", defining: true,
  addAttributes: () => attrs,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "column", class: "nl-column" }), 0],
});
export const Columns = Node.create({
  name: "columns", group: "block", content: "column{2,3}", defining: true,
  addAttributes: () => ({ ...attrs, count: { default: 2 } }),
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "columns", class: `nl-columns nl-columns-${HTMLAttributes.count || 2}` }), 0],
});

function SourceView({ node, updateAttributes, label, render }: any) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const source = String(node.attrs.source || "");
    if (!source) { setPreview(""); return; }
    (async () => {
      try { const html = await render(source); if (live) { setPreview(html); setError(""); } }
      catch (caught: any) { if (live) { setPreview(""); setError(caught.message || "Could not render"); } }
    })();
    return () => { live = false; };
  }, [node.attrs.source, render]);
  return <NodeViewWrapper className="nl-source-node" contentEditable={false}>
    <label className="text-xs font-semibold">{label}</label>
    <textarea aria-label={`${label} source`} value={node.attrs.source || ""} onChange={event => updateAttributes({ source: event.target.value })} className="w-full min-h-20 bg-transparent border rounded p-2 font-mono text-xs" />
    {error ? <p className="text-xs text-destructive">{error}</p> : preview && <div className="nl-rendered" dangerouslySetInnerHTML={{ __html: preview }} />}
  </NodeViewWrapper>;
}
const renderMermaid = async (source: string) => {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
  return (await mermaid.render(`nl-${crypto.randomUUID().replace(/-/g, "")}`, source)).svg;
};
const renderMath = async (source: string) => (await import("katex")).default.renderToString(source, { displayMode: true, throwOnError: false, trust: false });

function atom(name: string, component: any, attributes: Record<string, any>) {
  return Node.create({
    name, group: "block", atom: true, draggable: true,
    addAttributes: () => ({ ...attrs, ...attributes }),
    parseHTML: () => [{ tag: `div[data-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": name })],
    addNodeView: () => ReactNodeViewRenderer(component),
  });
}
export const MermaidBlock = atom("mermaidBlock", (props: any) => <SourceView {...props} label="Mermaid diagram" render={renderMermaid} />, { source: { default: "graph TD\n  A[Start] --> B[Finish]" } });
export const MathBlock = atom("mathBlock", (props: any) => <SourceView {...props} label="LaTeX equation" render={renderMath} />, { source: { default: "E = mc^2" } });

const ProgressView = ({ node, updateAttributes }: any) => <NodeViewWrapper className="nl-progress" contentEditable={false}>
  <input aria-label="Progress label" value={node.attrs.label || ""} onChange={event => updateAttributes({ label: event.target.value })} className="bg-transparent text-sm font-medium" />
  <div className="flex items-center gap-2"><progress value={Number(node.attrs.value) || 0} max={Math.max(1, Number(node.attrs.max) || 100)} className="flex-1" /><input aria-label="Progress value" type="number" min="0" value={node.attrs.value || 0} onChange={event => updateAttributes({ value: Number(event.target.value) })} className="w-16 bg-transparent border rounded p-1 text-xs" /><span className="text-xs">/ {node.attrs.max || 100}</span></div>
</NodeViewWrapper>;
export const ProgressBlock = atom("progressBlock", ProgressView, { label: { default: "Progress" }, value: { default: 0 }, max: { default: 100 } });

function embedUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
    if (["www.youtube.com", "youtube.com"].includes(url.hostname)) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.searchParams.get("v") || "")}`;
    if (["vimeo.com", "www.vimeo.com"].includes(url.hostname)) return `https://player.vimeo.com/video/${encodeURIComponent(url.pathname.slice(1))}`;
  } catch {}
  return null;
}
const VideoView = ({ node, updateAttributes }: any) => {
  const src = embedUrl(node.attrs.url || "");
  return <NodeViewWrapper className="nl-media" contentEditable={false}><label className="text-xs font-semibold">Video URL</label><input aria-label="Video URL" value={node.attrs.url || ""} onChange={event => updateAttributes({ url: event.target.value })} placeholder="YouTube or Vimeo URL" className="w-full bg-transparent border rounded p-2 text-xs" />{src && <iframe title="Video embed" src={src} sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen className="w-full aspect-video mt-2 rounded" />}</NodeViewWrapper>;
};
export const VideoEmbed = atom("videoEmbed", VideoView, { url: { default: "" } });

const BookmarkView = ({ node, updateAttributes }: any) => {
  let host = "";
  try { const url = new URL(node.attrs.url); if (["http:", "https:"].includes(url.protocol)) host = url.hostname; } catch {}
  return <NodeViewWrapper className="nl-bookmark" contentEditable={false}><input aria-label="Bookmark title" value={node.attrs.title || ""} onChange={event => updateAttributes({ title: event.target.value })} placeholder="Bookmark title" className="w-full bg-transparent font-semibold text-sm" /><input aria-label="Bookmark URL" value={node.attrs.url || ""} onChange={event => updateAttributes({ url: event.target.value })} placeholder="https://example.com" className="w-full bg-transparent text-xs text-muted-foreground" />{host && <a href={node.attrs.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">Open {host}</a>}</NodeViewWrapper>;
};
export const Bookmark = atom("bookmark", BookmarkView, { title: { default: "" }, url: { default: "" } });

export const KeyboardBadge = Node.create({
  name: "keyboardBadge", group: "inline", inline: true, atom: true,
  addAttributes: () => ({ keys: { default: "Ctrl+K" } }),
  parseHTML: () => [{ tag: 'kbd[data-type="keyboardBadge"]' }],
  renderHTML: ({ HTMLAttributes }) => ["kbd", mergeAttributes(HTMLAttributes, { "data-type": "keyboardBadge", class: "nl-kbd" }), HTMLAttributes.keys],
});

const SyncedView = ({ node }: any) => <NodeViewWrapper className="nl-synced"><div contentEditable={false} className="text-xs text-muted-foreground flex justify-between"><span>Synced block</span><button onClick={() => navigator.clipboard.writeText(node.attrs.syncId)} title="Copy sync ID">Copy ID</button></div><NodeViewContent className="nl-synced-content" /></NodeViewWrapper>;
export const SyncedBlock = Node.create({
  name: "syncedBlock", group: "block", content: "block+", defining: true,
  addAttributes: () => ({ ...attrs, syncId: { default: null } }),
  parseHTML: () => [{ tag: 'div[data-type="syncedBlock"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "syncedBlock" }), 0],
  addNodeView: () => ReactNodeViewRenderer(SyncedView),
});
