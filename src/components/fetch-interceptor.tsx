"use client";

import { useEffect } from "react";

function patchFetch() {
  if (typeof window !== "undefined" && !(window as any).__fetchPatched) {
    (window as any).__fetchPatched = true;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      
      const url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';
      if (url.startsWith('/api') || url.includes('/api/')) {
        config = config || {};
        const secret = (window as any).env?.internalSecret || '';
        config.headers = {
          ...config.headers,
          'x-internal-secret': secret
        };
        args[1] = config;
      }
      
      return originalFetch(...args);
    };
  }
}

if (typeof window !== "undefined") {
  patchFetch();
}

export function FetchInterceptor() {
  useEffect(() => {
    patchFetch();
  }, []);

  return null;
}
