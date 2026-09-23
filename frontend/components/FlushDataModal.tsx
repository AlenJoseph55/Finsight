"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface FlushDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  holdingCount: number;
}

export const FlushDataModal: React.FC<FlushDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  holdingCount,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFlush = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to flush investment records.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-rose-100 shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Warning Accent */}
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-rose-600 to-red-600 shrink-0" />

        <div className="p-5 sm:p-6 overflow-y-auto">
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                Flush All Investment Data?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will permanently remove your portfolio, all{" "}
                <span className="font-bold text-slate-700">{holdingCount} holdings</span>, statements,
                and look-through sector analytics.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 text-xs text-rose-800 space-y-1.5 mb-6">
            <p className="font-semibold">⚠️ Irreversible Action</p>
            <p className="text-[11px] text-rose-700 leading-normal">
              Your investment workspace will be reset to a completely clean slate. You will be able to upload fresh statements or start over.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-2.5 rounded-lg bg-red-100 text-red-800 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFlush}
              disabled={isDeleting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? "Flushing..." : "Yes, Flush Everything"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
