export {};

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      platform: string;
      onCommand: (callback: (command: string) => void) => () => void;
      onUpdateStatus: (callback: (status: string) => void) => () => void;
      ready: () => void;
      getSettings: () => Promise<Record<string, any>>;
      setSettings: (changes: Record<string, any>) => Promise<Record<string, any>>;
      saveFile: (request: { format: "md" | "html" | "json"; filename: string; content: string }) => Promise<{ canceled: boolean }>;
      createBackup: () => Promise<{ canceled: boolean; path?: string }>;
      restoreBackup: () => Promise<{ canceled: boolean }>;
      importMarkdown: () => Promise<Array<{ name: string; content: string }>>;
      pickAttachment: () => Promise<{ url: string; name: string } | null>;
      getAiSettings: () => Promise<Record<string, any>>;
      setAiSettings: (value: Record<string, any>) => Promise<Record<string, any>>;
      checkForUpdates: () => Promise<Record<string, any>>;
      getAppInfo: () => Promise<{ version: string; dataPath: string; packaged: boolean }>;
    };
  }
}
