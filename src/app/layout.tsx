import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopBridge } from "@/components/desktop/desktop-bridge";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Notion Lite - Agent Workspace & Knowledge Base",
  description: "A block-based workspace with databases, multiple views, relations, collaboration, and AI.",
};

import { FetchInterceptor } from "@/components/fetch-interceptor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <FetchInterceptor />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            <DesktopBridge />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
