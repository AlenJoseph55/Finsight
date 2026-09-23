"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { SipSummaryResponse } from "@/lib/types";
import { deleteSipPlan } from "@/lib/api";

interface SIPDashboardProps {
  sipData: SipSummaryResponse | null;
  isLoading: boolean;
  onOpenUpload: () => void;
  onRefresh: () => void;
}

export const SIPDashboard: React.FC<SIPDashboardProps> = ({
  sipData,
  isLoading,
  onOpenUpload,
  onRefresh,
}) => {
  const [selectedHorizon, setSelectedHorizon] = useState<number>(10);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatLakhsCrores = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return formatINR(val);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this SIP mandate?")) return;
    try {
      setDeletingId(id);
      await deleteSipPlan(id);
      onRefresh();
    } catch {
      alert("Failed to delete SIP mandate.");
    } finally {
      setDeletingId(null);
    }
  };

  const plans = sipData?.sip_plans || [];
  const monthlyAmount =
    sipData?.total_monthly_outflow ||
    plans.reduce((acc, p) => acc + (p.monthly_amount || 0), 0) ||
    10000;
  const isSample = !sipData?.total_monthly_outflow && plans.length === 0;

  // 20-Year projection math: 12% Average, 15% Optimistic, and Deposited Cash
  const graphData = useMemo(() => {
    const points = [];
    const iMod = 0.12 / 12;
    const iOpt = 0.15 / 12;

    for (let y = 1; y <= 20; y++) {
      const n = y * 12;
      const deposited = monthlyAmount * n;
      const moderate = monthlyAmount * (((Math.pow(1 + iMod, n) - 1) / iMod)) * (1 + iMod);
      const optimistic = monthlyAmount * (((Math.pow(1 + iOpt, n) - 1) / iOpt)) * (1 + iOpt);
      points.push({
        year: y,
        deposited: Math.round(deposited),
        moderate: Math.round(moderate),
        optimistic: Math.round(optimistic),
      });
    }
    return points;
  }, [monthlyAmount]);

  if (isLoading && !sipData) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        Loading SIP investments...
      </div>
    );
  }

  // Active point based on hover or selected milestone
  const activeYear = hoveredYear ?? selectedHorizon;
  const activePoint =
    graphData.find((p) => p.year === activeYear) || graphData[graphData.length - 1];

  // SVG Chart Geometry
  const svgWidth = 760;
  const svgHeight = 280;
  const padL = 72;
  const padR = 24;
  const padT = 28;
  const padB = 36;
  const plotW = svgWidth - padL - padR;
  const plotH = svgHeight - padT - padB;

  // Nice Y-axis ceiling
  const rawMax = graphData[graphData.length - 1]?.optimistic || 1000000;
  const getNiceCeil = (val: number) => {
    const mag = Math.pow(10, Math.floor(Math.log10(val)));
    const norm = val / mag;
    let factor = 10;
    if (norm <= 1.25) factor = 1.25;
    else if (norm <= 1.5) factor = 1.5;
    else if (norm <= 2) factor = 2;
    else if (norm <= 2.5) factor = 2.5;
    else if (norm <= 3) factor = 3;
    else if (norm <= 5) factor = 5;
    else if (norm <= 7.5) factor = 7.5;
    return factor * mag;
  };
  const yMax = getNiceCeil(rawMax);

  // Coordinate mappers
  const getX = (year: number) => padL + ((year - 1) / 19) * plotW;
  const getY = (val: number) => padT + plotH - (val / yMax) * plotH;

  // Cubic Bezier curve path generator
  const createSmoothPath = (key: "deposited" | "moderate" | "optimistic") => {
    const coords = graphData.map((d) => ({
      x: getX(d.year),
      y: getY(d[key]),
    }));

    if (coords.length === 0) return "";
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 >= coords.length ? coords.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const depositedPath = createSmoothPath("deposited");
  const moderatePath = createSmoothPath("moderate");
  const optimisticPath = createSmoothPath("optimistic");

  const optimisticArea = `${optimisticPath} L ${(padL + plotW).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const moderateArea = `${moderatePath} L ${(padL + plotW).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  // Horizontal Grid intervals
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Active hover/selected point coordinates
  const activeX = getX(activePoint.year);
  const activeDepositedY = getY(activePoint.deposited);
  const activeModerateY = getY(activePoint.moderate);
  const activeOptimisticY = getY(activePoint.optimistic);

  return (
    <div className="space-y-6">
      {/* 1. Header & Active Mandates Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Your SIPs</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {sipData?.active_sips_count || plans.length} active SIPs ·{" "}
              {formatINR(sipData?.total_monthly_outflow || 0)}/month
            </p>
          </div>

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add SIP</span>
          </button>
        </div>

        {/* Desktop SIP Table (lg+) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 text-[11px] font-medium border-b border-slate-100">
                <th className="py-3 pr-4">Fund Name</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Frequency</th>
                <th className="py-3 px-3">Sector</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 pl-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No active SIPs found. Upload a statement or screenshot to add your SIPs.
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-900 max-w-[240px] truncate">
                        {p.fund_name}
                      </div>
                      {p.folio_number && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Folio: {p.folio_number}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                      {formatINR(p.monthly_amount)}
                    </td>

                    <td className="py-3.5 px-3 font-medium text-slate-600 capitalize">
                      {p.frequency.toLowerCase()}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium truncate max-w-[120px] inline-block">
                        {p.fund_sector}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Active
                      </span>
                    </td>

                    <td className="py-3.5 pl-3 text-center">
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete SIP mandate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile / Tablet SIP Cards (< lg) */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {plans.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No active SIPs found. Upload a statement or screenshot to add your SIPs.
            </div>
          ) : (
            plans.map((p) => (
              <div key={`mob-sip-${p.id}`} className="py-3.5 space-y-2">
                {/* Row 1: Fund name, folio, frequency & status, and Delete button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 text-sm truncate">
                      {p.fund_name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium truncate max-w-[140px]">
                        {p.fund_sector}
                      </span>
                      <span className="text-[10.5px] text-slate-500 capitalize">
                        {p.frequency.toLowerCase()}
                      </span>
                      {p.folio_number && (
                        <span className="text-[10px] text-slate-400">
                          Folio: {p.folio_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      Active
                    </span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete SIP mandate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Monthly amount */}
                <div className="flex items-center justify-between text-xs pt-1 bg-slate-50/70 px-3 py-2 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium">Monthly Outflow</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatINR(p.monthly_amount)}
                    <span className="text-[11px] font-normal text-slate-500 ml-1">/mo</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Domain Concentration Warning (if applicable) */}
      {sipData?.is_concentrated && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-950">High Sector Concentration in Monthly SIPs</h4>
            <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
              {sipData.concentration_summary ||
                "A large share of your monthly cash flow is going into one industry sector. Consider spreading future SIPs across other asset categories."}
            </p>
          </div>
        </div>
      )}

      {/* 3. Projected Wealth Growth Graph */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Projected Wealth Growth
              </h3>
              {isSample && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  The Power of Compounding
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              {isSample
                ? "How a disciplined ₹10,000/month can grow into ₹1 Crore in 20 years. Upload your own SIPs to personalize your projection."
                : `Projected growth curves based on ${formatINR(monthlyAmount)} monthly investment over 20 years.`}
            </p>
          </div>

          {/* Time Horizon Quick Selector Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 max-w-full overflow-x-auto scrollbar-none self-start sm:self-auto shrink-0">
            {[3, 5, 10, 15, 20].map((yr) => (
              <button
                key={yr}
                onClick={() => {
                  setSelectedHorizon(yr);
                  setHoveredYear(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  activeYear === yr
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {yr} Years
              </button>
            ))}
          </div>
        </div>

        {/* Outcome Snapshot Cards (Updating dynamically with hover or selected horizon) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Deposited Cash */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">
                Deposited Cash (Year {activePoint.year})
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1.5">
              {formatLakhsCrores(activePoint.deposited)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Total cash contributed ({activePoint.year * 12} months)
            </p>
          </div>

          {/* 12% Average */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-800">
                12% Average (Year {activePoint.year})
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                Expected
              </span>
            </div>
            <p className="text-xl font-bold text-emerald-950 mt-1.5">
              {formatLakhsCrores(activePoint.moderate)}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              +{formatLakhsCrores(activePoint.moderate - activePoint.deposited)} growth (
              {(activePoint.moderate / activePoint.deposited).toFixed(1)}x)
            </p>
          </div>

          {/* 15% Optimistic */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-indigo-800">
                15% Optimistic (Year {activePoint.year})
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                Optimistic
              </span>
            </div>
            <p className="text-xl font-bold text-indigo-950 mt-1.5">
              {formatLakhsCrores(activePoint.optimistic)}
            </p>
            <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
              +{formatLakhsCrores(activePoint.optimistic - activePoint.deposited)} growth (
              {(activePoint.optimistic / activePoint.deposited).toFixed(1)}x)
            </p>
          </div>
        </div>

        {/* Legend & Hover Guide */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium pt-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <span>Hover or tap along the graph to inspect any year</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-b-2 border-dashed border-slate-500 inline-block" />
              <span className="text-slate-700 font-medium">Deposited Cash</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-emerald-500 rounded-full inline-block" />
              <span className="text-emerald-700 font-semibold">12% Average</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-indigo-500 rounded-full inline-block" />
              <span className="text-indigo-700 font-semibold">15% Optimistic</span>
            </div>
          </div>
        </div>

        {/* Interactive Multi-Line SVG Wealth Graph */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible"
            onMouseLeave={() => setHoveredYear(null)}
          >
            <defs>
              {/* 15% Optimistic Area Gradient */}
              <linearGradient id="optAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>

              {/* 12% Average Area Gradient */}
              <linearGradient id="modAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines and Y-Axis Ticks */}
            {gridLevels.map((lvl) => {
              const val = yMax * lvl;
              const y = getY(val);
              return (
                <g key={lvl}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={padL + plotW}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padL - 12}
                    y={y + 3.5}
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="500"
                    textAnchor="end"
                  >
                    {formatLakhsCrores(val)}
                  </text>
                </g>
              );
            })}

            {/* Baseline (₹0) */}
            <line
              x1={padL}
              y1={padT + plotH}
              x2={padL + plotW}
              y2={padT + plotH}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={padL - 12}
              y={padT + plotH + 3.5}
              fill="#94a3b8"
              fontSize="10"
              fontWeight="500"
              textAnchor="end"
            >
              ₹0
            </text>

            {/* Area Fills under curves */}
            <path d={optimisticArea} fill="url(#optAreaGrad)" />
            <path d={moderateArea} fill="url(#modAreaGrad)" />

            {/* The 3 Lines */}
            {/* 1. Deposited Cash (dashed slate) */}
            <path
              d={depositedPath}
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />

            {/* 2. 12% Average (solid emerald) */}
            <path
              d={moderatePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* 3. 15% Optimistic (solid indigo) */}
            <path
              d={optimisticPath}
              fill="none"
              stroke="#6366f1"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* X-Axis Year Labels */}
            {[1, 5, 10, 15, 20].map((yr) => {
              const x = getX(yr);
              const isSelected = activePoint.year === yr;
              return (
                <g key={yr}>
                  <line
                    x1={x}
                    y1={padT + plotH}
                    x2={x}
                    y2={padT + plotH + 5}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padT + plotH + 18}
                    fill={isSelected ? "#0f172a" : "#94a3b8"}
                    fontSize="10"
                    fontWeight={isSelected ? "700" : "500"}
                    textAnchor="middle"
                  >
                    Year {yr}
                  </text>
                </g>
              );
            })}

            {/* Interactive Vertical Crosshair Line */}
            <line
              x1={activeX}
              y1={padT}
              x2={activeX}
              y2={padT + plotH}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />

            {/* Hover Floating Year Badge */}
            <g transform={`translate(${Math.min(Math.max(activeX, padL + 35), padL + plotW - 35)}, ${padT - 10})`}>
              <rect
                x="-32"
                y="-14"
                width="64"
                height="18"
                rx="5"
                fill="#0f172a"
                className="filter drop-shadow-xs"
              />
              <text
                x="0"
                y="-2"
                fill="#ffffff"
                fontSize="9.5"
                fontWeight="700"
                textAnchor="middle"
              >
                Year {activePoint.year}
              </text>
            </g>

            {/* Active Intersection Dots on the 3 curves */}
            {/* 15% Optimistic Dot */}
            <circle
              cx={activeX}
              cy={activeOptimisticY}
              r="5.5"
              fill="#6366f1"
              stroke="#ffffff"
              strokeWidth="2.5"
              className="filter drop-shadow-xs"
            />

            {/* 12% Average Dot */}
            <circle
              cx={activeX}
              cy={activeModerateY}
              r="5.5"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2.5"
              className="filter drop-shadow-xs"
            />

            {/* Deposited Cash Dot */}
            <circle
              cx={activeX}
              cy={activeDepositedY}
              r="4.5"
              fill="#64748b"
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Interactive hover hit-boxes for each year slice */}
            {graphData.map((d) => {
              const x = getX(d.year);
              const sliceW = plotW / 19;
              return (
                <rect
                  key={d.year}
                  x={Math.max(padL, x - sliceW / 2)}
                  y={padT - 15}
                  width={sliceW}
                  height={plotH + 40}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredYear(d.year)}
                  onClick={() => setSelectedHorizon(d.year)}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

