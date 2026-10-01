"use client";

import { useState } from "react";
import { PageSchema } from "@/types";
import { exportPage } from "@/lib/page-export";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PageExportModal({ page, open, onOpenChange }: { page: PageSchema; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [status, setStatus] = useState("");
  const save = async (format: "md" | "html" | "json") => {
    try {
      const response = await fetch(`/api/pages/${page.id}`);
      if (!response.ok) throw new Error("Could not load the latest page content");
      const content = exportPage(await response.json(), format);
      const filename = page.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
      if (window.electronAPI) {
        const result = await window.electronAPI.saveFile({ format, filename, content });
        if (!result.canceled) setStatus(`${format.toUpperCase()} saved.`);
      } else {
        const blob = new Blob([content], { type: format === "html" ? "text/html" : format === "json" ? "application/json" : "text/markdown" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `${filename}.${format}`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus(`${format.toUpperCase()} downloaded.`);
      }
    } catch (error: any) { setStatus(error.message || "Export failed"); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5" />Export Page</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">Save the current page in an open format.</p>
    <div className="grid gap-2">{(["md", "html", "json"] as const).map(format => <Button key={format} variant="outline" className="justify-between" onClick={() => save(format)}><span>{format === "md" ? "Markdown" : format === "html" ? "HTML document" : "Raw JSON"}</span><span className="text-xs">.{format}</span></Button>)}</div>
    {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
  </DialogContent></Dialog>;
}
