"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

interface AdminTopBarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const AdminTopBar: React.FC<AdminTopBarProps> = ({
  onRefresh,
  isRefreshing,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand & Admin Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/dashboard" className="flex items-center hover:opacity-90 transition-opacity">
            <FinSightLogo variant="full" height={28} className="h-6.5 sm:h-7 w-auto" />
          </Link>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <ShieldAlert className="w-3 h-3 text-indigo-600" />
            <span className="hidden min-[380px]:inline">Super Admin</span>
            <span className="inline min-[380px]:hidden">Admin</span>
          </span>

          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telemetry Live</span>
          </span>
        </div>

        {/* Right: Actions & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Admin Identity / Status */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/80 border border-indigo-200 text-xs font-semibold text-indigo-800">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>{user?.display_name || "Super Admin"}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Log Out Admin Session"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-slate-900" : "text-slate-500"}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden min-[380px]:inline">Terminal</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

