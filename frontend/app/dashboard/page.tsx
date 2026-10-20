"use client";

import React, { useCallback, useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MetricCard } from "@/components/MetricCard";
import { RiskAlertBanner } from "@/components/RiskAlertBanner";
import { AllocationBreakdown } from "@/components/AllocationBreakdown";
import { HoldingsTable } from "@/components/HoldingsTable";
import { UploadModal } from "@/components/UploadModal";
import { SIPUploadModal } from "@/components/SIPUploadModal";
import { SIPDashboard } from "@/components/SIPDashboard";
import { ChatPanel } from "@/components/ChatPanel";
import { AlertsDrawer } from "@/components/AlertsDrawer";
import { AlertToast } from "@/components/AlertToast";
import { FlushDataModal } from "@/components/FlushDataModal";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { DEMO_PORTFOLIO_DATA, DEMO_SIP_DATA, DEMO_ALERTS } from "@/lib/demoData";
import { useAlertsSocket } from "@/hooks/useAlertsSocket";
import { useAuth } from "@/lib/auth";
import {
  PortfolioSummary,
  HealthResponse,
  SipSummaryResponse,
  AlertItem,
  SimulateEventPayload,
  UpdateHoldingPayload,
} from "@/lib/types";
import {
  fetchHealth,
  fetchPortfolioSummary,
  refreshPortfolioPrices,
  fetchSipSummary,
  fetchAlerts,
  scanAlerts,
  markAlertRead,
  markAllAlertsRead,
  simulateMarketEvent,
  updateHolding,
  deleteHolding,
  flushInvestmentData,
} from "@/lib/api";
import {
  Wallet,
  Repeat,
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
  Landmark,
  TrendingUp,
  Zap,
} from "lucide-react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"portfolio" | "sip">("portfolio");
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [sipData, setSipData] = useState<SipSummaryResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDemoSandbox, setIsDemoSandbox] = useState<boolean>(false);

  // Modals & Drawers state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isSipUploadOpen, setIsSipUploadOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isFlushModalOpen, setIsFlushModalOpen] = useState<boolean>(false);

  // Alerts & Notifications state
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0);
  const [isScanningAlerts, setIsScanningAlerts] = useState<boolean>(false);
  const [toastQueue, setToastQueue] = useState<AlertItem[]>([]);

  // Bell pulse: set to true briefly when a new WS alert arrives
  const [bellPulse, setBellPulse] = useState<boolean>(false);
  const hasAutoOpenedAlerts = useRef<boolean>(false);

  // Check URL param ?demo=true
  useEffect(() => {
    if (searchParams.get("demo") === "true") {
      enterDemoSandbox();
    }
  }, [searchParams]);

  const enterDemoSandbox = () => {
    setIsDemoSandbox(true);
    setPortfolio(DEMO_PORTFOLIO_DATA);
    setSipData(DEMO_SIP_DATA);
    setAlerts(DEMO_ALERTS);
    const unread = DEMO_ALERTS.filter((a) => !a.is_read).length;
    setUnreadAlertsCount(unread);
    if (unread > 0 && !hasAutoOpenedAlerts.current) {
      hasAutoOpenedAlerts.current = true;
      setTimeout(() => {
        setIsAlertsOpen(true);
      }, 1500);
    }
  };

  const exitDemoSandbox = () => {
    setIsDemoSandbox(false);
    setPortfolio(null);
    setSipData(null);
    setAlerts([]);
    setUnreadAlertsCount(0);
    loadData();
  };

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [hData, pData, sData, aData] = await Promise.allSettled([
        fetchHealth(),
        fetchPortfolioSummary(),
        fetchSipSummary(),
        fetchAlerts(),
      ]);

      if (hData.status === "fulfilled") setHealth(hData.value);
      if (pData.status === "fulfilled") setPortfolio(pData.value);
      if (aData.status === "fulfilled") {
        setAlerts(aData.value.alerts);
        setUnreadAlertsCount(aData.value.unread_count);
        if (aData.value.unread_count > 0 && !hasAutoOpenedAlerts.current) {
          hasAutoOpenedAlerts.current = true;
          setTimeout(() => {
            setIsAlertsOpen(true);
          }, 1500);
        }
      }
      if (sData.status === "fulfilled") {
        setSipData(sData.value);
      } else {
        // Do NOT auto-seed demo SIPs; keep clean state for new user
        setSipData(null);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // —— Real-time alert handler (called by WebSocket hook) ——
  const handleNewSocketAlert = useCallback((newAlert: AlertItem) => {
    // Prepend to alert list & bump unread count only if not duplicate
    setAlerts((prev) => {
      if (prev.some((a) => a.id === newAlert.id)) return prev;
      return [newAlert, ...prev];
    });
    setUnreadAlertsCount((prev) => prev + 1);
    // Push into toast queue (shows slide-in notification) without duplicate ID
    setToastQueue((prev) => {
      if (prev.some((a) => a.id === newAlert.id)) return prev;
      return [...prev, newAlert];
    });
    // Pulse the bell for 2 seconds
    setBellPulse(true);
    setTimeout(() => setBellPulse(false), 2000);
  }, []);

  // —— WebSocket real-time connection ——
  useAlertsSocket({ userId: user?.id || 1, onNewAlert: handleNewSocketAlert });

  useEffect(() => {
    loadData();
  }, []);


  const handleRefreshLivePrices = async () => {
    setIsRefreshing(true);
    try {
      const data = await refreshPortfolioPrices();
      setPortfolio(data);
      const [sData, aData] = await Promise.allSettled([fetchSipSummary(), fetchAlerts()]);
      if (sData.status === "fulfilled") setSipData(sData.value);
      if (aData.status === "fulfilled") {
        setAlerts(aData.value.alerts);
        setUnreadAlertsCount(aData.value.unread_count);
      }
    } catch (err) {
      console.error("Refresh live prices failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleScanAlerts = async () => {
    setIsScanningAlerts(true);
    try {
      const scanRes = await scanAlerts();
      const updated = await fetchAlerts();
      setAlerts(updated.alerts);
      setUnreadAlertsCount(updated.unread_count);
      return scanRes.alerts_created;
    } catch (err) {
      console.error("Scan alerts failed:", err);
      return 0;
    } finally {
      setIsScanningAlerts(false);
    }
  };

  const handleMarkAlertRead = async (alertId: number) => {
    try {
      await markAlertRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
      setUnreadAlertsCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      await markAllAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      setUnreadAlertsCount(0);
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const handleSimulateAlert = async (payload: SimulateEventPayload) => {
    try {
      await simulateMarketEvent(payload);
      const updated = await fetchAlerts();
      setAlerts(updated.alerts);
      setUnreadAlertsCount(updated.unread_count);
    } catch (err) {
      console.error("Simulate alert failed:", err);
    }
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

  // Update Holding completely (deterministic recalculation on server)
  const handleUpdateHolding = async (holdingId: number, payload: UpdateHoldingPayload) => {
    setIsRefreshing(true);
    try {
      const updated = await updateHolding(holdingId, payload);
      setPortfolio(updated);
    } catch (err) {
      console.error("Failed to update holding:", err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete Holding completely (deterministic recalculation on server)
  const handleDeleteHolding = async (holdingId: number) => {
    setIsRefreshing(true);
    try {
      const updated = await deleteHolding(holdingId);
      setPortfolio(updated);
    } catch (err) {
      console.error("Failed to delete holding:", err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Flush all investment data (100% clean slate)
  const handleFlushData = async () => {
    setIsRefreshing(true);
    try {
      await flushInvestmentData();
      setPortfolio(null);
    } catch (err) {
      console.error("Failed to flush investment data:", err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatRupee = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    return "₹" + Math.round(val).toLocaleString("en-IN");
  };

  // Metrics: 0 defaults if no portfolio exists
  const hasPortfolio = Boolean(portfolio && portfolio.holdings && portfolio.holdings.length > 0);
  const totalValue = portfolio?.current_value ?? 0;
  const totalInvested = portfolio?.total_invested ?? 0;
  const absoluteGain = totalValue - totalInvested;
  const absoluteGainPct = totalInvested > 0 ? (absoluteGain / totalInvested) * 100 : 0;
  const xirr = portfolio?.xirr_pct ?? 0;

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-slate-900 flex flex-col font-sans">
      {/* 1. Top Navigation Bar */}
      <Navbar
        onRefresh={handleRefreshLivePrices}
        isRefreshing={isRefreshing}
        healthStatus={health?.status}
        dbLatency={health?.services.database?.latency_ms}
        unreadAlertsCount={unreadAlertsCount}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        bellPulse={bellPulse}
      />

      {/* 2. Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Top Header & Tab Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-serif-editorial">
              Your Investments
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              A clear view of your portfolio, returns, and monthly SIP growth
            </p>
          </div>

          {/* Action Toolbar & Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full sm:w-auto">
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold w-full sm:w-auto shadow-2xs">
              <button
                onClick={() => setActiveTab("portfolio")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg transition-all ${
                  activeTab === "portfolio"
                    ? "bg-white text-emerald-950 border border-emerald-200/70 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Wallet className={`w-3.5 h-3.5 ${activeTab === "portfolio" ? "text-emerald-600" : "text-slate-400"}`} />
                <span>Portfolio</span>
              </button>
              <button
                onClick={() => setActiveTab("sip")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg transition-all ${
                  activeTab === "sip"
                    ? "bg-white text-indigo-950 border border-indigo-200/70 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Repeat className={`w-3.5 h-3.5 ${activeTab === "sip" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>SIP Growth</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              {/* Refresh Live Prices Button */}
              {hasPortfolio && (
                <button
                  onClick={handleRefreshLivePrices}
                  disabled={isRefreshing}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
                  title="Fetch live prices for holdings"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-slate-400 ${
                      isRefreshing ? "animate-spin" : ""
                    }`}
                  />
                  <span className="hidden min-[480px]:inline sm:hidden lg:inline">Refresh Prices</span>
                </button>
              )}

              {/* Flush Data Button (available in toolbar if user has holdings) */}
              {hasPortfolio && (
                <button
                  onClick={() => setIsFlushModalOpen(true)}
                  disabled={isRefreshing}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200/70 text-xs font-semibold text-rose-700 shadow-xs transition-colors cursor-pointer"
                  title="Flush all investment data"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden min-[480px]:inline sm:hidden lg:inline">Flush Data</span>
                </button>
              )}

              {/* Upload Button */}
              <button
                onClick={() => {
                  if (activeTab === "sip") {
                    setIsSipUploadOpen(true);
                  } else {
                    setIsUploadOpen(true);
                  }
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {activeTab === "sip" ? "Add SIP" : "Upload Statement"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Demo Sandbox Alert Banner */}
        {isDemoSandbox && (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/40 to-slate-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-900">
                    Previewing in Demo Sandbox
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-800">
                    Read-Only
                  </span>
                </div>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  This is realistic mock Indian portfolio data. None of this is saved to your account.
                </p>
              </div>
            </div>

            <div className="flex flex-col min-[420px]:flex-row w-full sm:w-auto items-stretch min-[420px]:items-center gap-2 shrink-0">
              <button
                onClick={exitDemoSandbox}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer text-center"
              >
                Exit Demo
              </button>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Real Statement</span>
              </button>
            </div>
          </div>
        )}

        {/* 3-Step Activation Stepper (shown only when data is fully loaded and user has no portfolio and not in demo mode) */}
        {!isLoading && !hasPortfolio && !isDemoSandbox && (
          <OnboardingStepper
            onOpenUpload={() => setIsUploadOpen(true)}
            onExploreDemo={enterDemoSandbox}
          />
        )}

        {/* TAB 1: PORTFOLIO OVERVIEW */}
        {activeTab === "portfolio" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <MetricCard
                title="Total Value"
                value={formatRupee(totalValue)}
                changePct={hasPortfolio ? absoluteGainPct : undefined}
                icon={Wallet}
                accent="emerald"
                isLoading={isLoading}
              />
              <MetricCard
                title="Total Invested"
                value={formatRupee(totalInvested)}
                subtitle="Principal Capital"
                icon={Landmark}
                accent="indigo"
                isLoading={isLoading}
              />
              <MetricCard
                title="Total Returns"
                value={formatRupee(absoluteGain)}
                changePct={hasPortfolio ? absoluteGainPct : undefined}
                icon={TrendingUp}
                accent={absoluteGain >= 0 ? "emerald" : "rose"}
                isLoading={isLoading}
              />
              <MetricCard
                title="Annual Growth (XIRR)"
                value={hasPortfolio ? `${xirr.toFixed(1)}%` : "0.0%"}
                subtitle="Annualized Compound"
                icon={Zap}
                accent="amber"
                isLoading={isLoading}
              />
            </div>

            {/* Health / Risk Banner (only if portfolio exists) */}
            {hasPortfolio && (
              <RiskAlertBanner
                isConcentrated={portfolio?.is_concentrated ?? false}
                concentrationSummary={portfolio?.concentration_summary}
              />
            )}

            {/* Asset Allocation & Top Sectors (only if portfolio exists) */}
            {hasPortfolio && (
              <AllocationBreakdown
                sectorAllocations={portfolio?.sector_allocations || []}
                totalValue={totalValue}
                holdings={portfolio?.holdings || []}
              />
            )}

            {/* Holdings Table */}
            <HoldingsTable
              holdings={portfolio?.holdings || []}
              totalValue={totalValue}
              isLoading={isLoading}
              onCorrectHolding={handleCorrectHolding}
              onUpdateHolding={handleUpdateHolding}
              onDeleteHolding={handleDeleteHolding}
              onFlushData={() => setIsFlushModalOpen(true)}
              onOpenUpload={() => setIsUploadOpen(true)}
            />
          </div>
        )}

        {/* TAB 2: MONTHLY SIPS & WEALTH PROJECTIONS */}
        {activeTab === "sip" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <SIPDashboard
              sipData={sipData}
              isLoading={isLoading}
              onOpenUpload={() => setIsSipUploadOpen(true)}
              onRefresh={loadData}
            />
          </div>
        )}
      </main>

      {/* Global Modals & Slide-Over Drawers */}
      {/* 1. Statement Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={loadData}
      />

      {/* 2. SIP Screenshot / Mandate Upload Modal */}
      <SIPUploadModal
        isOpen={isSipUploadOpen}
        onClose={() => setIsSipUploadOpen(false)}
        onUploadSuccess={(newSipData) => {
          setSipData(newSipData);
          setActiveTab("sip");
        }}
      />

      {/* 3. Market Alerts Drawer */}
      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        unreadCount={unreadAlertsCount}
        isScanning={isScanningAlerts}
        onScan={async () => {
          await handleScanAlerts();
        }}
        onMarkRead={handleMarkAlertRead}
        onMarkAllRead={handleMarkAllAlertsRead}
        onSimulate={handleSimulateAlert}
      />

      {/* 4. Flush Investment Data Modal */}
      <FlushDataModal
        isOpen={isFlushModalOpen}
        onClose={() => setIsFlushModalOpen(false)}
        onConfirm={handleFlushData}
        holdingCount={portfolio?.holdings?.length ?? 0}
      />

      {/* 5. Ask AI Copilot (Floating launcher + slide-over drawer) */}
      <ChatPanel portfolioId={portfolio?.id} />

      {/* 6. Real-time Alert Toast Stack (top-right, appears on WS push) */}
      {toastQueue.length > 0 && (
        <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 items-end">
          {toastQueue.slice(-3).map((alert, idx) => (
            <AlertToast
              key={`toast-${alert.id}-${alert.created_at}-${idx}`}
              alert={alert}
              onDismiss={() =>
                setToastQueue((prev) => prev.filter((a) => a.id !== alert.id))
              }
              onView={() => setIsAlertsOpen(true)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 py-5 bg-white text-center text-xs text-slate-500">
        FinSight · 100% Private Investment Dashboard · Your statements are never saved or shared
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-400">
          Loading workspace...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
