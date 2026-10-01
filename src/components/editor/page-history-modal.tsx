"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Snapshot { id: string; title: string; createdAt: string; blocks: number }
export function PageHistoryModal({ pageId, open, onOpenChange }: { pageId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!open) { setSnapshots([]); setStatus(""); return; }
    let alive = true;
    fetch(`/api/pages/${pageId}/history`)
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(data => { if (alive) setSnapshots(data.snapshots || []); })
      .catch(() => { if (alive) setStatus("Could not load page history."); });
    return () => { alive = false; };
  }, [pageId, open]);
  const restore = async (snapshot: Snapshot) => {
    if (!window.confirm(`Restore “${snapshot.title}” from ${new Date(snapshot.createdAt).toLocaleString()}? Current content will be saved as an undo snapshot.`)) return;
    setStatus("Restoring...");
    const response = await fetch(`/api/pages/${pageId}/history`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId: snapshot.id }) });
    if (!response.ok) { setStatus("Restore failed."); return; }
    window.location.reload();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Page history</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">History contains page titles and blocks. Restore saves the current version first.</p>
    <div className="max-h-80 overflow-y-auto space-y-2">
      {snapshots.length ? snapshots.map(snapshot => <div key={snapshot.id} className="flex items-center justify-between gap-3 border rounded p-2 text-sm">
        <div><p className="font-medium">{snapshot.title}</p><p className="text-xs text-muted-foreground">{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.blocks} blocks</p></div>
        <Button size="sm" variant="outline" onClick={() => restore(snapshot)}>Restore</Button>
      </div>) : <p className="text-sm text-muted-foreground">No snapshots yet.</p>}
    </div>
    {status && <p role="status" className="text-xs">{status}</p>}
  </DialogContent></Dialog>;
}
