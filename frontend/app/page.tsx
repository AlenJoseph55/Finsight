"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LandingNavbar } from "@/components/LandingNavbar";
import { LandingHeroPreview } from "@/components/LandingHeroPreview";
import { UploadModal } from "@/components/UploadModal";
import { FinSightLogo } from "@/components/brand/FinSightLogo";
import {
  ArrowRight,
  Play,
  FileText,
  ShieldCheck,
  Zap,
  PieChart,
  BarChart3,
  BookOpen,
  Bell,
  CheckCircle2,
  Lock,
  Trash2,
  Image as ImageIcon,
  Table as TableIcon,
  Quote,
  TrendingUp,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleUploadSuccess = () => {
    // When statement upload completes from the landing page, navigate into the dashboard
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a231f] flex flex-col font-sans selection:bg-[#d1e7dd] selection:text-[#11241c]">
      {/* Editorial Navigation */}
      <LandingNavbar onOpenUpload={() => setIsUploadOpen(true)} />

      <main className="flex-1">
        {/* ========================================================================= */}
        {/* SECTION 1: HERO                                                          */}
        {/* ========================================================================= */}
        <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8">
              {/* Subtle Eyebrow */}
              <div className="inline-block text-[11px] font-bold tracking-[0.2em] uppercase text-[#5a6b62]">
                Your investments. A clearer tomorrow.
              </div>

              {/* Main Display Headline */}
              <h1 className="font-serif-editorial text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#11241c] leading-[1.14]">
                Finally, see your whole portfolio clearly.
              </h1>

              {/* Body */}
              <p className="text-sm sm:text-lg text-[#4a5550] leading-relaxed max-w-xl font-normal">
                Upload your portfolio statements, screenshots or Excel files. FinSight brings all your investments together, shows you what you actually own, and helps you make smarter decisions.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-1">
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-full bg-[#11241c] text-white text-sm font-semibold hover:bg-[#1a382c] transition-all shadow-md shadow-slate-900/10 cursor-pointer group"
                >
                  <span>Analyze My Portfolio Free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <Link
                  href="/dashboard?demo=true"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white hover:bg-[#f1f1ed] text-[#11241c] text-sm font-medium border border-[#e2e2dd] transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-[#11241c] text-white flex items-center justify-center">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </div>
                  <span>Launch Live Demo</span>
                </Link>
              </div>

              {/* 3 Trust Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-[#ecece8]">
                <div className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-[#5a6b62] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-[#11241c]">No account connections</div>
                    <div className="text-[11px] text-[#6b7c72]">Ever.</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#5a6b62] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-[#11241c]">Your data stays private</div>
                    <div className="text-[11px] text-[#6b7c72]">You're in control.</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-[#5a6b62] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-[#11241c]">Stupid simple</div>
                    <div className="text-[11px] text-[#6b7c72]">Upload and go.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Preview Card */}
            <div className="lg:col-span-6 lg:pl-4">
              <LandingHeroPreview />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: SOCIAL PROOF & METRICS                                        */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-20 bg-[#f4f4f1] border-y border-[#ecece8]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#5a6b62] mb-3">
              Trusted by Individual Investors
            </div>
            <h2 className="font-serif-editorial text-2xl sm:text-4xl text-[#11241c] font-normal tracking-tight max-w-3xl mx-auto">
              Used by investors who care about clarity, not complexity.
            </h2>
            <p className="text-sm sm:text-base text-[#4a5550] max-w-2xl mx-auto mt-3">
              From first-time investors to experienced market participants, FinSight helps you understand and monitor your portfolio — without connecting to any financial accounts.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mt-10 sm:mt-12 pt-8 border-t border-[#e2e2dd]">
              <div>
                <div className="font-serif-editorial text-3xl sm:text-4xl font-normal text-[#11241c]">
                  10,000+
                </div>
                <div className="text-xs text-[#5a6b62] font-medium mt-1">Investors on waitlist</div>
              </div>

              <div>
                <div className="font-serif-editorial text-3xl sm:text-4xl font-normal text-[#11241c]">
                  4.8/5
                </div>
                <div className="text-xs text-[#5a6b62] font-medium mt-1">Early user rating</div>
              </div>

              <div>
                <div className="font-serif-editorial text-3xl sm:text-4xl font-normal text-[#11241c]">
                  100%
                </div>
                <div className="text-xs text-[#5a6b62] font-medium mt-1">Document based (no account linking)</div>
              </div>

              <div>
                <div className="font-serif-editorial text-3xl sm:text-4xl font-normal text-[#11241c]">
                  All asset types
                </div>
                <div className="text-xs text-[#5a6b62] font-medium mt-1">Stocks, Mutual Funds, ETFs, Bonds and more</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: INGESTION SHOWCASE ("All your investments in one place")      */}
        {/* ========================================================================= */}
        <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-6 space-y-5">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#5a6b62]">
                Just upload what you have
              </div>
              <h2 className="font-serif-editorial text-3xl sm:text-5xl text-[#11241c] font-normal tracking-tight leading-tight">
                All your investments, in one place.
              </h2>
              <p className="text-sm sm:text-base text-[#4a5550] leading-relaxed">
                Upload PDFs, screenshots or Excel files from any platform. Add your SIPs manually or via screenshots. FinSight extracts the information and gives you a unified view.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#11241c] text-white text-xs font-semibold hover:bg-[#1a382c] transition-all cursor-pointer group shadow-md shrink-0 self-start sm:self-center"
                >
                  <span>Upload My Portfolio</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Handwritten Note with Arrow pointing to button */}
                <div className="flex items-center gap-2.5">
                  <svg
                    className="w-7 h-7 sm:w-8 sm:h-8 text-[#4a5e52] -rotate-6 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  <div className="font-handwriting text-base sm:text-lg text-[#3b4b42] rotate-1 leading-tight">
                    Just upload.
                    <br />
                    No logins. No OTPs.
                    <br />
                    No broker connections.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Floated Ingestion Cards */}
            <div className="lg:col-span-6 relative">
              {/* Cards Grid: 2x2 Layout */}
              <div className="grid grid-cols-2 gap-3.5 sm:gap-4 max-w-lg mx-auto">
                {/* PDF Statement */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">PDF Statement</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">CAMS & KFintech CAS</p>
                </div>

                {/* Screenshots */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Screenshots</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">Zerodha, Groww & more</p>
                </div>

                {/* Excel / CSV */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 transition-transform">
                    <TableIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Excel / CSV</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">Broker holding exports</p>
                </div>

                {/* Active SIPs */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#e5e7eb] hover:border-[#11241c] shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group cursor-pointer" onClick={() => router.push("/dashboard")}>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:bg-[#11241c] group-hover:text-white transition-colors">
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Active SIPs</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1">Groww or Kuvera screenshots</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: 2x2 VALUE GRID ("More than a tracker")                        */}
        {/* ========================================================================= */}
        <section id="features" className="py-20 sm:py-28 bg-[#f4f4f1] border-y border-[#ecece8]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-14">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#5a6b62] mb-3">
                What you get
              </div>
              <h2 className="font-serif-editorial text-3xl sm:text-5xl text-[#11241c] font-normal tracking-tight leading-tight">
                More than a tracker. A smarter way to invest.
              </h2>
              <p className="text-sm sm:text-base text-[#4a5550] mt-3 leading-relaxed">
                FinSight turns your raw statements into meaningful insights, helps you spot risks, and teaches you as you invest.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Card 1 */}
              <div className="bg-white rounded-2xl p-7 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <PieChart className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">True Portfolio View</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  See your actual asset allocation, sector exposure and holdings across all investments normalized against the NSE standard taxonomy.
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-white rounded-2xl p-7 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Risk & Overlap Analysis</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Find hidden mutual fund overlap, concentration risks and get alerts before they become a problem with 100% deterministic arithmetic.
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-white rounded-2xl p-7 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Learn as You Invest</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Simple, easy-to-understand explanations on diversification, asset classes, risk parameters, and portfolio health.
                </p>
              </div>

              {/* Card 4 */}
              <div className="bg-white rounded-2xl p-7 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Agent 3 AI
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Proactive Insights</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Get notified when something important happens to your holdings or sectors — like regulatory banking headwinds or macro rate cuts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: PERSONAS (HIGH-CONTRAST DARK MOUNTAIN SECTION)                */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-[#0b1411] text-white relative overflow-hidden">
          {/* Subtle atmospheric gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1411] via-[#0e1a16] to-[#0b1411] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-2xl mb-14">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-emerald-400 mb-3">
                For every investor
              </div>
              <h2 className="font-serif-editorial text-3xl sm:text-5xl font-normal tracking-tight leading-tight text-slate-100">
                Whether you're just starting or already experienced.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 mt-3">
                FinSight meets you where you are, and grows with you.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Column: New to investing */}
              <div className="lg:col-span-4 space-y-4">
                <h3 className="text-lg font-bold text-emerald-400">New to investing?</h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Understand the basics in simple terms</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>See if your portfolio is well diversified</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Learn through your own investments</span>
                  </li>
                </ul>
              </div>

              {/* Middle Column: Experienced investor */}
              <div className="lg:col-span-4 space-y-4">
                <h3 className="text-lg font-bold text-emerald-400">Experienced investor?</h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Deep portfolio analytics & NSE 15-sector mapping</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Track investment theses across multiple brokers</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Monitor concentration risks and market events</span>
                  </li>
                </ul>
              </div>

              {/* Right Column: Early User Quote Card */}
              <div className="lg:col-span-4 bg-[#14231d] rounded-2xl p-6 border border-[#20392e] relative">
                <Quote className="w-8 h-8 text-emerald-500/30 mb-2" />
                <p className="font-serif-editorial text-base sm:text-lg italic text-slate-200 leading-relaxed">
                  “FinSight made it so easy for me to understand my portfolio. I finally know what I actually own.”
                </p>
                <div className="text-xs font-semibold text-emerald-400 mt-4">— Early User</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: PRIVACY BY DESIGN (SIMPLE, TRUST-BUILDING LANGUAGE)           */}
        {/* ========================================================================= */}
        <section id="privacy" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Header */}
            <div className="lg:col-span-5 space-y-4">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#5a6b62]">
                Privacy by Design
              </div>
              <h2 className="font-serif-editorial text-3xl sm:text-5xl text-[#11241c] font-normal tracking-tight leading-tight">
                Your data. Your control.
              </h2>
              <p className="text-sm sm:text-base text-[#4a5550] leading-relaxed">
                FinSight never connects to your broker, bank or investment accounts. You choose what to upload, and we only use it to give you insights.
              </p>
              <div className="pt-2">
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#11241c] underline underline-offset-4 hover:text-emerald-800"
                >
                  <span>More about our privacy</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right 4 Simple Pillars */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Pillar 1 */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-[#f0f4f2] text-[#11241c] flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">No account connections</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No broker logins, no OTPs, no third-party financial permissions.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-[#f0f4f2] text-[#11241c] flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">You control what you share</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Upload only what you're comfortable with. No PAN or bank linking.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-[#f0f4f2] text-[#11241c] flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Secure processing</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your data is processed securely and never sold or shared with third parties.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-[#f0f4f2] text-[#11241c] flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Delete anytime</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You can wipe your portfolio and data whenever you want in one click.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: BOTTOM CALL TO ACTION                                         */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-[#f4f4f1] border-t border-[#ecece8] text-center relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#5a6b62] mb-3">
              A clearer financial tomorrow
            </div>
            <h2 className="font-serif-editorial text-3xl sm:text-5xl text-[#11241c] font-normal tracking-tight leading-tight mb-4">
              Ready to take control of your investments?
            </h2>
            <p className="text-sm sm:text-base text-[#4a5550] max-w-xl mx-auto mb-8">
              Join thousands of investors who are getting a clearer picture with FinSight.
            </p>

            <div className="inline-flex flex-col items-center relative">
              {/* Handwritten Note with Arrow */}
              <div className="hidden sm:block absolute -right-48 -top-3">
                <div className="font-handwriting text-xl text-[#3b4b42] rotate-6">
                  It starts with
                  <br />
                  what you already have.
                </div>
                <svg className="w-8 h-8 text-[#5a6b62] rotate-45 mt-1 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>

              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-[#11241c] text-white text-sm font-semibold hover:bg-[#1a382c] transition-all shadow-lg shadow-slate-900/10 cursor-pointer group"
              >
                <span>Analyze My Portfolio Free</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <span className="text-xs text-[#6b7c72] mt-3">
                No credit card required • No broker logins
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* SECTION 8: INSTITUTIONAL FOOTER                                           */}
      {/* ========================================================================= */}
      <footer id="faq" className="border-t border-[#ecece8] bg-[#fbfbfa] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 text-center md:text-left">
          {/* Brand Logo & Tagline */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
              <FinSightLogo variant="full" height={26} />
            </Link>
            <span className="text-xs text-[#6b7c72] hidden sm:inline">•</span>
            <span className="text-xs text-[#6b7c72]">Understand. Invest. Grow.</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-xs text-[#4a5550]">
            <a href="#features" className="hover:text-[#11241c] transition-colors">Product</a>
            <Link href="/dashboard" className="hover:text-[#11241c] transition-colors">Terminal</Link>
            <a href="#privacy" className="hover:text-[#11241c] transition-colors">Privacy</a>
            <a href="#how-it-works" className="hover:text-[#11241c] transition-colors">How it works</a>
            <a href="mailto:support@finsight.ai" className="hover:text-[#11241c] transition-colors">Contact</a>
          </div>

          {/* Copyright */}
          <div className="text-xs text-[#7d8c83]">
            © {new Date().getFullYear()} FinSight. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Live Upload Modal Embedded for instant ingestion */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
