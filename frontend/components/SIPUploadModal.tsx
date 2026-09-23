"use client";

import React, { useState } from "react";
import {
  Smartphone,
  FileSpreadsheet,
  FileText,
  Lock,
  X,
  AlertCircle,
} from "lucide-react";
import { uploadSipDocument } from "@/lib/api";
import { SipSummaryResponse } from "@/lib/types";

interface SIPUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (data: SipSummaryResponse) => void;
}

export const SIPUploadModal: React.FC<SIPUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
      if (file.name.toLowerCase().endsWith(".pdf")) {
        setShowPasswordField(true);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
      if (file.name.toLowerCase().endsWith(".pdf")) {
        setShowPasswordField(true);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMsg("Reading your SIP mandates...");

    try {
      const result = await uploadSipDocument(selectedFile, password);
      setProgressMsg("Finished! Updating your SIPs...");
      await new Promise((r) => setTimeout(r, 400));
      setIsProcessing(false);
      onUploadSuccess(result);
      onClose();
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(
        err.message || "Could not read this SIP document. Please check the file and try again."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-5 sm:p-8 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-30 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Add Your SIPs</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Auto-Read
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Upload an app screenshot, statement, or spreadsheet. New uploads automatically add to your active SIPs.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Drop Area */}
          <div className="md:col-span-7 space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
              }`}
            >
              <input
                type="file"
                id="sip-file-upload"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls"
                className="hidden"
                disabled={isProcessing}
              />

              <label
                htmlFor="sip-file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Smartphone className="w-6 h-6" />
                </div>

                <p className="text-sm font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : "Drop your SIP screenshot or document"}
                </p>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                  {selectedFile ? "Click to pick a different file" : "or click to browse"}
                </p>

                <p className="text-[11px] text-slate-400 mt-3 max-w-xs leading-relaxed">
                  Supports screenshots from Groww, Zerodha, Kuvera, or MF Central, plus PDF & Excel
                </p>
              </label>
            </div>

            {showPasswordField && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Document Password (if encrypted)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. your PAN or birthdate"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={isProcessing}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? progressMsg : "Extract & Save SIPs"}
              </button>
            )}
          </div>

          {/* Right Column: Supported types */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5">
                Supported formats
              </h4>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">App Screenshots</p>
                    <p className="text-[11px] text-slate-500">Groww, Zerodha, Kuvera SIP lists</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">CAS / AMC Mandates</p>
                    <p className="text-[11px] text-slate-500">CAMS, KFintech, bank mandate confirmations</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Excel / CSV</p>
                    <p className="text-[11px] text-slate-500">Any downloaded transaction spreadsheet</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
              <Lock className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-[11px] text-emerald-900 leading-relaxed">
                <strong className="block font-semibold mb-0.5">Private & Secure</strong>
                Files are processed securely and never saved or shared with third parties.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
