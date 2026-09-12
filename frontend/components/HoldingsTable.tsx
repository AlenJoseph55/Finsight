"use client";

import React, { useState } from "react";
import { Holding } from "@/lib/types";
import { Layers, Briefcase, Edit3, Check, X, ArrowUpRight } from "lucide-react";

interface HoldingsTableProps {
  holdings: Holding[];
  onCorrectHolding?: (holdingId: number, newSector: string) => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  onCorrectHolding,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedSector, setEditedSector] = useState<string>("");

  const mutualFunds = holdings.filter((h) => h.instrument_type === "MUTUAL_FUND" || h.name.includes("Fund") || h.name.includes("ETF"));
  const stocks = holdings.filter((h) => h.instrument_type === "STOCK" && !h.name.includes("Fund") && !h.name.includes("ETF"));

  const handleStartEdit = (h: Holding) => {
    setEditingId(h.id);
    setEditedSector(h.sector);
  };

  const handleSaveEdit = (id: number) => {
    if (onCorrectHolding && editedSector.trim()) {
      onCorrectHolding(id, editedSector.trim());
    }
    setEditingId(null);
  };

  const renderSection = (title: string, icon: React.ReactNode, items: Holding[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6 last:mb-0">
        <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-[#1b2438]">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {title} ({items.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] tracking-wider border-b border-[#182236]">
                <th className="pb-2 font-medium">Asset Name</th>
                <th className="pb-2 font-medium">Domain / Sector</th>
                <th className="pb-2 font-medium text-right">Invested</th>
                <th className="pb-2 font-medium text-right">Current Value</th>
                <th className="pb-2 font-medium text-right">Gain / Loss</th>
                <th className="pb-2 font-medium text-right">Weight</th>
                <th className="pb-2 font-medium text-center">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151c2e]">
              {items.map((h) => {
                const gain = h.current_value - h.invested_amount;
                const gainPct = h.invested_amount > 0 ? (gain / h.invested_amount) * 100 : 0;
                const isPositive = gain >= 0;

                return (
                  <tr key={h.id} className="hover:bg-[#121929] transition-colors group">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        {h.name}
                        {h.symbol && (
                          <span className="text-[10px] font-mono text-slate-400">
                            ({h.symbol})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-2">
                      {editingId === h.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editedSector}
                            onChange={(e) => setEditedSector(e.target.value)}
                            className="bg-[#1a233a] text-slate-100 px-2 py-0.5 rounded text-xs border border-indigo-500/50 focus:outline-none"
                            placeholder="e.g. Healthcare"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(h.id)}
                            className="p-1 hover:text-emerald-400 text-slate-400"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 hover:text-rose-400 text-slate-400"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#141b2a] text-slate-300 border border-[#1f2a3f]">
                          {h.sector}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-2 text-right font-mono-num text-slate-300">
                      ₹{h.invested_amount.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3 px-2 text-right font-mono-num font-semibold text-slate-100">
                      ₹{h.current_value.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3 px-2 text-right font-mono-num">
                      <span className={`font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}
                        ₹{gain.toLocaleString("en-IN")} ({isPositive ? "+" : ""}{gainPct.toFixed(1)}%)
                      </span>
                    </td>

                    <td className="py-3 px-2 text-right font-mono-num text-slate-300 font-semibold">
                      {h.allocation_pct.toFixed(1)}%
                    </td>

                    <td className="py-3 pl-2 text-center">
                      <button
                        onClick={() => handleStartEdit(h)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-indigo-400 transition-opacity"
                        title="Correct sector (Human Feedback Loop)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 rounded-xl bg-[#0d1320] border border-[#182236]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Portfolio Holdings & Domain Allocation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified with Deterministic Math Engine
          </p>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-[#121929] px-2.5 py-1 rounded border border-[#1f2a3f]">
          <span>Total Assets:</span>
          <span className="font-bold text-white">{holdings.length}</span>
        </div>
      </div>

      {renderSection("Mutual Funds & ETFs", <Layers className="w-3.5 h-3.5 text-indigo-400" />, mutualFunds)}
      {renderSection("Equities / Stocks", <Briefcase className="w-3.5 h-3.5 text-emerald-400" />, stocks)}
    </div>
  );
};
