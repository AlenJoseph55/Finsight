"use client";

import React from "react";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  changePct?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  badge?: string;
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  changePct,
  changeLabel,
  icon: Icon,
  badge,
  highlight = false,
}) => {
  const isPositive = changePct !== undefined && changePct >= 0;

  return (
    <div
      className={`relative p-5 rounded-xl border transition-all duration-200 ${
        highlight
          ? "bg-gradient-to-br from-[#121c2e] to-[#0d1422] border-emerald-500/30 shadow-lg shadow-emerald-500/5"
          : "bg-[#0d1320] border-[#182236] hover:border-[#22314d]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {badge && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {badge}
          </span>
        )}
        {Icon && !badge && (
          <div className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono-num">
          {value}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {changePct !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 font-semibold font-mono-num ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isPositive ? `+${changePct}%` : `${changePct}%`}
          </span>
        )}
        {changeLabel && <span className="text-slate-400">{changeLabel}</span>}
        {subtitle && <span className="text-slate-400">{subtitle}</span>}
      </div>
    </div>
  );
};
