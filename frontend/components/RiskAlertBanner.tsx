"use client";

import React from "react";
import { AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";

interface RiskAlertBannerProps {
  isConcentrated: boolean;
  concentrationSummary?: string | null;
}

export const RiskAlertBanner: React.FC<RiskAlertBannerProps> = ({
  isConcentrated,
  concentrationSummary,
}) => {
  if (!isConcentrated) {
    return (
      <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-emerald-300">Portfolio Diversification Healthy</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {concentrationSummary || "No single sector exceeds the risk threshold (30%). Capital is well distributed."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3.5">
      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5 animate-pulse">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-amber-300 tracking-tight">
            Concentration Alert: Sector Exposure Warning
          </h4>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Agent 1 Flag
          </span>
        </div>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {concentrationSummary}
        </p>
        <p className="text-[11px] text-amber-400/80 mt-1">
          💡 Agent 3 (Market Monitor) will prioritize early-warning market crash alerts for these concentrated sectors.
        </p>
      </div>
    </div>
  );
};
