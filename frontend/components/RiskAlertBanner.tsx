"use client";

import React from "react";
import { AlertTriangle, ArrowRight, Info, Sparkles } from "lucide-react";

interface RiskAlertBannerProps {
  isConcentrated: boolean;
  concentrationSummary?: string | null;
  onViewHoldings?: () => void;
  onLearnMore?: () => void;
}

export const RiskAlertBanner: React.FC<RiskAlertBannerProps> = ({
  isConcentrated,
  concentrationSummary,
  onViewHoldings,
  onLearnMore,
}) => {
  if (!isConcentrated) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-950">Your portfolio looks healthy</h4>
          <p className="text-xs text-emerald-800/80 mt-0.5">
            Keep diversifying and stay invested for the long term.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* 1. High Concentration Warning Card */}
      <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-950">High concentration risk</h4>
            <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
              {concentrationSummary ||
                "A large share of your money is concentrated in one sector, which exceeds the recommended 25% guideline."}
            </p>
            {onViewHoldings && (
              <button
                onClick={onViewHoldings}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 transition-colors cursor-pointer"
              >
                <span>View affected holdings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Educational Explainer Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-900">What does this mean?</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Putting too much of your money into one sector increases risk if that sector experiences a downturn. Spreading your next investments across other industries helps protect your returns.
            </p>
            {onLearnMore && (
              <button
                onClick={onLearnMore}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <span>Learn more</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
