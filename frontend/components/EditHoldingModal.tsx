"use client";

import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { Holding, UpdateHoldingPayload } from "../lib/types";

interface EditHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Holding | null;
  onSave: (holdingId: number, payload: UpdateHoldingPayload) => Promise<void>;
}

const SECTORS = [
  "Financial Services",
  "Information Technology",
  "Energy",
  "Automobile",
  "Healthcare",
  "Consumer Goods",
  "FMCG",
  "Realty",
  "Metals & Mining",
  "Construction & Infrastructure",
  "Telecommunication",
  "Diversified",
];

export const EditHoldingModal: React.FC<EditHoldingModalProps> = ({
  isOpen,
  onClose,
  holding,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("Diversified");
  const [instrumentType, setInstrumentType] = useState<"STOCK" | "MUTUAL_FUND" | "ETF">("MUTUAL_FUND");
  const [investedAmount, setInvestedAmount] = useState<string>("");
  const [currentValue, setCurrentValue] = useState<string>("");
  const [units, setUnits] = useState<string>("");
  const [nav, setNav] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (holding) {
      setName(holding.name || "");
      setSector(holding.sector || "Diversified");
      setInstrumentType((holding.instrument_type as any) || "MUTUAL_FUND");
      setInvestedAmount(holding.invested_amount !== undefined ? String(holding.invested_amount) : "0");
      setCurrentValue(holding.current_value !== undefined ? String(holding.current_value) : "0");
      setUnits(holding.units ? String(holding.units) : "");
      setNav(holding.nav ? String(holding.nav) : "");
      setError(null);
    }
  }, [holding]);

  if (!isOpen || !holding) return null;

  const numInvested = parseFloat(investedAmount) || 0;
  const numCurrent = parseFloat(currentValue) || 0;
  const gainAmount = numCurrent - numInvested;
  const gainPct = numInvested > 0 ? (gainAmount / numInvested) * 100 : 0;
  const isPositive = gainPct >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a valid investment name.");
      return;
    }
    if (numInvested < 0 || numCurrent < 0) {
      setError("Values cannot be negative.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(holding.id, {
        name: name.trim(),
        sector,
        instrument_type: instrumentType,
        invested_amount: numInvested,
        current_value: numCurrent,
        units: units.trim() ? parseFloat(units) : undefined,
        nav: nav.trim() ? parseFloat(nav) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update holding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Investment</h3>
              <p className="text-[11px] text-slate-500">Update holding values and sector categorization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Investment / Scheme Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-emerald-600"
              placeholder="e.g. HDFC Bank Ltd or Nippon India Small Cap"
            />
          </div>

          {/* Sector & Instrument Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Sector Allocation
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-emerald-600"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Asset Type
              </label>
              <select
                value={instrumentType}
                onChange={(e) => setInstrumentType(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-emerald-600"
              >
                <option value="MUTUAL_FUND">Mutual Fund</option>
                <option value="STOCK">Direct Stock</option>
                <option value="ETF">ETF</option>
              </select>
            </div>
          </div>

          {/* Invested & Current Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Invested Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-emerald-600"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Current Market Value (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-emerald-600"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Units & NAV (Optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Units / Shares (Optional)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-emerald-600"
                placeholder="e.g. 100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Unit Price / NAV (Optional)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={nav}
                onChange={(e) => setNav(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-emerald-600"
                placeholder="e.g. 165.50"
              />
            </div>
          </div>

          {/* Live Gain/Loss Preview */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Projected Gain / Loss:</span>
            <div className="flex items-center gap-1.5 font-bold">
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span className={isPositive ? "text-emerald-700" : "text-rose-700"}>
                {gainAmount >= 0 ? "+" : ""}₹{gainAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ({gainPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
