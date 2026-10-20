"use client";

import React, { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { AlertItem, SimulateEventPayload } from "../lib/types";

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertItem[];
  unreadCount: number;
  isScanning: boolean;
  onScan: () => Promise<void>;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onSimulate: (payload: SimulateEventPayload) => Promise<void>;
  isEmbedded?: boolean;
  isDevMode?: boolean;
}

const AVAILABLE_SECTORS = [
  "Financial Services",
  "Information Technology",
  "Energy",
  "Automobile",
  "Healthcare",
  "Consumer Goods",
  "FMCG",
  "Realty",
  "Metals & Mining",
  "Construction & Infrastructure",
  "Telecommunication",
  "Diversified",
];

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return "Recent";
  }
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  unreadCount,
  isScanning,
  onScan,
  onMarkRead,
  onMarkAllRead,
  onSimulate,
  isEmbedded = false,
  isDevMode = (process.env.NEXT_PUBLIC_ENVIRONMENT || "production").toLowerCase() !== "production",
}) => {
  const [showSimulate, setShowSimulate] = useState(false);
  const [simulateSector, setSimulateSector] = useState("Financial Services");
  const [simulateSeverity, setSimulateSeverity] = useState<"INFO" | "WARNING" | "DANGER">("WARNING");
  const [isSimulating, setIsSimulating] = useState(false);
  const [filterUnread, setFilterUnread] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("finsight_alerts_filter") === "unread";
    }
    return false;
  });

  const handleToggleFilterUnread = () => {
    setFilterUnread((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("finsight_alerts_filter", next ? "unread" : "all");
      }
      return next;
    });
  };

  const displayedAlerts = filterUnread ? alerts.filter((a) => !a.is_read) : alerts;

  // Deduplicate alerts by ID so identical alerts from socket + polling never duplicate in UI
  const uniqueAlerts = React.useMemo(() => {
    const seen = new Set<number>();
    return displayedAlerts.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [displayedAlerts]);

  if (!isOpen && !isEmbedded) return null;

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    try {
      await onSimulate({
        sector: simulateSector,
        severity: simulateSeverity,
      });
      setShowSimulate(false);
    } finally {
      setIsSimulating(false);
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Header (Matching Panel 9) */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Alerts {unreadCount > 0 ? `(${unreadCount})` : ""}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stay informed about what matters
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleToggleFilterUnread}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filterUnread
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {filterUnread ? "All" : "Unread"}
          </button>

          {!isEmbedded && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Action Bar (Scan & Simulate buttons) */}
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
        <button
          onClick={onScan}
          disabled={isScanning}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-emerald-600" : ""}`} />
          <span>{isScanning ? "Scanning holdings..." : "Scan Holdings"}</span>
        </button>

        {isDevMode && (
          <button
            onClick={() => setShowSimulate(!showSimulate)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulate Event</span>
            {showSimulate ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      {/* Collapsible Simulate Event Form */}
      {isDevMode && showSimulate && (
        <form
          onSubmit={handleSimulateSubmit}
          className="p-5 bg-emerald-50/40 border-b border-emerald-100 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
              Simulate Market Event
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
              Demo Tool
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">
              Sector Impacted
            </label>
            <select
              value={simulateSector}
              onChange={(e) => setSimulateSector(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-emerald-600 font-medium"
            >
              {AVAILABLE_SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">
              Severity Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["INFO", "WARNING", "DANGER"] as const).map((sev) => (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setSimulateSeverity(sev)}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    simulateSeverity === sev
                      ? sev === "DANGER"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                        : sev === "WARNING"
                        ? "bg-amber-50 border-amber-300 text-amber-700 shadow-xs"
                        : "bg-sky-50 border-sky-300 text-sky-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSimulating}
            className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 mt-1"
          >
            {isSimulating ? "Injecting Event..." : "Fire Event Through Pipeline"}
          </button>
        </form>
      )}

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {uniqueAlerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">All clear!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                No recent market news or policy shifts directly impact your current holdings.
              </p>
            </div>
            {isDevMode && (
              <button
                onClick={() => setShowSimulate(true)}
                className="text-xs text-emerald-700 hover:underline font-semibold"
              >
                Test an alert to see how it works →
              </button>
            )}
          </div>
        ) : (
          uniqueAlerts.map((alert, index) => {
            const isHigh = alert.severity === "DANGER";
            const isMed = alert.severity === "WARNING";

            return (
              <div
                key={`alert-${alert.id}-${index}`}
                className={`p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex items-start gap-3.5 group ${
                  alert.is_read ? "opacity-60 hover:opacity-90" : ""
                }`}
              >
                {/* Category Dot */}
                <div className="mt-1 shrink-0">
                  <span
                    className={`block w-2.5 h-2.5 rounded-full ${
                      isHigh
                        ? "bg-rose-500 ring-4 ring-rose-50"
                        : isMed
                        ? "bg-amber-500 ring-4 ring-amber-50"
                        : "bg-sky-500 ring-4 ring-sky-50"
                    }`}
                  />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  {/* Topic Tag Badge */}
                  {alert.topic_tag && (
                    <div className="mb-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {alert.topic_tag}
                      </span>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">
                      {alert.event_headline || alert.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {formatTimeAgo(alert.created_at)}
                    </span>
                  </div>

                  {/* Action Advice / Investor Takeaway */}
                  {alert.action_advice && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50/40 border border-amber-200/50 text-xs text-slate-700 leading-relaxed font-medium">
                      <span className="font-bold text-amber-900 text-[10px] uppercase tracking-wider block mb-0.5">
                        Investor Takeaway
                      </span>
                      {alert.action_advice}
                    </div>
                  )}

                  {/* Portfolio Correlation Details */}
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {alert.message}
                  </p>

                  {/* Specific Affected Stocks Analysis */}
                  {alert.stocks_affected && alert.stocks_affected.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
                        <span>Stock Impact Analysis</span>
                        <span className="text-slate-400 font-normal lowercase">estimated shock</span>
                      </div>
                      <div className="space-y-1.5">
                        {alert.stocks_affected.map((stock, sIdx) => {
                          const isBull = stock.sentiment === "BULLISH";
                          const isBear = stock.sentiment === "BEARISH";
                          return (
                            <div
                              key={`${stock.ticker}-${sIdx}`}
                              className={`px-3 py-2 rounded-xl border flex items-center justify-between transition-all ${
                                stock.is_in_portfolio
                                  ? "bg-emerald-50/70 border-emerald-200 ring-1 ring-emerald-300/30"
                                  : "bg-slate-50/80 border-slate-200/70"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 font-mono tracking-tight">
                                    {stock.ticker}
                                  </span>
                                  {stock.is_in_portfolio && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md border border-emerald-300/70 flex items-center gap-1">
                                      <span className="w-1 h-1 rounded-full bg-emerald-600" />
                                      In Portfolio
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 truncate max-w-[210px] mt-0.5">
                                  {stock.name}
                                </p>
                                {stock.rationale && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic">
                                    {stock.rationale}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end shrink-0 pl-1">
                                <span
                                  className={`text-xs font-bold font-mono ${
                                    isBull
                                      ? "text-emerald-600"
                                      : isBear
                                      ? "text-rose-600"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {stock.impact_pct}
                                </span>
                                <span
                                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                                    isBull
                                      ? "bg-emerald-100 text-emerald-700"
                                      : isBear
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {stock.sentiment}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sectors and Mark Read */}
                  <div className="mt-3 flex items-center justify-between pt-1 border-t border-slate-100/80">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {alert.sectors_affected?.map((sec) => (
                        <span
                          key={sec}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                        >
                          {sec}
                        </span>
                      ))}
                    </div>

                    {!alert.is_read && (
                      <button
                        onClick={() => onMarkRead(alert.id)}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 text-center text-[11px] text-slate-400">
        Alerts reflect market news correlated to your specific portfolio
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs h-[650px] max-w-3xl">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        {renderContent()}
      </div>
    </div>
  );
};
