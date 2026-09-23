"use client";

/**
 * AlertToast — A dismissible slide-in notification that appears when a
 * real-time alert arrives via WebSocket. Matches FinSight's light design system.
 *
 * Auto-dismisses after 6 seconds. Clicking "View" opens the Alerts drawer.
 */

import React, { useEffect, useState } from "react";
import { AlertItem } from "../lib/types";
import { Bell, X, ArrowRight } from "lucide-react";

interface AlertToastProps {
  alert: AlertItem;
  onDismiss: () => void;
  onView: () => void;
}

const SEVERITY_STYLES = {
  DANGER: {
    dot: "bg-rose-500",
    ring: "ring-rose-100",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    label: "Urgent",
    border: "border-rose-200",
    progress: "bg-rose-400",
  },
  WARNING: {
    dot: "bg-amber-500",
    ring: "ring-amber-100",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Important",
    border: "border-amber-200",
    progress: "bg-amber-400",
  },
  INFO: {
    dot: "bg-sky-500",
    ring: "ring-sky-100",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    label: "Info",
    border: "border-sky-200",
    progress: "bg-sky-400",
  },
} as const;

const AUTO_DISMISS_MS = 6000;

export const AlertToast: React.FC<AlertToastProps> = ({
  alert,
  onDismiss,
  onView,
}) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  const sev = (alert.severity as keyof typeof SEVERITY_STYLES) in SEVERITY_STYLES
    ? (alert.severity as keyof typeof SEVERITY_STYLES)
    : "INFO";
  const style = SEVERITY_STYLES[sev];

  useEffect(() => {
    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 30);

    // Progress bar drain
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
    }, 50);

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for slide-out animation
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
      clearInterval(interval);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  const handleView = () => {
    setVisible(false);
    setTimeout(() => {
      onDismiss();
      onView();
    }, 200);
  };

  return (
    <div
      className={`
        w-80 bg-white rounded-2xl shadow-lg border ${style.border}
        overflow-hidden transition-all duration-300 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
      `}
    >
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center`}>
            <Bell className="w-4 h-4 text-slate-600" />
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${style.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {style.label}
              </span>
              {alert.topic_tag && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70 tracking-tight">
                  {alert.topic_tag}
                </span>
              )}
            </div>

            <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
              {alert.event_headline || alert.title}
            </p>

            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
              {alert.message}
            </p>

            {/* Affected Stocks Preview */}
            {alert.stocks_affected && alert.stocks_affected.length > 0 && (
              <div className="mt-2 flex items-center gap-1 flex-wrap">
                {alert.stocks_affected.slice(0, 3).map((stock, idx) => (
                  <span
                    key={`${stock.ticker}-${idx}`}
                    className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      stock.sentiment === "BULLISH"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : stock.sentiment === "BEARISH"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span>{stock.ticker}</span>
                    <span className="font-mono">{stock.impact_pct}</span>
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={handleView}
              className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              View in Alerts <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-100">
        <div
          className={`h-full ${style.progress} transition-all duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
