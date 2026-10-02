import { create } from "zustand";
import { PageSchema, WorkspaceSchema } from "@/types";

interface AppState {
  // Navigation & Workspace
  currentWorkspace: WorkspaceSchema | null;
  pagesTree: PageSchema[];
  activePageId: string | null;
  sidebarOpen: boolean;
  searchModalOpen: boolean;
  templateModalOpen: boolean;
  trashModalOpen: boolean;
  trashCount: number;
  aiChatOpen: boolean;
  commentsDrawerOpen: boolean;
  settingsOpen: boolean;

  // Setters
  setCurrentWorkspace: (workspace: WorkspaceSchema | null) => void;
  setPagesTree: (pages: PageSchema[]) => void;
  setActivePageId: (pageId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSearchModalOpen: (open: boolean) => void;
  setTemplateModalOpen: (open: boolean) => void;
  setTrashModalOpen: (open: boolean) => void;
  setTrashCount: (count: number) => void;
  setAiChatOpen: (open: boolean) => void;
  setCommentsDrawerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;

  // Page Tree Mutations
  addPageToTree: (page: PageSchema) => void;
  updatePageInTree: (pageId: string, updates: Partial<PageSchema>) => void;
  removePageFromTree: (pageId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentWorkspace: null,
  pagesTree: [],
  activePageId: null,
  sidebarOpen: true,
  searchModalOpen: false,
  templateModalOpen: false,
  trashModalOpen: false,
  trashCount: 0,
  aiChatOpen: false,
  commentsDrawerOpen: false,
  settingsOpen: false,

  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setPagesTree: (pages) => set({ pagesTree: pages }),
  setActivePageId: (pageId) => set({ activePageId: pageId }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSearchModalOpen: (open) => set({ searchModalOpen: open }),
  setTemplateModalOpen: (open) => set({ templateModalOpen: open }),
  setTrashModalOpen: (open) => set({ trashModalOpen: open }),
  setTrashCount: (count) => set({ trashCount: count }),
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
  setCommentsDrawerOpen: (open) => set({ commentsDrawerOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  addPageToTree: (page) =>
    set((state) => ({
      pagesTree: [...state.pagesTree, page],
    })),

  updatePageInTree: (pageId, updates) =>
    set((state) => {
      const updateRecursive = (pages: PageSchema[]): PageSchema[] => {
        return pages.map((p) => {
          if (p.id === pageId) {
            return { ...p, ...updates };
          }
          if (p.children && p.children.length > 0) {
            return { ...p, children: updateRecursive(p.children) };
          }
          return p;
        });
      };
      return { pagesTree: updateRecursive(state.pagesTree) };
    }),

  removePageFromTree: (pageId) =>
    set((state) => {
      const removeRecursive = (pages: PageSchema[]): PageSchema[] => {
        return pages
          .filter((p) => p.id !== pageId)
          .map((p) => ({
            ...p,
            children: p.children ? removeRecursive(p.children) : [],
          }));
      };
      return { pagesTree: removeRecursive(state.pagesTree) };
    }),
}));
