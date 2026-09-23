"use client";

import React from "react";
import Link from "next/link";
import { Bell, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  healthStatus?: string;
  dbLatency?: number;
  unreadAlertsCount?: number;
  onOpenAlerts?: () => void;
  bellPulse?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  unreadAlertsCount = 0,
  onOpenAlerts,
  bellPulse = false,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-[#e2e2dd] bg-[#fbfbfa]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity">
          <FinSightLogo variant="full" height={32} className="h-7 sm:h-8 w-auto" />
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 hidden min-[400px]:inline-block">
            Live
          </span>
        </Link>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* User / Auth State */}
          {user ? (
            <div className="flex items-center gap-2">
              {user.is_demo ? (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Demo Mode
                  </span>
                  <Link
                    href="/login"
                    className="text-[11px] font-medium text-slate-500 hover:text-emerald-700 transition-colors hidden sm:inline"
                  >
                    OAuth Sign In
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/80 border border-emerald-200 text-xs font-medium text-emerald-800">
                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                    {user.display_name ? user.display_name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="hidden sm:inline max-w-[110px] truncate">{user.display_name}</span>
                </div>
              )}

              <button
                type="button"
                onClick={logout}
                title="Log Out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Alerts Bell */}
          <button
            onClick={onOpenAlerts}
            className={`relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer ${
              bellPulse ? "ring-2 ring-amber-400 ring-offset-1" : ""
            }`}
            title="Market Alerts"
          >
            <Bell className={`w-4 h-4 ${bellPulse ? "text-amber-600" : ""}`} />
            {unreadAlertsCount > 0 && (
              <span className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${
                bellPulse ? "animate-bounce" : ""
              }`}>
                {unreadAlertsCount > 9 ? "9+" : unreadAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
