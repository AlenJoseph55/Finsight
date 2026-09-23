"use client";

import React, { useMemo, useState } from "react";
import { Holding, SectorAllocation } from "@/lib/types";
import { ChevronDown, ChevronUp, X } from "lucide-react";

interface AllocationBreakdownProps {
  sectorAllocations: SectorAllocation[];
  totalValue: number;
  holdings?: Holding[];
}

export const AllocationBreakdown: React.FC<AllocationBreakdownProps> = ({
  sectorAllocations,
  totalValue,
  holdings = [],
}) => {
  const [isOthersExpanded, setIsOthersExpanded] = useState(false);
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [inspectSector, setInspectSector] = useState<string | null>(null);

  const formatRupee = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    return "₹" + Math.round(val).toLocaleString("en-IN");
  };

  // Dynamically compute real asset allocation from user's holdings
  const assetTypes = useMemo(() => {
    if (!holdings || holdings.length === 0 || totalValue <= 0) {
      return [
        { name: "Mutual Funds", pct: 0, value: 0, color: "#0ea5e9" },
        { name: "Direct Stocks", pct: 0, value: 0, color: "#6366f1" },
        { name: "ETFs", pct: 0, value: 0, color: "#10b981" },
      ];
    }

    let mfVal = 0;
    let stockVal = 0;
    let etfVal = 0;
    let otherVal = 0;

    for (const h of holdings) {
      const type = (h.instrument_type || "").toUpperCase();
      const name = (h.name || "").toLowerCase();
      const val = h.current_value || 0;

      if (type === "ETF" || name.includes("etf") || name.includes("nasdaq 100") || name.includes("bees")) {
        etfVal += val;
      } else if (type === "MUTUAL_FUND" || name.includes("fund") || name.includes("scheme")) {
        mfVal += val;
      } else if (type === "DEBT" || type === "BOND" || type === "GOLD") {
        otherVal += val;
      } else {
        stockVal += val;
      }
    }

    const items = [
      { name: "Mutual Funds", value: mfVal, pct: Number(((mfVal / totalValue) * 100).toFixed(1)), color: "#0ea5e9" },
      { name: "Direct Stocks", value: stockVal, pct: Number(((stockVal / totalValue) * 100).toFixed(1)), color: "#6366f1" },
      { name: "ETFs", value: etfVal, pct: Number(((etfVal / totalValue) * 100).toFixed(1)), color: "#10b981" },
    ];

    if (otherVal > 0) {
      items.push({
        name: "Debt & Others",
        value: otherVal,
        pct: Number(((otherVal / totalValue) * 100).toFixed(1)),
        color: "#f59e0b",
      });
    }

    const activeItems = items.filter((a) => a.pct > 0);
    return activeItems.length > 0 ? activeItems : items;
  }, [holdings, totalValue]);

  // Top sectors sorted
  const sortedSectors = useMemo(() => {
    return [...sectorAllocations].sort(
      (a, b) => b.allocation_pct - a.allocation_pct
    );
  }, [sectorAllocations]);

  // Show top 4 by default, remainder in "Others"
  const topSectors = useMemo(() => sortedSectors.slice(0, 4), [sortedSectors]);
  const otherSectors = useMemo(() => sortedSectors.slice(4), [sortedSectors]);

  const topSectorsPct = useMemo(() => {
    return topSectors.reduce((sum, s) => sum + s.allocation_pct, 0);
  }, [topSectors]);

  const remainingPct = useMemo(() => {
    if (otherSectors.length === 0) return 0;
    const directSum = otherSectors.reduce((sum, s) => sum + s.allocation_pct, 0);
    return directSum > 0 ? directSum : Math.max(0, 100 - topSectorsPct);
  }, [otherSectors, topSectorsPct]);

  // Distinct color palette for sectors
  const sectorColors = [
    "bg-sky-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-teal-500",
    "bg-rose-500",
    "bg-purple-500",
    "bg-cyan-500",
    "bg-blue-600",
  ];

  // Helper to find which holdings contribute to a selected sector
  const contributingHoldings = useMemo(() => {
    if (!inspectSector) return [];
    const secLower = inspectSector.toLowerCase().trim();

    return holdings.filter((h) => {
      const hSec = (h.sector || "").toLowerCase().trim();
      if (hSec === secLower) return true;
      // If it's a mutual fund/ETF, it contributes via look-through
      const isFund =
        h.instrument_type === "MUTUAL_FUND" ||
        h.name.toLowerCase().includes("fund") ||
        h.name.toLowerCase().includes("etf") ||
        h.name.toLowerCase().includes("index");
      return isFund;
    });
  }, [inspectSector, holdings]);

  // SVG Donut calculation constants
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. Asset Allocation (Donut Chart) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-5 tracking-tight">
          Asset Allocation
        </h3>

        <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
          {/* SVG Donut Chart */}
          <div className="relative w-40 h-40 shrink-0">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
              {assetTypes.map((item) => {
                const strokeDasharray = `${(item.pct / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((cumulativeAngle / 100) * circumference);
                cumulativeAngle += item.pct;

                return (
                  <circle
                    key={item.name}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-700 ease-out"
                  />
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="space-y-3 w-full max-w-[220px]">
            {assetTypes.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Top Sectors (Interactive Horizontal Bar Chart with 'Others' Breakdown) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {showAllSectors ? "All Sectors" : "Top Sectors"}
              </h3>
              {sortedSectors.length > 4 && (
                <button
                  onClick={() => setShowAllSectors(!showAllSectors)}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                >
                  {showAllSectors ? "Show Top 4" : `View All (${sortedSectors.length})`}
                </button>
              )}
            </div>

            <span
              title="Mutual funds and ETFs are unpacked into their actual underlying industry sectors"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md"
            >
              Look-Through Exposure
            </span>
          </div>

          {/* Sectors List */}
          <div className="space-y-3.5">
            {sortedSectors.length > 0 ? (
              (showAllSectors ? sortedSectors : topSectors).map((sector, i) => {
                const barColor = sectorColors[i % sectorColors.length];
                const secVal = sector.total_value > 0 ? sector.total_value : (sector.allocation_pct / 100) * totalValue;

                return (
                  <div
                    key={`${sector.sector}-${i}`}
                    onClick={() => setInspectSector(sector.sector)}
                    className="space-y-1 p-1 -m-1 rounded-lg hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    title={`Click to inspect holdings in ${sector.sector}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[200px] group-hover:text-slate-900">
                        {sector.sector}
                      </span>
                      <div className="flex items-center gap-2">
                        {secVal > 0 && (
                          <span className="text-[11px] text-slate-500 font-normal">
                            {formatRupee(secVal)}
                          </span>
                        )}
                        <span className="font-bold text-slate-900">
                          {sector.allocation_pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, sector.allocation_pct)}%` }}
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Upload a statement to view sector breakdown
              </div>
            )}

            {/* EXPANDABLE 'OTHERS' ACCORDION (when not in Show All mode) */}
            {!showAllSectors && otherSectors.length > 0 && remainingPct > 0 && (
              <div className="pt-1">
                <div
                  onClick={() => setIsOthersExpanded(!isOthersExpanded)}
                  className="p-2 -mx-2 rounded-xl bg-slate-50/90 border border-slate-200/80 hover:bg-slate-100/70 transition-all cursor-pointer select-none"
                  title="Click to view full breakdown of other sectors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700 font-semibold">Others</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                        {otherSectors.length} sectors
                      </span>
                      {isOthersExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        {formatRupee((remainingPct / 100) * totalValue)}
                      </span>
                      <span className="font-bold text-slate-900">
                        {remainingPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-200/60 rounded-full overflow-hidden mt-1.5">
                    <div
                      style={{ width: `${Math.min(100, remainingPct)}%` }}
                      className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500">
                    <span>
                      {isOthersExpanded ? "Click to collapse breakdown" : "Click to view breakdown of these investments"}
                    </span>
                    <span className="text-sky-700 font-semibold text-[10px]">
                      {isOthersExpanded ? "Hide" : "Expand ▾"}
                    </span>
                  </div>
                </div>

                {/* Expanded Detailed Breakdown of Others */}
                {isOthersExpanded && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50/60 border border-slate-200/70 space-y-2.5 animate-in fade-in duration-150">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Breakdown of &quot;Others&quot;</span>
                      <span className="text-slate-500 normal-case font-normal text-[10px]">
                        Sorted by weight
                      </span>
                    </div>

                    {otherSectors.map((subSector, subIdx) => {
                      const subVal = subSector.total_value > 0
                        ? subSector.total_value
                        : (subSector.allocation_pct / 100) * totalValue;

                      return (
                        <div
                          key={`other-${subSector.sector}-${subIdx}`}
                          onClick={() => setInspectSector(subSector.sector)}
                          className="space-y-1 p-1 -m-1 rounded-md hover:bg-slate-100/60 transition-colors cursor-pointer group"
                          title={`Click to inspect holdings in ${subSector.sector}`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-700 font-medium truncate max-w-[180px] group-hover:text-slate-900">
                              {subSector.sector}
                            </span>
                            <div className="flex items-center gap-2">
                              {subVal > 0 && (
                                <span className="text-[10.5px] text-slate-500">
                                  {formatRupee(subVal)}
                                </span>
                              )}
                              <span className="font-semibold text-slate-800">
                                {subSector.allocation_pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, (subSector.allocation_pct / remainingPct) * 100)}%` }}
                              className="h-full bg-slate-400 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-1 border-t border-slate-200/60 text-[10.5px] text-slate-500 leading-relaxed">
                      💡 These smaller sector weights are look-through exposures unpacked from your mutual funds and diversified holdings.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sector Inspection Modal/Drawer if a sector is clicked */}
        {inspectSector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 relative space-y-4">
              <button
                onClick={() => setInspectSector(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider mb-0.5">
                  Sector Inspection
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {inspectSector}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Holdings in your portfolio that contribute to this sector:
                </p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {contributingHoldings.length > 0 ? (
                  contributingHoldings.map((h) => {
                    const isDirect = (h.sector || "").toLowerCase().trim() === inspectSector.toLowerCase().trim();

                    return (
                      <div
                        key={`contrib-${h.id}-${h.name}`}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 line-clamp-1">
                            {h.name}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="capitalize">{h.instrument_type?.toLowerCase() || "holding"}</span>
                            <span>•</span>
                            <span className={isDirect ? "text-emerald-700 font-semibold" : "text-sky-700"}>
                              {isDirect ? "100% Direct Sector" : "Look-Through Exposure"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="font-bold text-slate-900">
                            {formatRupee(h.current_value)}
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            {h.allocation_pct ? `${h.allocation_pct.toFixed(1)}%` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-xs text-slate-500">
                    No individual holdings found. This sector was derived from broad market index decomposition.
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setInspectSector(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

