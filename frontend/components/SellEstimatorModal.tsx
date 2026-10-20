"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Calculator,
  Percent,
  Calendar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Info,
  ShieldCheck,
  Building,
  Save,
  Loader2,
  HelpCircle,
} from "lucide-react";
import {
  Holding,
  BrokerOption,
  SellEstimateResult,
  UpdateHoldingPayload,
} from "@/lib/types";
import { fetchSupportedBrokers, calculateSellEstimate } from "@/lib/api";

interface SellEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Holding | null;
  onUpdateHolding?: (holdingId: number, payload: UpdateHoldingPayload) => Promise<void>;
}

const DEFAULT_BROKERS: BrokerOption[] = [
  { key: "zerodha", name: "Zerodha", notes: "₹0 Brokerage on Equity Delivery & Direct Mutual Funds via Coin" },
  { key: "groww", name: "Groww", notes: "₹20 or 0.05% (whichever lower) per executed equity order; ₹0 on Direct MFs" },
  { key: "angel_one", name: "Angel One", notes: "₹0 Brokerage on Equity Delivery & Mutual Funds" },
  { key: "upstox", name: "Upstox", notes: "₹20 or 2.5% per delivery order; ₹0 on Mutual Funds" },
  { key: "hdfc_sec", name: "HDFC Securities", notes: "0.50% or ₹25 minimum per executed delivery order" },
  { key: "icici_direct", name: "ICICI Direct", notes: "0.275% equity delivery brokerage" },
  { key: "paytm_money", name: "Paytm Money", notes: "₹0 Brokerage on Equity Delivery & Direct MF" },
  { key: "kuvera", name: "Kuvera", notes: "100% Free Direct Mutual Funds" },
  { key: "other", name: "Other / Standard Broker", notes: "Standard discount broker fee (₹20 or 0.05%)" },
];

export const SellEstimatorModal: React.FC<SellEstimatorModalProps> = ({
  isOpen,
  onClose,
  holding,
  onUpdateHolding,
}) => {
  const [brokers, setBrokers] = useState<BrokerOption[]>(DEFAULT_BROKERS);
  const [selectedBroker, setSelectedBroker] = useState<string>("zerodha");
  const [sellQuantity, setSellQuantity] = useState<number>(0);
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [customExitLoad, setCustomExitLoad] = useState<string>("");
  const [estimate, setEstimate] = useState<SellEstimateResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingMeta, setIsSavingMeta] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize broker options
  useEffect(() => {
    fetchSupportedBrokers()
      .then((data) => {
        if (data && data.length > 0) setBrokers(data);
      })
      .catch(() => {
        // Fallback to default brokers
      });
  }, []);

  // Format currency in Indian Rupees
  const formatRupee = useCallback((val?: number) => {
    if (val === undefined || isNaN(val)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  // Total holding units
  const totalUnits = useMemo(() => {
    if (!holding) return 0;
    if (holding.units && holding.units > 0) return holding.units;
    const price = holding.nav && holding.nav > 0 ? holding.nav : (holding.invested_amount > 0 ? holding.invested_amount : 1);
    return holding.current_value / price;
  }, [holding]);

  // Current price or NAV
  const currentPrice = useMemo(() => {
    if (!holding) return 0;
    if (holding.nav && holding.nav > 0) return holding.nav;
    if (totalUnits > 0) return holding.current_value / totalUnits;
    return holding.current_value;
  }, [holding, totalUnits]);

  // Sync state when a holding is opened
  useEffect(() => {
    if (holding && isOpen) {
      const savedBroker = localStorage.getItem("finsight_preferred_broker") || holding.broker || "zerodha";
      setSelectedBroker(savedBroker.toLowerCase());
      
      const units = holding.units && holding.units > 0 ? holding.units : (totalUnits > 0 ? totalUnits : 1);
      setSellQuantity(units);

      if (holding.purchase_date) {
        setPurchaseDate(holding.purchase_date);
      } else {
        // Default to 400 days ago (Long-Term assumption) if unknown
        const d = new Date();
        d.setDate(d.getDate() - 400);
        setPurchaseDate(d.toISOString().split("T")[0]);
      }

      setCustomExitLoad("");
      setSaveSuccess(false);
      setError(null);
    }
  }, [holding, isOpen, totalUnits]);

  // Recalculate estimate (reactive)
  const runEstimate = useCallback(async () => {
    if (!holding || sellQuantity <= 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await calculateSellEstimate({
        holding_id: holding.id,
        sell_quantity: sellQuantity,
        broker: selectedBroker,
        purchase_date: purchaseDate || undefined,
        custom_exit_load_pct: customExitLoad ? parseFloat(customExitLoad) : undefined,
      });
      setEstimate(res);
    } catch (err: any) {
      setError(err?.message || "Failed to calculate estimate");
    } finally {
      setIsLoading(false);
    }
  }, [holding, sellQuantity, selectedBroker, purchaseDate, customExitLoad]);

  // Debounced execution
  useEffect(() => {
    if (!isOpen || !holding) return;
    const timer = setTimeout(() => {
      runEstimate();
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen, holding, sellQuantity, selectedBroker, purchaseDate, customExitLoad, runEstimate]);

  const handleBrokerChange = (brokerKey: string) => {
    setSelectedBroker(brokerKey);
    try {
      localStorage.setItem("finsight_preferred_broker", brokerKey);
    } catch (e) {
      // Ignore localStorage error
    }
  };

  const handleQuickPercent = (pct: number) => {
    const qty = (totalUnits * pct) / 100;
    setSellQuantity(Number(qty.toFixed(4)));
  };

  const setHoldingDaysPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    setPurchaseDate(d.toISOString().split("T")[0]);
  };

  const handleSavePreferencesToHolding = async () => {
    if (!holding || !onUpdateHolding) return;
    setIsSavingMeta(true);
    try {
      await onUpdateHolding(holding.id, {
        purchase_date: purchaseDate || null,
        broker: selectedBroker,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || "Could not save details to holding.");
    } finally {
      setIsSavingMeta(false);
    }
  };

  if (!isOpen || !holding) return null;

  const isStock = holding.instrument_type === "STOCK";
  const holdingDays = purchaseDate
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 366;
  const isLTCG = holdingDays > 365;

  const currentBrokerInfo = brokers.find((b) => b.key === selectedBroker) || brokers[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-emerald-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Brokerage & Tax Estimator
                </h2>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                    isStock
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                      : "bg-sky-50 text-sky-700 border border-sky-200/60"
                  }`}
                >
                  {isStock ? "Stock / ETF" : "Mutual Fund"}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-md">
                Estimating exit charges, capital gains & statutory taxes for <span className="font-semibold text-slate-700">{holding.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40">
          
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/70 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Top Config Grid: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left Controls: Parameters */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs space-y-4">
                
                {/* 1. Broker Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>Trading Broker</span>
                    </label>
                    <span className="text-[10.5px] text-slate-400">Auto-saved</span>
                  </div>
                  <select
                    value={selectedBroker}
                    onChange={(e) => handleBrokerChange(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {brokers.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {currentBrokerInfo?.notes && (
                    <p className="mt-1 text-[10.5px] text-slate-500 leading-tight">
                      {currentBrokerInfo.notes}
                    </p>
                  )}
                </div>

                {/* 2. Quantity Slider & Number */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sell Quantity</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      Total: {totalUnits.toFixed(2)} units
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min={0}
                      max={totalUnits}
                      step="any"
                      value={sellQuantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSellQuantity(isNaN(val) ? 0 : Math.max(0, Math.min(val, totalUnits)));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="Enter units"
                    />
                    <div className="shrink-0 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                      {formatRupee(sellQuantity * currentPrice)}
                    </div>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min={0}
                    max={totalUnits}
                    step={totalUnits / 100 || 0.01}
                    value={sellQuantity}
                    onChange={(e) => setSellQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />

                  {/* Quick percentage pills */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleQuickPercent(pct)}
                        className={`flex-1 py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer ${
                          Math.abs(sellQuantity - (totalUnits * pct) / 100) < 0.01
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                        }`}
                      >
                        {pct === 100 ? "All (100%)" : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Purchase Date / Holding Period */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Acquisition / Buy Date</span>
                    </label>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isLTCG
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      {isLTCG ? "LTCG (> 1 Yr)" : "STCG (≤ 1 Yr)"}
                    </span>
                  </div>

                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>
                      Duration: <strong className="text-slate-800">{holdingDays} days</strong> (~{(holdingDays / 30.4).toFixed(1)} mo)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHoldingDaysPreset(400)}
                        className="text-[10px] text-emerald-700 hover:underline cursor-pointer"
                        title="Set to > 1 year ago"
                      >
                        &gt; 1 yr
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setHoldingDaysPreset(180)}
                        className="text-[10px] text-amber-700 hover:underline cursor-pointer"
                        title="Set to 6 months ago"
                      >
                        &lt; 1 yr
                      </button>
                    </div>
                  </div>

                  {/* Mutual Fund Exit Load Custom Override */}
                  {!isStock && (
                    <div className="mt-3 pt-2 border-t border-dashed border-slate-200">
                      <label className="text-[11px] font-medium text-slate-600 flex items-center justify-between">
                        <span>Exit Load (%)</span>
                        <span className="text-[10px] text-slate-400">
                          {holdingDays >= 365 ? "0% (Nil after 1 yr)" : "Typical: 1.0%"}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={customExitLoad}
                        onChange={(e) => setCustomExitLoad(e.target.value)}
                        placeholder={holdingDays >= 365 ? "0.0" : "1.0"}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden"
                      />
                    </div>
                  )}

                  {/* Save to holding button */}
                  {onUpdateHolding && (
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={handleSavePreferencesToHolding}
                        disabled={isSavingMeta}
                        className="w-full py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100/80 text-[11px] font-semibold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingMeta ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : saveSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span>{saveSuccess ? "Saved to Holding!" : "Remember this buy date & broker"}</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Right Side: Payout & Breakdown Cards */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Hero Net Payout Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white p-5 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Estimated Net Realized Payout</span>
                  </span>
                  {isLoading && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Calculating...</span>
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
                    {formatRupee(estimate?.net_proceeds)}
                  </span>
                  <span className="text-xs text-slate-400">after fees</span>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/50">
                    <span className="block text-[10.5px] text-slate-400">Gross Value</span>
                    <span className="font-semibold text-slate-200">
                      {formatRupee(estimate?.gross_sell_value)}
                    </span>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/50">
                    <span className="block text-[10.5px] text-rose-300">Total Fees</span>
                    <span className="font-semibold text-rose-400">
                      -{formatRupee(estimate?.charges.total_charges)}
                    </span>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-700/50">
                    <span className="block text-[10.5px] text-amber-300">Est. Tax</span>
                    <span className="font-semibold text-amber-400">
                      {estimate?.gain_loss.estimated_tax && estimate.gain_loss.estimated_tax > 0
                        ? `~${formatRupee(estimate.gain_loss.estimated_tax)}`
                        : "₹0 (Exempt)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Charges & Statutory Breakdown */}
              <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-slate-400" />
                    <span>Statutory & Platform Charges Breakdown</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    Total: {formatRupee(estimate?.charges.total_charges)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600 flex items-center gap-1">
                      <span>Brokerage</span>
                      <span className="text-[10px] text-slate-400">({currentBrokerInfo?.name})</span>
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatRupee(estimate?.charges.brokerage)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600 flex items-center gap-1">
                      <span>STT (Securities Transaction Tax)</span>
                      <span className="text-[10px] text-slate-400">
                        {isStock ? "0.1%" : "0.001%"}
                      </span>
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatRupee(estimate?.charges.stt)}
                    </span>
                  </div>

                  {isStock && (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600 flex items-center gap-1">
                          <span>Exchange Turnover Charges (NSE)</span>
                          <span className="text-[10px] text-slate-400">0.00297%</span>
                        </span>
                        <span className="font-medium text-slate-900">
                          {formatRupee(estimate?.charges.exchange_charges)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600 flex items-center gap-1">
                          <span>SEBI Turnover Fee</span>
                          <span className="text-[10px] text-slate-400">₹10 / Crore</span>
                        </span>
                        <span className="font-medium text-slate-900">
                          {formatRupee(estimate?.charges.sebi_fee)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600 flex items-center gap-1">
                          <span>GST</span>
                          <span className="text-[10px] text-slate-400">18% on fees</span>
                        </span>
                        <span className="font-medium text-slate-900">
                          {formatRupee(estimate?.charges.gst)}
                        </span>
                      </div>
                    </>
                  )}

                  {!isStock && estimate?.charges.exit_load !== undefined && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600 flex items-center gap-1">
                        <span>Exit Load (Mutual Fund AMC)</span>
                        <span className="text-[10px] text-slate-400">
                          {holdingDays < 365 ? "~1.0% (< 1 yr)" : "0% (> 1 yr)"}
                        </span>
                      </span>
                      <span className={`font-semibold ${estimate.charges.exit_load > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {formatRupee(estimate?.charges.exit_load)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Capital Gains & Tax Computation Card (Budget 2024) */}
              <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                      Capital Gains Tax (Budget 2024 Rules)
                    </h4>
                  </div>
                  <span
                    className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
                      estimate?.gain_loss.is_long_term
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                        : "bg-amber-50 text-amber-800 border border-amber-200/70"
                    }`}
                  >
                    {estimate?.gain_loss.is_long_term ? "LTCG @ 12.5%" : "STCG @ 20.0%"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[10px] text-slate-500">Invested Basis</span>
                    <span className="font-semibold text-slate-800">
                      {formatRupee(estimate?.gain_loss.invested_cost)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[10px] text-slate-500">Gross Gain / Profit</span>
                    <span
                      className={`font-semibold ${
                        (estimate?.gain_loss.gross_gain || 0) >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {formatRupee(estimate?.gain_loss.gross_gain)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[10px] text-slate-500">Sec 112A Exemption</span>
                    <span className="font-semibold text-emerald-700">
                      {formatRupee(estimate?.gain_loss.ltcg_exemption_applied)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[10px] text-slate-500">Est. Tax Payable</span>
                    <span className="font-bold text-slate-900">
                      {formatRupee(estimate?.gain_loss.estimated_tax)}
                    </span>
                  </div>
                </div>

                {estimate?.gain_loss.effective_tax_rate_pct !== undefined && estimate.gain_loss.effective_tax_rate_pct > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/60 px-3 py-1.5 rounded-xl border border-slate-100">
                    <span>Effective Capital Gains Tax Rate:</span>
                    <strong className="text-slate-900">{estimate.gain_loss.effective_tax_rate_pct.toFixed(2)}%</strong>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Smart Tax-Saving Recommendations & Harvesting Tips */}
          {estimate && estimate.tax_tips && estimate.tax_tips.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                  Smart Tax Optimization & Harvesting Strategies
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {estimate.tax_tips.map((tip, idx) => {
                  const isSuccess = tip.type === "success";
                  const isWarning = tip.type === "warning";
                  const isHarvest = tip.type === "harvest";

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSuccess
                          ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-950"
                          : isWarning
                          ? "bg-amber-50/60 border-amber-200/80 text-amber-950"
                          : isHarvest
                          ? "bg-indigo-50/60 border-indigo-200/80 text-indigo-950"
                          : "bg-slate-50 border-slate-200/80 text-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          {isWarning && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                          {isHarvest && <TrendingDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          {!isSuccess && !isWarning && !isHarvest && <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                          <span>{tip.title}</span>
                        </div>
                        {tip.potential_savings && tip.potential_savings > 0 ? (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white/80 shadow-2xs text-emerald-700 border border-emerald-200/60">
                            Save {formatRupee(tip.potential_savings)}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] leading-relaxed opacity-90">
                        {tip.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Statutory Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200/60 flex items-start gap-2 text-[10.5px] text-slate-500 leading-normal">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              {estimate?.disclaimer ||
                "Estimates are calculated using statutory rates applicable as of Union Budget 2024 (effective July 23, 2024). Depository DP charges (~₹13.50 + GST) may also apply on stock demat transfers. Consult a Chartered Accountant for ITR filings."}
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-white">
          <div className="text-xs text-slate-500">
            Holding: <strong className="text-slate-800">{holding.name}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
