"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";

export const LandingHeroPreview: React.FC = () => {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none">
      {/* Decorative subtle ambient blur */}
      <div className="absolute -inset-1.5 bg-gradient-to-tr from-emerald-200/40 via-teal-100/30 to-amber-100/30 rounded-3xl blur-xl opacity-70 -z-10" />

      {/* Main Terminal Mockup Window */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-2xl shadow-slate-900/5 p-4 sm:p-6 text-slate-800 transition-all hover:shadow-slate-900/10">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 mb-3.5 sm:mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-base font-bold text-slate-900 tracking-tight">Your Portfolio</h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">A clear view of what you own.</p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Last updated</div>
              <div className="text-xs font-semibold text-slate-700">Today, 10:42 AM</div>
            </div>
            <div className="flex items-center gap-1.5 pl-2.5 sm:border-l sm:border-slate-200">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                R
              </div>
              <span className="text-xs font-medium text-slate-700 hidden sm:inline">Hi, Rahul</span>
            </div>
          </div>
        </div>

        {/* 3 Metrics Row */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* Total Value */}
          <div className="bg-gradient-to-b from-emerald-50/40 via-white to-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 border-t-2 border-t-emerald-500 shadow-2xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Value
            </span>
            <div className="text-base sm:text-xl font-bold text-slate-900 font-mono-num mt-1 truncate">
              ₹12,48,320
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded flex items-center">
                +2.4%
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">unrealized</span>
            </div>
          </div>

          {/* Invested */}
          <div className="bg-gradient-to-b from-indigo-50/40 via-white to-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 border-t-2 border-t-indigo-500 shadow-2xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Invested
            </span>
            <div className="text-base sm:text-xl font-bold text-slate-900 font-mono-num mt-1 truncate">
              ₹10,20,000
            </div>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded inline-block mt-1 font-medium">Cost basis</span>
          </div>

          {/* XIRR */}
          <div className="bg-gradient-to-b from-amber-50/40 via-white to-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 border-t-2 border-t-amber-500 shadow-2xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              XIRR
            </span>
            <div className="text-base sm:text-xl font-bold text-amber-900 font-mono-num mt-1">
              14.8%
            </div>
            {/* Sparkline bars */}
            <div className="flex items-end gap-1 h-3 mt-1.5">
              <div className="w-1.5 h-1.5 bg-amber-300 rounded-xs" />
              <div className="w-1.5 h-2 bg-amber-400 rounded-xs" />
              <div className="w-1.5 h-2.5 bg-amber-500 rounded-xs" />
              <div className="w-1.5 h-3 bg-amber-600 rounded-xs" />
            </div>
          </div>
        </div>

        {/* 2-Column Visuals: Asset Allocation + Top Sectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-4">
          {/* Asset Allocation Donut */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-100">
            <h5 className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
              <span>Asset Allocation</span>
              <span className="text-[10px] text-slate-500 font-normal">4 classes</span>
            </h5>

            <div className="flex flex-col min-[380px]:flex-row items-center justify-around gap-4">
              {/* Donut Chart SVG */}
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {/* Background track */}
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4.5" />
                  {/* Equity: 70% */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4.5"
                    strokeDasharray="61.5 100"
                    strokeDashoffset="0"
                  />
                  {/* Debt: 12% */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="4.5"
                    strokeDasharray="10.5 100"
                    strokeDashoffset="-61.5"
                  />
                  {/* Gold: 10% */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="4.5"
                    strokeDasharray="8.8 100"
                    strokeDashoffset="-72"
                  />
                  {/* Cash: 8% */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="4.5"
                    strokeDasharray="7 100"
                    strokeDashoffset="-80.8"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-slate-800 font-mono-num">70%</span>
                  <span className="text-[8px] text-slate-400 uppercase">Equity</span>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Equity
                  </span>
                  <span className="font-semibold text-slate-800 font-mono-num text-[11px]">70%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Debt
                  </span>
                  <span className="font-semibold text-slate-800 font-mono-num text-[11px]">12%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Gold
                  </span>
                  <span className="font-semibold text-slate-800 font-mono-num text-[11px]">10%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Cash
                  </span>
                  <span className="font-semibold text-slate-800 font-mono-num text-[11px]">8%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Sectors (NSE 15-Sector Taxonomy) */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-100">
            <h5 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center justify-between">
              <span>Top Sectors</span>
              <span className="text-[10px] text-slate-400 font-normal">NSE Standard</span>
            </h5>

            <div className="space-y-2 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-0.5">
                  <span className="truncate">Financial Services</span>
                  <span className="font-semibold font-mono-num text-slate-900">39%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "39%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-0.5">
                  <span className="truncate">Information Technology</span>
                  <span className="font-semibold font-mono-num text-slate-900">18%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: "18%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-0.5">
                  <span className="truncate">Consumer Goods</span>
                  <span className="font-semibold font-mono-num text-slate-900">15%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: "15%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-0.5">
                  <span className="truncate">Healthcare</span>
                  <span className="font-semibold font-mono-num text-slate-900">10%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "10%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-0.5">
                  <span className="truncate">Others</span>
                  <span className="font-semibold font-mono-num text-slate-900">18%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-300 rounded-full" style={{ width: "18%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proactive Risk Insight Banner (Agent 1 / Agent 3 Real Risk Detection) */}
        <Link
          href="/dashboard"
          className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-[#ecfdf5] border border-emerald-200/80 hover:bg-[#e6fcf0] transition-colors group cursor-pointer gap-2"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1 rounded-md bg-emerald-600 text-white shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-emerald-900 truncate">
              You have 33% effective exposure to Financial Services
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
};
