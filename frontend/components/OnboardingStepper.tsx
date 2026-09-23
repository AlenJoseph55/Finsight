"use client";

import React from "react";
import { UploadCloud, Sparkles, ArrowRight, Lock } from "lucide-react";

interface OnboardingStepperProps {
  onOpenUpload: () => void;
  onExploreDemo: () => void;
}

export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({
  onOpenUpload,
  onExploreDemo,
}) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Welcome to FinSight</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Get your financial intelligence in 3 steps
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Follow the activation steps below to see your true asset allocation, sector look-through, and risk alerts.
          </p>
        </div>

        {/* Quick Demo Sandbox Option */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={onExploreDemo}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Preview Demo Sandbox</span>
          </button>
        </div>
      </div>

      {/* 3 Interactive Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1: Active */}
        <div className="rounded-xl p-4 bg-emerald-50/40 border border-emerald-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Step 1 • Ready
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Import Your Holdings
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload your CAMS/KFintech CAS PDF, broker Excel/CSV, or screenshots.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenUpload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer group"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-300" />
              <span>Upload Statement</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Step 2: Unlocks after Step 1 */}
        <div className="rounded-xl p-4 bg-slate-50/60 border border-slate-200/70 flex flex-col justify-between space-y-4 opacity-85">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                Step 2
              </span>
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              Track Monthly SIPs
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Add your active mutual fund SIPs to unlock a 20-year compound wealth forecast.
            </p>
          </div>

          <div className="pt-2">
            <div className="w-full py-2 px-3 rounded-lg bg-slate-100/80 border border-dashed border-slate-200 text-[11px] text-center text-slate-500 font-medium">
              Unlocks with your holdings
            </div>
          </div>
        </div>

        {/* Step 3: Unlocks after Step 1 */}
        <div className="rounded-xl p-4 bg-slate-50/60 border border-slate-200/70 flex flex-col justify-between space-y-4 opacity-85">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                Step 3
              </span>
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              Risk &amp; Overlap Scan
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detect hidden mutual fund portfolio overlap and single-stock concentration risks.
            </p>
          </div>

          <div className="pt-2">
            <div className="w-full py-2 px-3 rounded-lg bg-slate-100/80 border border-dashed border-slate-200 text-[11px] text-center text-slate-500 font-medium">
              Automatic upon upload
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
