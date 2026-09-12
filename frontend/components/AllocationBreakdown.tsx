"use client";

import React from "react";
import { SectorAllocation } from "@/lib/types";
import { PieChart, Layers, Globe } from "lucide-react";

interface AllocationBreakdownProps {
  sectorAllocations: SectorAllocation[];
  totalValue: number;
}

export const AllocationBreakdown: React.FC<AllocationBreakdownProps> = ({
  sectorAllocations,
  totalValue,
}) => {
  // Asset classes from user screenshot
  const assetClasses = [
    { name: "Equity", pct: 82, color: "bg-emerald-500" },
    { name: "Debt", pct: 12, color: "bg-indigo-500" },
    { name: "Cash", pct: 6, color: "bg-slate-500" },
  ];

  // Market Cap classes from user screenshot
  const marketCaps = [
    { name: "Large Cap", pct: 54, color: "bg-sky-500" },
    { name: "Mid Cap", pct: 21, color: "bg-amber-500" },
    { name: "Small Cap", pct: 7, color: "bg-rose-500" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 1. Asset Class Allocation */}
      <div className="p-5 rounded-xl bg-[#0d1320] border border-[#182236] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Asset Class Allocation
            </h3>
          </div>

          {/* Multi-segment Progress Bar */}
          <div className="h-2.5 w-full bg-[#161f33] rounded-full overflow-hidden flex mb-4">
            {assetClasses.map((ac) => (
              <div
                key={ac.name}
                style={{ width: `${ac.pct}%` }}
                className={`${ac.color} transition-all duration-500`}
                title={`${ac.name}: ${ac.pct}%`}
              />
            ))}
          </div>

          <div className="space-y-2 text-xs">
            {assetClasses.map((ac) => (
              <div key={ac.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ac.color}`} />
                  <span className="text-slate-300">{ac.name}</span>
                </div>
                <span className="font-mono-num font-semibold text-slate-100">{ac.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#182236] text-[11px] text-slate-500">
          Optimal equity allocation for long-term growth
        </div>
      </div>

      {/* 2. Equity Cap Distribution */}
      <div className="p-5 rounded-xl bg-[#0d1320] border border-[#182236] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Market Cap Distribution
            </h3>
          </div>

          {/* Multi-segment Progress Bar */}
          <div className="h-2.5 w-full bg-[#161f33] rounded-full overflow-hidden flex mb-4">
            {marketCaps.map((mc) => (
              <div
                key={mc.name}
                style={{ width: `${mc.pct}%` }}
                className={`${mc.color} transition-all duration-500`}
                title={`${mc.name}: ${mc.pct}%`}
              />
            ))}
          </div>

          <div className="space-y-2 text-xs">
            {marketCaps.map((mc) => (
              <div key={mc.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${mc.color}`} />
                  <span className="text-slate-300">{mc.name}</span>
                </div>
                <span className="font-mono-num font-semibold text-slate-100">{mc.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#182236] text-[11px] text-slate-500">
          Heavy large-cap tilt provides volatility cushion
        </div>
      </div>

      {/* 3. Domain / Sector Allocation */}
      <div className="p-5 rounded-xl bg-[#0d1320] border border-[#182236] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Domain / Sector Exposure
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            {sectorAllocations.map((sec, idx) => {
              const colors = [
                "bg-indigo-500",
                "bg-emerald-500",
                "bg-amber-500",
                "bg-purple-500",
                "bg-cyan-500",
                "bg-rose-500",
              ];
              const color = colors[idx % colors.length];

              return (
                <div key={sec.sector}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300 truncate max-w-[170px]">{sec.sector}</span>
                    <span className="font-mono-num font-bold text-slate-100">
                      {sec.allocation_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#161f33] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(sec.allocation_pct, 100)}%` }}
                      className={`h-full ${color} rounded-full`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#182236] text-[11px] text-slate-500">
          Monitored in real-time by Market Monitor Agent
        </div>
      </div>
    </div>
  );
};
