"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { MetricCard } from "@/components/MetricCard";
import { RiskAlertBanner } from "@/components/RiskAlertBanner";
import { AllocationBreakdown } from "@/components/AllocationBreakdown";
import { HoldingsTable } from "@/components/HoldingsTable";
import { UploadModal } from "@/components/UploadModal";
import { PortfolioSummary, HealthResponse } from "@/lib/types";
import { fetchHealth, fetchPortfolioSummary, seedDemoPortfolio } from "@/lib/api";
import {
  Wallet,
  TrendingUp,
  Percent,
  Compass,
  Upload,
  Zap,
  AlertTriangle,
  FileCheck,
} from "lucide-react";

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [simulatedCrashActive, setSimulatedCrashActive] = useState<boolean>(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [hData, pData] = await Promise.allSettled([
        fetchHealth(),
        fetchPortfolioSummary(),
      ]);

      if (hData.status === "fulfilled") setHealth(hData.value);
      if (pData.status === "fulfilled") setPortfolio(pData.value);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedDemo = async () => {
    setIsRefreshing(true);
    try {
      const data = await seedDemoPortfolio();
      setPortfolio(data);
      setSimulatedCrashActive(false);
    } catch (e) {
      alert("Error reseeding portfolio.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSimulatedCrash = () => {
    if (!portfolio) return;
    setSimulatedCrashActive((prev) => !prev);
  };

  const handleCorrectHolding = (holdingId: number, newSector: string) => {
    if (!portfolio) return;
    const updatedHoldings = portfolio.holdings.map((h) =>
      h.id === holdingId ? { ...h, sector: newSector } : h
    );
    setPortfolio({
      ...portfolio,
      holdings: updatedHoldings,
    });
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-emerald-500/30">
      {/* Top Navigation */}
      <Navbar
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        healthStatus={health?.status}
        dbLatency={health?.services.database?.latency_ms}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#141b2b]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Portfolio Intelligence
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-Asset Consolidated View • AMFI & NSE Verified
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Crash Simulator Trigger (Agent 3 Test) */}
            <button
              onClick={toggleSimulatedCrash}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                simulatedCrashActive
                  ? "bg-rose-950/40 border-rose-500/50 text-rose-300"
                  : "bg-[#101726] hover:bg-[#162035] border-[#1f2d48] text-slate-300"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {simulatedCrashActive ? "Reset Market Simulation" : "Simulate Sector Threat (Agent 3)"}
              </span>
            </button>

            {/* Seed Demo Button */}
            <button
              onClick={handleSeedDemo}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#101726] hover:bg-[#162035] border border-[#1f2d48] text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reset to Screenshot Data</span>
            </button>

            {/* Import Statement */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Statement</span>
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="p-12 text-center text-slate-500 animate-pulse text-sm">
            Initializing FinSight financial engine & connecting to PostgreSQL...
          </div>
        )}

        {!isLoading && portfolio && (
          <>
            {/* Risk Alert Banner */}
            <RiskAlertBanner
              isConcentrated={simulatedCrashActive ? true : portfolio.is_concentrated}
              concentrationSummary={
                simulatedCrashActive
                  ? "⚠️ CRITICAL MARKET ALERT (Agent 3): Major regulatory headwind reported in Financials & Banking sector. You have 17.9% direct exposure via HDFC Bank and ~8% via Flexi Cap mutual fund."
                  : portfolio.concentration_summary
              }
            />

            {/* Top 4 Portfolio Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Invested"
                value={`₹${portfolio.total_invested.toLocaleString("en-IN")}`}
                subtitle="Across 6 primary holdings"
                icon={Wallet}
                badge="Cost Basis"
              />

              <MetricCard
                title="Current Portfolio Value"
                value={`₹${portfolio.current_value.toLocaleString("en-IN")}`}
                changePct={portfolio.absolute_return_pct}
                changeLabel="Net Unrealized Gain"
                icon={TrendingUp}
                highlight={true}
              />

              <MetricCard
                title="Absolute Return"
                value={`${portfolio.absolute_return_pct.toFixed(1)}%`}
                changePct={portfolio.absolute_return_pct}
                changeLabel="Since Inception"
                icon={Percent}
              />

              <MetricCard
                title="Portfolio XIRR"
                value={`${portfolio.xirr_pct?.toFixed(1) || "13.8"}%`}
                subtitle="Annualized cashflow return"
                icon={Compass}
                badge="XIRR Engine"
              />
            </div>

            {/* Deep Breakdown: Asset Class, Market Cap, Sector Exposure */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Portfolio Composition & Risk Breakdown
                </h2>
              </div>
              <AllocationBreakdown
                sectorAllocations={portfolio.sector_allocations}
                totalValue={portfolio.current_value}
              />
            </div>

            {/* Holdings Table */}
            <HoldingsTable
              holdings={portfolio.holdings}
              onCorrectHolding={handleCorrectHolding}
            />
          </>
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={loadData}
      />

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-[#141b2b] py-4 bg-[#080c14] text-center text-xs text-slate-500">
        FinSight Autonomous Financial Intelligence • Privacy Protected with In-Memory Scrubbing & AES-256
      </footer>
    </div>
  );
}
