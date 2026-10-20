"use client";

import React from "react";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

export type MetricAccent = "emerald" | "indigo" | "amber" | "rose" | "violet" | "slate";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  changePct?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  badge?: string;
  highlight?: boolean;
  accent?: MetricAccent;
  isLoading?: boolean;
}

const ACCENT_STYLES: Record<
  MetricAccent,
  {
    topBorder: string;
    bgGradient: string;
    iconBg: string;
    iconText: string;
    iconBorder: string;
  }
> = {
  emerald: {
    topBorder: "border-t-2 border-t-emerald-500",
    bgGradient: "bg-gradient-to-b from-emerald-50/30 via-white to-white",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-700",
    iconBorder: "border-emerald-200/70",
  },
  indigo: {
    topBorder: "border-t-2 border-t-indigo-500",
    bgGradient: "bg-gradient-to-b from-indigo-50/30 via-white to-white",
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-700",
    iconBorder: "border-indigo-200/70",
  },
  amber: {
    topBorder: "border-t-2 border-t-amber-500",
    bgGradient: "bg-gradient-to-b from-amber-50/30 via-white to-white",
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    iconBorder: "border-amber-200/70",
  },
  rose: {
    topBorder: "border-t-2 border-t-rose-500",
    bgGradient: "bg-gradient-to-b from-rose-50/30 via-white to-white",
    iconBg: "bg-rose-50",
    iconText: "text-rose-700",
    iconBorder: "border-rose-200/70",
  },
  violet: {
    topBorder: "border-t-2 border-t-violet-500",
    bgGradient: "bg-gradient-to-b from-violet-50/30 via-white to-white",
    iconBg: "bg-violet-50",
    iconText: "text-violet-700",
    iconBorder: "border-violet-200/70",
  },
  slate: {
    topBorder: "border-t-2 border-t-slate-300",
    bgGradient: "bg-white",
    iconBg: "bg-slate-50",
    iconText: "text-slate-600",
    iconBorder: "border-slate-200",
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  changePct,
  changeLabel,
  icon: Icon,
  badge,
  accent,
  isLoading,
}) => {
  if (isLoading) {
    const currentAccent = accent || "slate";
    const style = ACCENT_STYLES[currentAccent] || ACCENT_STYLES.slate;
    return (
      <div
        className={`border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs ${style.topBorder} bg-white animate-pulse`}
      >
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="h-3.5 bg-slate-200 rounded w-20" />
          <div className="w-7 h-7 rounded-xl bg-slate-100" />
        </div>
        <div className="h-7 bg-slate-200/80 rounded w-32 my-2.5" />
        <div className="h-3 bg-slate-100 rounded w-24" />
      </div>
    );
  }
  const isPositive = changePct !== undefined && changePct >= 0;
  const currentAccent =
    accent || (changePct !== undefined ? (isPositive ? "emerald" : "rose") : "slate");
  const style = ACCENT_STYLES[currentAccent] || ACCENT_STYLES.slate;

  return (
    <div
      className={`border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm ${style.topBorder} ${style.bgGradient}`}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className="text-xs font-semibold text-slate-500 tracking-normal truncate">
          {title}
        </span>
        {badge && (
          <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            {badge}
          </span>
        )}
        {Icon && !badge && (
          <div className={`p-1.5 rounded-xl border ${style.iconBg} ${style.iconText} ${style.iconBorder} shrink-0`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-xl min-[400px]:text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
          {value}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        {changePct !== undefined && (
          <span
            className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-xs ${
              isPositive
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                : "bg-rose-50 text-rose-700 border border-rose-200/60"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            ) : (
              <TrendingDown className="w-3 h-3 text-rose-600" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {changePct.toFixed(1)}%
            </span>
          </span>
        )}

        {changeLabel && (
          <span className="text-slate-500 text-xs truncate">{changeLabel}</span>
        )}

        {subtitle && !changeLabel && (
          <span
            className={`text-xs truncate ${
              changePct === undefined
                ? "px-2 py-0.5 rounded-md font-medium bg-slate-100/90 text-slate-600 border border-slate-200/60"
                : "text-slate-500"
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
