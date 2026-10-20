"use client";

import React, { useState } from "react";
import { Holding, UpdateHoldingPayload } from "@/lib/types";
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  PieChart,
  Check,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Calculator,
} from "lucide-react";
import { EditHoldingModal } from "./EditHoldingModal";
import { SellEstimatorModal } from "./SellEstimatorModal";

interface HoldingsTableProps {
  holdings: Holding[];
  totalValue: number;
  isLoading?: boolean;
  onCorrectHolding?: (holdingId: number, newSector: string) => void;
  onUpdateHolding?: (holdingId: number, payload: UpdateHoldingPayload) => Promise<void>;
  onDeleteHolding?: (holdingId: number) => Promise<void>;
  onFlushData?: () => void;
  onOpenUpload?: () => void;
}

const COMMON_SECTORS = [
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

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  totalValue,
  isLoading,
  onCorrectHolding,
  onUpdateHolding,
  onDeleteHolding,
  onFlushData,
  onOpenUpload,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedSector, setEditedSector] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [estimatingHolding, setEstimatingHolding] = useState<Holding | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 8;

  // Loading skeleton state while fetching
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-2">
            <div className="h-5 bg-slate-200 rounded w-36" />
            <div className="h-3.5 bg-slate-100 rounded w-56" />
          </div>
          <div className="h-9 bg-slate-100 rounded-xl w-48" />
        </div>
        {/* Table skeleton rows */}
        <div className="mt-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3.5 px-3 rounded-xl bg-slate-50/60 border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-36" />
                  <div className="h-3 bg-slate-100 rounded w-20" />
                </div>
              </div>
              <div className="hidden sm:block space-y-1.5">
                <div className="h-3.5 bg-slate-200 rounded w-24" />
                <div className="h-3 bg-slate-100 rounded w-16" />
              </div>
              <div className="space-y-1.5 text-right">
                <div className="h-4 bg-slate-200 rounded w-20 ml-auto" />
                <div className="h-3 bg-slate-100 rounded w-14 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state if no holdings at all
  if (holdings.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50/80 border border-emerald-100/80 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
          <PieChart className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1.5">No investments tracked yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          Upload your CAMS/KFintech Consolidated Account Statement (CAS) or brokerage contract note to view live portfolio analytics, sector look-through, and risk health.
        </p>
        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Statement</span>
          </button>
        )}
      </div>
    );
  }

  // Filter holdings
  const filteredHoldings = holdings.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.sector.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedType === "ALL") return true;
    if (selectedType === "STOCK") return h.instrument_type === "STOCK";
    if (selectedType === "MUTUAL_FUND") return h.instrument_type === "MUTUAL_FUND";
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredHoldings.length / itemsPerPage) || 1;
  const paginatedHoldings = filteredHoldings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

  const handleConfirmDelete = async () => {
    if (!deletingHolding || !onDeleteHolding) return;
    setIsDeleting(true);
    try {
      await onDeleteHolding(deletingHolding.id);
      setDeletingHolding(null);
    } catch (err) {
      console.error("Failed to delete holding:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRupee = (val: number) =>
    "₹" + Math.round(val).toLocaleString("en-IN");

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
      {/* Header with Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Your Holdings</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {holdings.length} investments · {formatRupee(totalValue)}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 sm:flex-initial min-w-[130px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search holdings..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-48"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All types</option>
            <option value="STOCK">Stocks</option>
            <option value="MUTUAL_FUND">Mutual Funds</option>
          </select>

          {/* Flush Data Button */}
          {onFlushData && holdings.length > 0 && (
            <button
              onClick={onFlushData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 bg-rose-50/50 hover:bg-rose-100/70 text-rose-700 text-xs font-medium shadow-xs transition-colors cursor-pointer"
              title="Flush all investment records and reset portfolio"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Flush Data</span>
            </button>
          )}

          {/* Add / Import Button */}
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Investment</span>
            </button>
          )}
        </div>
      </div>

      {/* Holdings Table (Desktop / Large Screens: >= lg) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500 text-[11px] font-semibold border-b border-slate-200/80">
              <th className="py-3 pr-4">Name</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Sector</th>
              <th className="py-3 px-3 text-right">Invested</th>
              <th className="py-3 px-3 text-right">Current Value</th>
              <th className="py-3 px-3 text-right">Gain / Loss</th>
              <th className="py-3 px-3 text-right">Weight</th>
              <th className="py-3 pl-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedHoldings.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No investments found matching your search.
                </td>
              </tr>
            ) : (
              paginatedHoldings.map((h) => {
                const gainAmount = h.current_value - h.invested_amount;
                const gainPct =
                  h.invested_amount > 0 ? (gainAmount / h.invested_amount) * 100 : 0;
                const isPositive = gainPct >= 0;
                const weightPct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0;
                const isStock = h.instrument_type === "STOCK";

                return (
                  <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-900 max-w-[220px] truncate">
                        {h.name}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium ${
                          isStock
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {isStock ? "Stock" : "Mutual Fund"}
                      </span>
                    </td>

                    {/* Sector */}
                    <td className="py-3.5 px-3">
                      {editingId === h.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editedSector}
                            onChange={(e) => setEditedSector(e.target.value)}
                            className="bg-white border border-emerald-400 rounded px-1.5 py-0.5 text-xs text-slate-800"
                          >
                            {COMMON_SECTORS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveEdit(h.id)}
                            className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            title="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleStartEdit(h)}
                          className="group inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                          title="Click to quick-change sector"
                        >
                          <span className="truncate max-w-[130px]">{h.sector}</span>
                          <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-slate-500" />
                        </div>
                      )}
                    </td>

                    {/* Invested */}
                    <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                      {formatRupee(h.invested_amount)}
                    </td>

                    {/* Current Value */}
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                      {formatRupee(h.current_value)}
                    </td>

                    {/* Gain / Loss */}
                    <td className="py-3.5 px-3 text-right">
                      <span
                        className={`inline-block font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                          isPositive
                            ? "text-emerald-700 bg-emerald-50"
                            : "text-rose-700 bg-rose-50"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {gainPct.toFixed(1)}%
                      </span>
                    </td>

                    {/* Weight */}
                    <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                      {weightPct.toFixed(1)}%
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pl-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setEstimatingHolding(h)}
                          className="px-2 py-1 rounded-lg text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/60 transition-colors flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer"
                          title="Calculate exit charges & capital gains tax"
                        >
                          <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sell & Tax</span>
                        </button>
                        <button
                          onClick={() => setEditingHolding(h)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Edit holding details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingHolding(h)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove holding"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile & Tablet Dual-Row Card Layout (< lg) */}
      <div className="block lg:hidden divide-y divide-slate-100">
        {paginatedHoldings.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No investments found matching your search.
          </div>
        ) : (
          paginatedHoldings.map((h) => {
            const gainAmount = h.current_value - h.invested_amount;
            const gainPct =
              h.invested_amount > 0 ? (gainAmount / h.invested_amount) * 100 : 0;
            const isPositive = gainPct >= 0;
            const weightPct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0;
            const isStock = h.instrument_type === "STOCK";

            return (
              <div key={`mob-${h.id}`} className="py-3.5 space-y-2">
                {/* Row 1: Name, Type Badge, and Quick Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 text-sm truncate">
                      {h.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium ${
                          isStock
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {isStock ? "Stock" : "Mutual Fund"}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {h.sector}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setEstimatingHolding(h)}
                      className="p-1.5 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 transition-colors"
                      title="Sell & Tax Estimator"
                    >
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                    <button
                      onClick={() => setEditingHolding(h)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Edit holding details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingHolding(h)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove holding"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Value, Invested, Gain %, and Weight */}
                <div className="flex items-center justify-between text-xs pt-0.5 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10.5px] text-slate-500 block">Current Value</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatRupee(h.current_value)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Invested: {formatRupee(h.invested_amount)}
                    </span>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span
                      className={`inline-block font-semibold px-2 py-0.5 rounded text-[11px] ${
                        isPositive
                          ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
                          : "text-rose-700 bg-rose-50 border border-rose-200/60"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {gainPct.toFixed(1)}%
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      Weight: {weightPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredHoldings.length)} of{" "}
            {filteredHoldings.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 sm:w-6 sm:h-6 rounded text-xs font-medium transition-colors ${
                  currentPage === page
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Holding Modal */}
      <EditHoldingModal
        isOpen={!!editingHolding}
        onClose={() => setEditingHolding(null)}
        holding={editingHolding}
        onSave={async (id, payload) => {
          if (onUpdateHolding) {
            await onUpdateHolding(id, payload);
          }
          setEditingHolding(null);
        }}
      />

      {/* Sell Cost & Tax Estimator Modal */}
      <SellEstimatorModal
        isOpen={!!estimatingHolding}
        onClose={() => setEstimatingHolding(null)}
        holding={estimatingHolding}
        onUpdateHolding={onUpdateHolding}
      />

      {/* Delete Holding Confirmation Dialog */}
      {deletingHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Remove Investment</h4>
                <p className="text-xs text-slate-500 truncate max-w-[220px]">
                  {deletingHolding.name}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to remove this holding? Your total portfolio value and sector allocations will be automatically recalculated.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingHolding(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? "Removing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
