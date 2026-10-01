"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const { setCurrentWorkspace, setPagesTree } = useAppStore();

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/workspace");
        if (res.ok) {
          const data = await res.json();
          setCurrentWorkspace(data.workspace);
          setPagesTree(data.pages);

          if (data.pages && data.pages.length > 0) {
            router.replace(`/editor/${data.pages[0].id}`);
          }
        }
      } catch (err) {
        console.error("Initialization error", err);
      }
    }
    init();
  }, [router, setCurrentWorkspace, setPagesTree]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background text-muted-foreground text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        Loading Notion Lite workspace...
      </div>
    </div>
  );
}
