"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loginWithGoogle, loginWithDevOAuth, loginDemo, environment, isDemoAllowed } = useAuth();

  const [devEmail, setDevEmail] = useState("investor@finsight.dev");
  const [devName, setDevName] = useState("Dev Investor");
  const [devRole, setDevRole] = useState("investor");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState("Signing in...");
  const [showDevDetails, setShowDevDetails] = useState(false);

  const [gisLoaded, setGisLoaded] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // If already authenticated and not demo, or user wants to proceed to dashboard
  useEffect(() => {
    if (user && !user.is_demo) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Handle Google OAuth callback from GIS
  const handleGoogleCallback = async (response: any) => {
    if (!response || !response.credential) {
      setErrorMessage("Google Sign-In returned an invalid credential.");
      return;
    }
    setIsSubmitting(true);
    setSubmittingStatus("Verifying Google account...");
    setErrorMessage(null);
    try {
      await loginWithGoogle(response.credential);
      setSubmittingStatus("Preparing your portfolio dashboard...");
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate with Google");
      setIsSubmitting(false);
    }
  };

  const initGoogleGIS = () => {
    if (typeof window !== "undefined" && window.google && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const btnContainer = document.getElementById("googleBtn");
        if (btnContainer) {
          btnContainer.innerHTML = "";
          window.google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            shape: "pill",
          });
          setGisLoaded(true);
        }
      } catch (e) {
        console.warn("GIS initialization deferred:", e);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.google) {
      initGoogleGIS();
    }
  }, [googleClientId]);

  const handleGoogleDevLogin = async () => {
    if (!isDemoAllowed) {
      setErrorMessage(
        "Google OAuth Client ID is required in production mode. Please configure NEXT_PUBLIC_GOOGLE_CLIENT_ID."
      );
      return;
    }
    setIsSubmitting(true);
    setSubmittingStatus("Signing in with Dev Google simulator...");
    setErrorMessage(null);
    try {
      await loginWithDevOAuth("investor@gmail.com", "Google Investor", "investor");
      setSubmittingStatus("Preparing your portfolio dashboard...");
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate with Google Dev OAuth");
      setIsSubmitting(false);
    }
  };

  const handleDevOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmittingStatus("Issuing dev token and signing in...");
    setErrorMessage(null);
    try {
      await loginWithDevOAuth(devEmail, devName, devRole);
      setSubmittingStatus("Preparing your portfolio dashboard...");
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Dev OAuth login failed");
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsSubmitting(true);
    setSubmittingStatus("Loading demo investor session...");
    setErrorMessage(null);
    try {
      await loginDemo("demo.investor@finsight.dev");
      setSubmittingStatus("Entering demo workspace...");
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to activate Demo Account");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleGIS}
      />

      {/* Navigation / Back */}
      <header className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <FinSightLogo variant="full" height={32} className="h-7 sm:h-8 w-auto" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 sm:p-9 relative overflow-hidden">
            {/* Top decorative accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

            {/* Loading Overlay when Submitting or Redirecting */}
            {(isSubmitting || (user && !user.is_demo && !errorMessage)) && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-4 shadow-2xs">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  {user && !user.is_demo ? `Welcome back, ${user.display_name}!` : submittingStatus}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  {user && !user.is_demo
                    ? "Taking you straight to your portfolio dashboard..."
                    : "Securing your session with zero-knowledge token authentication."}
                </p>
              </div>
            )}

            {/* Title & Tagline */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center mb-3">
                <FinSightLogo variant="mark" height={44} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Sign In to FinSight
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
                Access your private financial intelligence workspace with zero password storage.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Authentication Error</p>
                  <p className="mt-0.5 opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Primary OAuth Method: Google */}
            <div className="space-y-4">
              {/* GIS Container for Google Sign In Button */}
              {googleClientId && (
                <div className="space-y-1.5">
                  <div className="flex justify-center" id="googleBtn" />
                  {isDemoAllowed && (
                    <p className="text-[10px] text-center text-slate-400">
                      Requires active Google Cloud Client ID. Or use instant dev login below ↓
                    </p>
                  )}
                </div>
              )}

              {/* Fallback button if GIS button is not active */}
              {(!gisLoaded || !googleClientId) && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGoogleDevLogin}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-xs transition-all cursor-pointer hover:border-slate-300 disabled:opacity-50"
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
                    {isSubmitting
                      ? "Signing in..."
                      : isDemoAllowed
                      ? "Continue with Google (Instant Dev Login)"
                      : "Continue with Google"}
                  </span>
                </button>
              )}

              {/* Development Mode Tools (Only shown in local dev testing) */}
              {isDemoAllowed && (
                <div className="pt-2">
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-200/60 text-amber-800">
                        Development Mode
                      </span>
                      <span className="text-[11px] text-amber-700">Environment: {environment}</span>
                    </div>
                    <p className="text-xs text-amber-800/90 leading-relaxed mb-3">
                      Demo accounts and Dev OAuth simulators are active for seamless local testing without Google Cloud setup.
                    </p>

                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleGoogleDevLogin}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                        <span>Sign In as Google Investor (Instant Dev OAuth)</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleDemoLogin}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Continue as Demo Investor (Instant)</span>
                      </button>
                    </div>

                    <div className="mt-3 text-center">
                      <button
                        type="button"
                        onClick={() => setShowDevDetails(!showDevDetails)}
                        className="text-[11px] text-amber-800 hover:text-amber-900 underline font-medium cursor-pointer"
                      >
                        {showDevDetails ? "Hide Dev OAuth Simulator" : "Or simulate custom OAuth user →"}
                      </button>
                    </div>

                    {/* Collapsible Dev OAuth Simulator Form */}
                    {showDevDetails && (
                      <form onSubmit={handleDevOAuthSubmit} className="mt-3 pt-3 border-t border-amber-200 space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
                            Simulated Email
                          </label>
                          <input
                            type="email"
                            required
                            value={devEmail}
                            onChange={(e) => setDevEmail(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded bg-white border border-amber-300 text-slate-900 focus:outline-emerald-600"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
                              Display Name
                            </label>
                            <input
                              type="text"
                              value={devName}
                              onChange={(e) => setDevName(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded bg-white border border-amber-300 text-slate-900 focus:outline-emerald-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
                              Role
                            </label>
                            <select
                              value={devRole}
                              onChange={(e) => setDevRole(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded bg-white border border-amber-300 text-slate-900 focus:outline-emerald-600"
                            >
                              <option value="investor">Investor</option>
                            </select>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full mt-2 py-2 px-3 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? "Generating Token..." : "Issue Simulated Token & Login"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Architecture Assurances */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
                FinSight Privacy Architecture
              </p>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>No password databases to breach</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Pseudonymous SHA-256 identifiers only</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>256-bit AES encryption on uploaded data</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400">
        FinSight Terminal • DPDP &amp; GDPR Compliant by Design • Zero Credential Storage
      </footer>
    </div>
  );
}
