"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught component error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-8 w-8 mb-2 opacity-80" />
          <h4 className="text-sm font-semibold">
            {this.props.fallbackTitle || "Something went wrong displaying this section."}
          </h4>
          <p className="text-xs opacity-70 mt-1 max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            size="xs"
            variant="outline"
            className="mt-3 gap-1.5"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
