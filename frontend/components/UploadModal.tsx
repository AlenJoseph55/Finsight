"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Smartphone,
  Lock,
  X,
  AlertCircle,
  CheckCircle2,
  LockKeyhole,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { uploadStatement } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PortfolioSummary } from "@/lib/types";

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
  const { user, token, loginWithGoogle, loginWithDevOAuth } = useAuth();

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth gate state (when unauthenticated visitor attempts upload)
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Collapsible CAS Guide in right column
  const [isCasGuideOpen, setIsCasGuideOpen] = useState(false);

  // Post-upload celebration state
  const [successData, setSuccessData] = useState<PortfolioSummary | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const gisContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPassword("");
      setShowPasswordField(false);
      setIsProcessing(false);
      setErrorMessage(null);
      setShowAuthGate(false);
      setSuccessData(null);
    }
  }, [isOpen]);

  // Lazy-load Google GIS script when auth gate is opened
  useEffect(() => {
    if (!showAuthGate) return;

    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      renderGisButton();
      return;
    }

    // Dynamically inject script
    const existingScript = document.getElementById("google-gis-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gis-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderGisButton();
      };
      document.body.appendChild(script);
    } else {
      renderGisButton();
    }
  }, [showAuthGate, googleClientId]);

  const renderGisButton = () => {
    if (
      typeof window !== "undefined" &&
      (window as any).google?.accounts?.id &&
      googleClientId &&
      gisContainerRef.current
    ) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleSuccess,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        gisContainerRef.current.innerHTML = "";
        (window as any).google.accounts.id.renderButton(gisContainerRef.current, {
          theme: "outline",
          size: "large",
          width: 280,
          text: "continue_with",
          shape: "pill",
        });
        setGisLoaded(true);
      } catch (err) {
        console.warn("Could not render GIS button:", err);
      }
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    if (!response || !response.credential) return;
    setIsAuthSubmitting(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle(response.credential);
      setShowAuthGate(false);
      // Auto-trigger the upload immediately with the stashed file!
      executeUpload();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in with Google.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleDevLogin = async () => {
    setIsAuthSubmitting(true);
    setErrorMessage(null);
    try {
      await loginWithDevOAuth("investor@finsight.dev", "Google Investor", "investor");
      setShowAuthGate(false);
      executeUpload();
    } catch (err: any) {
      setErrorMessage(err.message || "Dev authentication failed.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

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

  const executeUpload = async () => {
    if (!selectedFile) return;

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMessage("File size exceeds 15MB limit. Please upload a smaller file.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMsg("Reading your statement securely with AI...");

    try {
      const result = await uploadStatement(selectedFile, password);
      setProgressMsg("Finished! Generating intelligence...");
      await new Promise((r) => setTimeout(r, 400));
      setIsProcessing(false);
      setSuccessData(result);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(
        err.message || "Could not read this file. Please make sure the password is correct."
      );
    }
  };

  const handleUploadClick = () => {
    // If not authenticated and no token, show frictionless Auth Gate
    if (!token && !user) {
      setShowAuthGate(true);
      return;
    }
    executeUpload();
  };

  const handleFinishCelebration = () => {
    onUploadSuccess();
    onClose();
  };

  const formatRupee = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    return "₹" + Math.round(val).toLocaleString("en-IN");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing || isAuthSubmitting}
          className="absolute top-5 right-5 text-slate-500 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-30 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ========================================================================= */}
        {/* VIEW 1: SUCCESS CELEBRATION (Aha! Moment)                                 */}
        {/* ========================================================================= */}
        {successData ? (
          <div className="py-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Extraction Complete</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Portfolio Successfully Analyzed!
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                We parsed your statement and normalized your holdings with 100% deterministic arithmetic.
              </p>
            </div>

            {/* 3 Stat Pills */}
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Holdings
                </div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {successData.holdings?.length ?? 0}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Portfolio Value
                </div>
                <div className="text-lg font-bold text-emerald-700 mt-0.5 truncate">
                  {formatRupee(successData.current_value)}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Sectors
                </div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {successData.sector_allocations?.length ?? 0}
                </div>
              </div>
            </div>

            {/* Finish CTA */}
            <div className="pt-2">
              <button
                onClick={handleFinishCelebration}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all shadow-md cursor-pointer"
              >
                <span>View Full Portfolio Insights</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : showAuthGate ? (
          /* ========================================================================= */
          /* VIEW 2: INLINE AUTH GATE (Deferred Auth on Landing Page)                 */
          /* ========================================================================= */
          <div className="py-6 text-center space-y-6 max-w-md mx-auto animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
              <LockKeyhole className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Your statement is ready to analyze
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Sign in with Google to create your private, encrypted workspace. Your file will be processed immediately.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Google Sign-in Container */}
            <div className="flex flex-col items-center gap-3 pt-1">
              <div ref={gisContainerRef} id="upload-modal-gis-btn" />

              {/* Dev Fallback Button if GIS not configured */}
              {(!gisLoaded || !googleClientId) && (
                <button
                  onClick={handleDevLogin}
                  disabled={isAuthSubmitting}
                  className="w-full max-w-xs flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>
                    {isAuthSubmitting ? "Signing in..." : "Continue with Google (1-Click)"}
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowAuthGate(false)}
                className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer pt-1"
              >
                Back to file upload
              </button>
            </div>

            {/* Privacy note */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
              🔒 Zero passwords stored • Encrypted session • Never shared with brokers
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 3: STANDARD UPLOAD FORM WITH CAS HELPER                             */
          /* ========================================================================= */
          <>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Upload your portfolio
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Add files or screenshots from any broker. New uploads automatically add to your existing portfolio.
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Drop Area + Password + Submit Button */}
              <div className="md:col-span-7 space-y-4">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all ${
                    dragActive
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
                  }`}
                >
                  <input
                    type="file"
                    id="statement-file-upload"
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls"
                    className="hidden"
                    disabled={isProcessing}
                  />

                  <label
                    htmlFor="statement-file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                      <UploadCloud className="w-5 h-5" />
                    </div>

                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs">
                      {selectedFile ? selectedFile.name : "Drop your files here"}
                    </p>
                    <p className="text-xs text-sky-600 font-semibold mt-0.5">
                      {selectedFile ? "Click to pick a different file" : "or click to browse"}
                    </p>

                    <p className="text-[11px] text-slate-500 mt-2 max-w-xs leading-relaxed">
                      Supports PDF, screenshots (PNG, JPG) and Excel/CSV (Max 15MB)
                    </p>
                  </label>
                </div>

                {/* Password Field for Encrypted Statements */}
                {showPasswordField && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <LockKeyhole className="w-3.5 h-3.5 text-slate-500" />
                      <span>Statement Password (if password-protected)</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. your PAN in uppercase (or DOB DDMMYYYY)"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Most CAMS / KFintech statements use your PAN or Date of Birth.
                    </p>
                  </div>
                )}

                {/* Upload Submit Button */}
                {selectedFile && (
                  <button
                    onClick={handleUploadClick}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{isProcessing ? progressMsg : "Process & Import Investments"}</span>
                    {!isProcessing && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Right Column: CAS Retrieval Guide & Formats */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                {/* Collapsible CAS Retrieval Guide */}
                <div className="rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setIsCasGuideOpen(!isCasGuideOpen)}
                    className="w-full p-3.5 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-slate-900">
                        How to get your CAS in 60s
                      </span>
                    </div>
                    {isCasGuideOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {isCasGuideOpen && (
                    <div className="p-3.5 space-y-3 text-xs border-t border-slate-100 bg-white">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 flex items-center justify-between">
                          <span>1. CAMS / MFCentral CAS</span>
                          <a
                            href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-700 hover:underline flex items-center gap-0.5"
                          >
                            <span>Open CAMS</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Request detailed statement with your email and PAN. You will receive an encrypted PDF in 2 mins.
                        </p>
                      </div>

                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <div className="font-semibold text-slate-800">
                          2. Zerodha / Groww / Upstox
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Go to Console &gt; Portfolio &gt; Holdings and click &quot;Export CSV&quot;, or take a screenshot on mobile.
                        </p>
                      </div>

                      <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/70 text-[10.5px] text-amber-900 leading-relaxed">
                        🔒 <strong>Password Hint:</strong> CAMS PDFs are encrypted with the password provided when you generated the CAMS PDF
                      </div>
                    </div>
                  )}
                </div>

                {/* Supported formats list */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                    Supported formats
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-6 h-6 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-slate-700">CAMS &amp; KFintech CAS PDFs</span>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-slate-700">Zerodha, Groww, Upstox CSV/Excel</span>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-6 h-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Smartphone className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-slate-700">Mobile app portfolio screenshots</span>
                    </div>
                  </div>
                </div>

                {/* Privacy Guarantee Card */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-[10.5px] text-emerald-900 leading-relaxed">
                    <strong className="block font-semibold">100% Private to You</strong>
                    No broker logins or credentials needed. Statements are processed securely in real time.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
