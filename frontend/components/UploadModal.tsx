"use client";

import React, { useState } from "react";
import { UploadCloud, FileText, Image, CheckCircle, AlertCircle, X, Shield } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSimulateUpload = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    try {
      setProgressMsg("Applying AES-256 in-memory privacy filter...");
      await new Promise((r) => setTimeout(r, 600));

      setProgressMsg("Agent 1 (Portfolio Intelligence): Extracting holdings...");
      await new Promise((r) => setTimeout(r, 800));

      setProgressMsg("Running Deterministic Financial Math Engine...");
      await new Promise((r) => setTimeout(r, 600));

      setProgressMsg("Extraction & Verification Complete!");
      await new Promise((r) => setTimeout(r, 400));

      setIsProcessing(false);
      onUploadSuccess();
      onClose();
    } catch (err) {
      setIsProcessing(false);
      alert("Error processing statement.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0d1320] border border-[#22314d] shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Import Investments</h3>
            <p className="text-xs text-slate-400">
              Upload statement PDF, screenshot, or spreadsheet
            </p>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="my-4 p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-400 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-white">Privacy Guarantee:</strong> Raw statement files are processed in memory and never permanently stored. Only extracted structured holdings are saved using AES-256 encryption.
          </p>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? "border-indigo-500 bg-indigo-950/20"
              : "border-[#202b40] bg-[#090d16] hover:border-[#2f3e5c]"
          }`}
        >
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="hidden"
          />

          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="flex justify-center gap-3 mb-3 text-slate-400">
              <FileText className="w-6 h-6 text-indigo-400" />
              <Image className="w-6 h-6 text-emerald-400" />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose another
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Drop your statement here, or{" "}
                  <span className="text-indigo-400 font-semibold underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports CAMS/KFintech CAS PDFs, Zerodha/Groww screenshots, or Excel
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Processing status */}
        {isProcessing && (
          <div className="mt-4 p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-indigo-200 font-medium">{progressMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSimulateUpload}
            disabled={!selectedFile || isProcessing}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white shadow-lg shadow-emerald-500/10 transition-all disabled:opacity-50 cursor-pointer"
          >
            Extract & Analyze
          </button>
        </div>
      </div>
    </div>
  );
};
