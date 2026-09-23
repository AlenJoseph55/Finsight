"use client";

import React from "react";
import { AlertTriangle, Info, CheckCircle2, Lightbulb, ArrowRight, Sparkles } from "lucide-react";
import { PortfolioSummary } from "@/lib/types";

interface InsightsViewProps {
  portfolio: PortfolioSummary | null;
  onAskCopilot: (prompt: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  portfolio,
  onAskCopilot,
}) => {
  const topSector = portfolio?.sector_allocations?.sort(
    (a, b) => b.allocation_pct - a.allocation_pct
  )[0];

  const insights = [
    {
      id: "sector",
      icon: AlertTriangle,
      iconBg: "bg-amber-100 text-amber-800",
      title: topSector
        ? `You have ${topSector.allocation_pct.toFixed(0)}% effective exposure to ${topSector.sector}`
        : "You have balanced sector distribution across your investments",
      subtitle:
        topSector && topSector.allocation_pct > 25
          ? "A downturn in this industry could impact a significant share of your portfolio."
          : "Your capital is distributed across multiple economic sectors.",
      actionPrompt: `Tell me about my exposure to ${topSector?.sector || "sectors"} and whether I should rebalance.`,
    },
    {
      id: "overlap",
      icon: Info,
      iconBg: "bg-sky-100 text-sky-700",
      title: "Multiple mutual funds have overlapping stock holdings",
      subtitle:
        "Holding funds that own the same large-cap stocks like HDFC Bank and Reliance can create unintentional concentration.",
      actionPrompt: "Do my mutual funds have overlapping stock holdings? List the common stocks.",
    },
    {
      id: "diversification",
      icon: CheckCircle2,
      iconBg: "bg-emerald-100 text-emerald-800",
      title: "Your portfolio is well diversified across asset classes",
      subtitle:
        "You have a healthy mix of diversified equity funds, direct equities, and liquid buffers.",
      actionPrompt: "Analyze the diversification quality of my overall investment portfolio.",
    },
    {
      id: "international",
      icon: Lightbulb,
      iconBg: "bg-amber-100 text-amber-700",
      title: "Consider increasing international exposure",
      subtitle:
        "Adding global index funds or US-focused ETFs can help hedge against single-country economic cycles.",
      actionPrompt: "Should I add international funds to my portfolio, and what are good options?",
    },
  ];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs max-w-3xl">
      <div className="pb-5 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">Insights</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Key observations about your portfolio
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => onAskCopilot(item.actionPrompt)}
              className="py-4 flex items-start gap-4 hover:bg-slate-50/80 rounded-xl px-3 -mx-3 transition-colors cursor-pointer group"
            >
              <div
                className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0 mt-0.5`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {item.subtitle}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0 mt-1" />
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100 mt-2 flex items-center justify-end">
        <button
          onClick={() =>
            onAskCopilot("Give me a comprehensive deep-dive summary of all strengths and risks in my portfolio.")
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask AI for Detailed Insights</span>
        </button>
      </div>
    </div>
  );
};
