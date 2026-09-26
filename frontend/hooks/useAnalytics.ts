"use client";

import { useEffect, useRef, useCallback } from "react";
import { trackAnalytics } from "@/lib/api";
import { getVisitorId, getSessionId } from "@/lib/visitor";
import { useAuth } from "@/lib/auth";

export function useAnalytics(pagePath?: string, pageTitle?: string) {
  const startTimeRef = useRef<number>(Date.now());
  const hasTrackedMount = useRef<boolean>(false);
  const { user } = useAuth();

  useEffect(() => {
    startTimeRef.current = Date.now();
    const path = pagePath || (typeof window !== "undefined" ? window.location.pathname : "/");
    const title = pageTitle || (typeof document !== "undefined" ? document.title : "FinSight");
    const vid = getVisitorId();
    const sid = getSessionId();

    trackAnalytics({
      type: "pageview",
      path,
      title,
      referrer: typeof document !== "undefined" ? document.referrer : "Direct",
      visitor_id: vid,
      session_id: sid,
      user_id: user?.id ?? null,
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
        visitor_id: vid,
        session_id: sid,
        user_id: user?.id ?? null,
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
          visitor_id: vid,
          session_id: sid,
          user_id: user?.id ?? null,
        });
      }
    };
  }, [pagePath, pageTitle, user?.id]);

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
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        user_id: user?.id ?? null,
      });
    },
    [user?.id]
  );

  return { trackEvent };
}
