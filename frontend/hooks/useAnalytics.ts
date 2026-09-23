"use client";

import { useEffect, useRef, useCallback } from "react";
import { trackAnalytics } from "@/lib/api";

export function useAnalytics(pagePath?: string, pageTitle?: string) {
  const startTimeRef = useRef<number>(Date.now());
  const hasTrackedMount = useRef<boolean>(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const path = pagePath || (typeof window !== "undefined" ? window.location.pathname : "/");
    const title = pageTitle || (typeof document !== "undefined" ? document.title : "FinSight");

    trackAnalytics({
      type: "pageview",
      path,
      title,
      referrer: typeof document !== "undefined" ? document.referrer : "Direct",
    });

    const handleBeforeUnload = () => {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      trackAnalytics({
        type: "event",
        path,
        duration_seconds: duration,
        category: "engagement",
        action: "session_duration",
        value: duration,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration > 2) {
        trackAnalytics({
          type: "event",
          path,
          duration_seconds: duration,
          category: "engagement",
          action: "session_duration",
          value: duration,
        });
      }
    };
  }, [pagePath, pageTitle]);

  const trackEvent = useCallback(
    (
      action: string,
      category: string = "feature_use",
      label?: string,
      value?: number,
      metadata?: any
    ) => {
      trackAnalytics({
        type: "event",
        category,
        action,
        label,
        value,
        metadata,
      });
    },
    []
  );

  return { trackEvent };
}
