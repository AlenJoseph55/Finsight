"use client";

import React from "react";
import { Shield, Sparkles, Activity, RefreshCw } from "lucide-react";

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  healthStatus?: string;
  dbLatency?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isRefreshing,
  healthStatus = "healthy",
  dbLatency,
}) => {
  return (
    <header className="border-b border-[#1b2438] bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-black text-lg tracking-wider">FS</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">FinSight</span>
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                v0.1.0 AI
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Privacy-First Autonomous Financial Intelligence
            </p>
          </div>
        </div>

        {/* Status Indicators & Action */}
        <div className="flex items-center gap-3">
          {/* Privacy Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>AES-256 Encrypted</span>
          </div>

          {/* Health & Latency */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#101726] border border-[#1e2a42] text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>
              DB: <span className="font-mono text-emerald-400">{dbLatency !== undefined ? `${dbLatency}ms` : "Active"}</span>
            </span>
          </div>

          {/* AI Agents Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/40 text-xs text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>3 Agents Armed</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141c2e] hover:bg-[#1a253c] border border-[#23314d] text-xs font-medium text-slate-200 transition-all cursor-pointer disabled:opacity-50"
            title="Recalculate & Sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
};
