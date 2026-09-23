"use client";

import React, { useEffect } from "react";
import { Search, Bell, RefreshCw, Menu } from "lucide-react";

interface DashboardTopBarProps {
  onOpenCopilot: () => void;
  onOpenAlerts: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  unreadAlertsCount: number;
  onToggleMobileSidebar?: () => void;
}

export const DashboardTopBar: React.FC<DashboardTopBarProps> = ({
  onOpenCopilot,
  onOpenAlerts,
  onRefresh,
  isRefreshing,
  unreadAlertsCount,
  onToggleMobileSidebar,
}) => {
  // Global ⌘K keyboard shortcut to launch Copilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenCopilot();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCopilot]);

  return (
    <header className="h-16 px-4 sm:px-8 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Left: Mobile hamburger & Search input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Global Search Bar (opens Copilot) */}
        <div
          onClick={onOpenCopilot}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-slate-500 text-xs sm:text-sm cursor-pointer transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Ask anything about your portfolio...</span>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-500 shadow-2xs">
              ⌘ K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Controls: Live status, Notification bell, Sync button */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Simple Live status pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live</span>
        </div>



        {/* Alerts Bell */}
        <button
          onClick={onOpenAlerts}
          className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
          title="Market Alerts"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
          )}
        </button>

        {/* Sync Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          title="Refresh investment values"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>
    </header>
  );
};
