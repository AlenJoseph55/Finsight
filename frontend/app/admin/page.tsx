"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

import { notFound } from "next/navigation";
import {
  Users,
  TrendingUp,
  CreditCard,
  Zap,
  Globe,
  Compass,
  FileText,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertCircle,
  Search,
  Cpu,
  RefreshCw,
  X,
  Check,
  Plus,
  Edit3,
  SlidersHorizontal,
} from "lucide-react";

import { AdminTopBar } from "@/components/AdminTopBar";
import {
  AdminOverviewResponse,
  AdminWebAnalyticsResponse,
  AdminBehaviorAnalyticsResponse,
  AdminLlmAnalyticsResponse,
  AdminDocumentAnalyticsResponse,
  AdminFeedbackResponse,
  AdminUserItem,
  AdminPlanItem,
} from "@/lib/types";
import {
  fetchAdminOverview,
  fetchAdminWebAnalytics,
  fetchAdminBehaviorAnalytics,
  fetchAdminLlmAnalytics,
  fetchAdminDocumentAnalytics,
  fetchAdminFeedbackAnalytics,
  fetchAdminUsers,
  fetchAdminPlans,
  createPlan,
  updatePlan,
  assignUserPlan,
  overrideUserFeature,
  fetchUserQuotas,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AdminTab = "overview" | "plans" | "users" | "web" | "behavior" | "llm" | "documents" | "feedback";

export default function AdminDashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();


  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Data states
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [webData, setWebData] = useState<AdminWebAnalyticsResponse | null>(null);
  const [behaviorData, setBehaviorData] = useState<AdminBehaviorAnalyticsResponse | null>(null);
  const [llmData, setLlmData] = useState<AdminLlmAnalyticsResponse | null>(null);
  const [docData, setDocData] = useState<AdminDocumentAnalyticsResponse | null>(null);
  const [feedbackData, setFeedbackData] = useState<AdminFeedbackResponse | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [plans, setPlans] = useState<AdminPlanItem[]>([]);


  // User management modal
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<AdminUserItem | null>(null);
  const [userSearch, setUserSearch] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // User Quota Inspection modal
  const [inspectingUser, setInspectingUser] = useState<AdminUserItem | null>(null);
  const [userQuotasData, setUserQuotasData] = useState<Record<string, any> | null>(null);
  const [loadingUserQuotas, setLoadingUserQuotas] = useState<boolean>(false);

  // Plan Edit Modal state
  const [editingPlan, setEditingPlan] = useState<{
    id: number;
    slug: string;
    name: string;
    price_monthly_inr: number;
    quotas: Record<string, number>;
    features: Record<string, boolean>;
  } | null>(null);

  // Plan Create Modal state
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);
  const [newPlan, setNewPlan] = useState<{
    slug: string;
    name: string;
    price_monthly_inr: number;
    quotas: Record<string, number>;
    features: Record<string, boolean>;
  }>({
    slug: "",
    name: "",
    price_monthly_inr: 499,
    quotas: {
      document_uploads: 10,
      ai_chat_queries: 100,
      market_alert_subscriptions: 10,
      portfolio_snapshots: 5,
    },
    features: {
      portfolio_upload: true,
      portfolio_ai_extraction: true,
      market_alerts_news: true,
      market_alerts_price: false,
      research_assistant: true,
      export_reports: false,
    },
  });

  // Sleek Toast notification state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatLakhsCrores = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return formatINR(val);
  };

  const AVATAR_COLORS = [
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-rose-100 text-rose-700 border-rose-200",
    "bg-cyan-100 text-cyan-700 border-cyan-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
  ];

  const getInitials = (name?: string | null): string => {
    if (!name || !name.trim()) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (id: number): string => {
    return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
  };

  const loadAllData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [
        overviewRes,
        webRes,
        behaviorRes,
        llmRes,
        docRes,
        feedbackRes,
        usersRes,
        plansRes,
      ] = await Promise.allSettled([
        fetchAdminOverview(),
        fetchAdminWebAnalytics(14),
        fetchAdminBehaviorAnalytics(),
        fetchAdminLlmAnalytics(),
        fetchAdminDocumentAnalytics(),
        fetchAdminFeedbackAnalytics(),
        fetchAdminUsers(),
        fetchAdminPlans(),
      ]);

      if (overviewRes.status === "fulfilled") setOverview(overviewRes.value);
      if (webRes.status === "fulfilled") setWebData(webRes.value);
      if (behaviorRes.status === "fulfilled") setBehaviorData(behaviorRes.value);
      if (llmRes.status === "fulfilled") setLlmData(llmRes.value);
      if (docRes.status === "fulfilled") setDocData(docRes.value);
      if (feedbackRes.status === "fulfilled") setFeedbackData(feedbackRes.value);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value);
    } catch (e) {
      console.error("Failed to load admin telemetry:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Assign plan to user
  const handleAssignPlan = async (userId: number, planSlug: string) => {
    try {
      setIsUpdating(true);
      await assignUserPlan(userId, planSlug);
      await loadAllData(true);
      showToast(`User #${userId} subscription successfully updated to ${planSlug.toUpperCase()}!`, "success");
    } catch (e: any) {
      showToast(e.message || "Failed to assign plan.", "error");
    } finally {
      setIsUpdating(false);
      setSelectedUserForPlan(null);
    }
  };

  // Inspect user quotas
  const handleInspectUserQuotas = async (user: AdminUserItem) => {
    setInspectingUser(user);
    setLoadingUserQuotas(true);
    try {
      const quotas = await fetchUserQuotas(user.id);
      setUserQuotasData(quotas);
    } catch (e) {
      console.error("Failed to fetch quotas for user:", e);
      showToast("Failed to fetch user quotas.", "error");
    } finally {
      setLoadingUserQuotas(false);
    }
  };

  // Save edited plan limits
  const handleSavePlanEdits = async () => {
    if (!editingPlan) return;
    const planName = editingPlan.name;
    try {
      setIsUpdating(true);
      await updatePlan(editingPlan.id, {
        name: editingPlan.name,
        price_monthly_inr: editingPlan.price_monthly_inr,
        quotas: editingPlan.quotas,
        features: editingPlan.features,
      });
      setEditingPlan(null);
      await loadAllData(true);
      showToast(`Plan '${planName}' limits & features updated successfully!`, "success");
    } catch (e: any) {
      showToast(e.message || "Failed to update plan.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Create new plan
  const handleCreateNewPlan = async () => {
    if (!newPlan.slug.trim() || !newPlan.name.trim()) {
      showToast("Please provide both a plan name and slug.", "error");
      return;
    }
    const createdName = newPlan.name;
    try {
      setIsUpdating(true);
      await createPlan({
        slug: newPlan.slug.toLowerCase().replace(/\s+/g, "_"),
        name: newPlan.name,
        price_monthly_inr: Number(newPlan.price_monthly_inr) || 0,
        quotas: newPlan.quotas,
        features: newPlan.features,
      });
      setIsCreatingPlan(false);
      await loadAllData(true);
      showToast(`New tier '${createdName}' created successfully!`, "success");
    } catch (e: any) {
      showToast(e.message || "Failed to create plan.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle user feature override
  const handleToggleUserOverride = async (userId: number, featureKey: string, currentEnabled: boolean) => {
    try {
      setIsUpdating(true);
      await overrideUserFeature(userId, featureKey, !currentEnabled, "Admin manual override");
      const updatedQuotas = await fetchUserQuotas(userId);
      setUserQuotasData(updatedQuotas);
      showToast(`Feature '${featureKey}' override updated!`, "success");
    } catch (e: any) {
      showToast(e.message || "Failed to override feature.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.id.toString().includes(q) ||
        u.email_hash.toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q) ||
        u.plan_slug.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  // While auth resolves, render a completely blank light container
  if (isAuthLoading && !user) {
    return <div className="min-h-screen bg-[#f7f8f6]" />;
  }

  // Client-side fallback check: trigger not-found if unauthorized
  if (!user || user.role !== "super_admin") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 bg-slate-900/95 border-slate-700 text-slate-100 max-w-md">
          {toast.type === "success" && (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          )}
          {toast.type === "error" && (
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
          )}
          {toast.type === "info" && (
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-sky-400" />
            </div>
          )}
          <div className="flex-1 text-sm font-medium pr-2">{toast.message}</div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Admin Header */}
      <AdminTopBar onRefresh={() => loadAllData(true)} isRefreshing={isRefreshing} />

      {/* 2. Navigation Tabs */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 scrollbar-none">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "plans", label: "Plans & Quota Limits", icon: SlidersHorizontal },
            { id: "users", label: "Users & Subscriptions", icon: Users },
            { id: "web", label: "Web Traffic & Visitors", icon: Globe },
            { id: "behavior", label: "User Behavior & Funnel", icon: Compass },
            { id: "llm", label: "AI & LLM Economics", icon: Cpu },
            { id: "documents", label: "Document Pipeline", icon: FileText },
            { id: "feedback", label: "Model Corrections", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Dashboard Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8">
        {isLoading && !overview ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Loading platform analytics & telemetry...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ============================================================= */}
            {/* TAB 1: EXECUTIVE OVERVIEW */}
            {/* ============================================================= */}
            {activeTab === "overview" && overview && (
              <div className="space-y-8 animate-in fade-in duration-150">
                {/* Executive KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-medium text-slate-500">Platform AUM Tracked</span>
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatLakhsCrores(overview.financials.total_aum)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      Invested: {formatLakhsCrores(overview.financials.total_invested)} · Avg XIRR: {overview.financials.avg_xirr}%
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-medium text-slate-500">Estimated MRR</span>
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatINR(overview.subscriptions.mrr_inr)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      {overview.subscriptions.tiers.pro} Pro · {overview.subscriptions.tiers.enterprise} Enterprise
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-medium text-slate-500">Registered Users</span>
                      <Users className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {overview.users.total_users}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                      +{overview.users.new_this_month} new this month
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-medium text-slate-500">Active Monthly SIPs</span>
                      <Zap className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatINR(overview.financials.total_monthly_sip_outflow)}/mo
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      Across {overview.financials.active_sips_count} active investor mandates
                    </div>
                  </div>
                </div>

                {/* Secondary Metrics: AI Spend, Document Extraction, Web Visitors */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">AI Intelligence Spend</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        Multi-Provider
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold text-slate-900">
                        ${overview.ai_economics.cost_usd.toFixed(3)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        (≈ ₹{overview.ai_economics.cost_inr})
                      </span>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Total AI Invocations:</span>
                        <span className="font-bold text-slate-900">{overview.ai_economics.total_queries} calls</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Tokens Processed:</span>
                        <span className="font-bold text-slate-900">{overview.ai_economics.total_tokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Avg Cost Per Query:</span>
                        <span className="font-bold text-slate-900">
                          ${overview.ai_economics.total_queries > 0 ? (overview.ai_economics.cost_usd / overview.ai_economics.total_queries).toFixed(4) : "0.0000"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Document Parsing Health</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        {overview.document_pipeline.success_rate_pct}% Success
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {overview.document_pipeline.total_processed}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">statements ingested</span>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Complete (Zero Errors):</span>
                        <span className="font-bold text-emerald-700">{overview.document_pipeline.complete}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Partial (Fallback Warnings):</span>
                        <span className="font-bold text-amber-700">{overview.document_pipeline.partial}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Failed (Format/Password):</span>
                        <span className="font-bold text-rose-700">{overview.document_pipeline.failed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Infrastructure & Traffic</h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Healthy
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {overview.web_traffic.unique_visitors}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">unique visitors ({overview.web_traffic.total_visits} views)</span>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Database:</span>
                        <span className="font-bold text-slate-900">PostgreSQL 16 + pgvector</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Cache & Rate Limits:</span>
                        <span className="font-bold text-slate-900">Redis 7 Alpine</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Real-Time Broadcast:</span>
                        <span className="font-bold text-slate-900">Async WebSockets</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: PLANS & QUOTA LIMITS MANAGEMENT */}
            {/* ============================================================= */}
            {activeTab === "plans" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Subscription Plans & Quota Limits</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure monthly limits for document uploads, AI chat queries, alert subscriptions, and toggle feature entitlements per tier.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsCreatingPlan(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Plan</span>
                  </button>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 font-mono">
                              {p.slug}
                            </span>
                            <h4 className="text-lg font-bold text-slate-900 mt-1">{p.name}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-extrabold text-slate-900">{formatINR(p.price_monthly_inr)}</span>
                            <span className="text-[11px] text-slate-400 block">/month</span>
                          </div>
                        </div>

                        {/* Numeric Quota Limits */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            Monthly Metered Limits
                          </span>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Document Uploads:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {p.quotas["document_uploads"] === -1 ? "Unlimited" : `${p.quotas["document_uploads"] || 0} / mo`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">AI Chat Queries:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {p.quotas["ai_chat_queries"] === -1 ? "Unlimited" : `${p.quotas["ai_chat_queries"] || 0} / mo`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Market Alerts:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {p.quotas["market_alert_subscriptions"] === -1 ? "Unlimited" : `${p.quotas["market_alert_subscriptions"] || 0} / mo`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Portfolio Snapshots:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {p.quotas["portfolio_snapshots"] === -1 ? "Unlimited" : `${p.quotas["portfolio_snapshots"] || 0}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Feature Entitlements */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            Feature Entitlements
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                              { key: "portfolio_upload", label: "Upload Statements" },
                              { key: "portfolio_ai_extraction", label: "AI Extraction" },
                              { key: "market_alerts_news", label: "Market News Alerts" },
                              { key: "market_alerts_price", label: "Price Anomaly Alerts" },
                              { key: "research_assistant", label: "AI Research Copilot" },
                              { key: "export_reports", label: "Export Reports" },
                            ].map((f) => {
                              const isEnabled = !!p.features[f.key];
                              return (
                                <div
                                  key={f.key}
                                  className={`p-2 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 ${
                                    isEnabled
                                      ? "bg-emerald-50/70 border-emerald-200/60 text-emerald-800"
                                      : "bg-slate-50 border-slate-200/50 text-slate-400 line-through"
                                  }`}
                                >
                                  {isEnabled ? (
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  ) : (
                                    <X className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                  <span className="truncate">{f.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setEditingPlan({
                            id: p.id,
                            slug: p.slug,
                            name: p.name,
                            price_monthly_inr: p.price_monthly_inr,
                            quotas: { ...p.quotas },
                            features: { ...p.features },
                          })
                        }
                        className="w-full py-2 rounded-xl border border-slate-300 hover:border-slate-900 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Limits & Features</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Edit Plan Modal */}
                {editingPlan && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Edit Tier: {editingPlan.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono">Slug: {editingPlan.slug}</p>
                        </div>
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Name & Price */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Tier Name</label>
                          <input
                            type="text"
                            value={editingPlan.name}
                            onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-900 text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Price (₹/month)</label>
                          <input
                            type="number"
                            value={editingPlan.price_monthly_inr}
                            onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly_inr: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-900 text-xs"
                          />
                        </div>
                      </div>

                      {/* Quotas Configuration */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Monthly Quota Limits (-1 = Unlimited)
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {[
                            { key: "document_uploads", label: "Document Uploads" },
                            { key: "ai_chat_queries", label: "AI Chat Queries" },
                            { key: "market_alert_subscriptions", label: "Market Alerts" },
                            { key: "portfolio_snapshots", label: "Portfolio Snapshots" },
                          ].map((q) => (
                            <div key={q.key} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                              <label className="font-semibold text-slate-700 block mb-1">{q.label}</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={editingPlan.quotas[q.key] ?? 0}
                                  onChange={(e) =>
                                    setEditingPlan({
                                      ...editingPlan,
                                      quotas: { ...editingPlan.quotas, [q.key]: Number(e.target.value) },
                                    })
                                  }
                                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingPlan({
                                      ...editingPlan,
                                      quotas: {
                                        ...editingPlan.quotas,
                                        [q.key]: editingPlan.quotas[q.key] === -1 ? 10 : -1,
                                      },
                                    })
                                  }
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                    editingPlan.quotas[q.key] === -1
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                  }`}
                                >
                                  {editingPlan.quotas[q.key] === -1 ? "Unlimited ✓" : "Set Unlimited"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Features Configuration */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Feature Entitlements
                        </h4>
                        <div className="space-y-2">
                          {[
                            { key: "portfolio_upload", label: "Portfolio Upload", desc: "Allow uploading CAS/PDF/Screenshots" },
                            { key: "portfolio_ai_extraction", label: "AI Document Extraction", desc: "Enable Agent 1 multimodal parsing" },
                            { key: "market_alerts_news", label: "News-based Market Alerts", desc: "Agent 3 sector news monitoring" },
                            { key: "market_alerts_price", label: "Price-based Market Alerts", desc: "Agent 3 price anomaly triggers" },
                            { key: "research_assistant", label: "AI Research Assistant", desc: "Agent 2 interactive RAG copilot" },
                            { key: "export_reports", label: "Export Reports", desc: "Download PDF/Excel reports" },
                          ].map((feat) => {
                            const enabled = !!editingPlan.features[feat.key];
                            return (
                              <div
                                key={feat.key}
                                onClick={() =>
                                  setEditingPlan({
                                    ...editingPlan,
                                    features: { ...editingPlan.features, [feat.key]: !enabled },
                                  })
                                }
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                  enabled
                                    ? "bg-emerald-50/50 border-emerald-200/80"
                                    : "bg-white border-slate-200 opacity-60"
                                }`}
                              >
                                <div>
                                  <span className="font-bold text-slate-900 text-xs">{feat.label}</span>
                                  <p className="text-[11px] text-slate-500">{feat.desc}</p>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                    enabled ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"
                                  }`}
                                >
                                  {enabled && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSavePlanEdits}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? "Saving..." : "Save Limits & Features"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Plan Modal */}
                {isCreatingPlan && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Create New Subscription Tier</h3>
                          <p className="text-xs text-slate-500">Define a custom plan with specific limits & features</p>
                        </div>
                        <button
                          onClick={() => setIsCreatingPlan(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Plan Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Plus Tier"
                            value={newPlan.name}
                            onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-900 text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Slug (Identifier)</label>
                          <input
                            type="text"
                            placeholder="e.g. plus"
                            value={newPlan.slug}
                            onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-900 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="text-xs">
                        <label className="font-semibold text-slate-700 block mb-1">Monthly Price (₹ INR)</label>
                        <input
                          type="number"
                          value={newPlan.price_monthly_inr}
                          onChange={(e) => setNewPlan({ ...newPlan, price_monthly_inr: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-900 text-xs"
                        />
                      </div>

                      {/* Quotas */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Quota Limits (-1 for Unlimited)
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {[
                            { key: "document_uploads", label: "Document Uploads" },
                            { key: "ai_chat_queries", label: "AI Chat Queries" },
                            { key: "market_alert_subscriptions", label: "Market Alerts" },
                            { key: "portfolio_snapshots", label: "Portfolio Snapshots" },
                          ].map((q) => (
                            <div key={q.key} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                              <label className="font-semibold text-slate-700 block mb-1">{q.label}</label>
                              <input
                                type="number"
                                value={newPlan.quotas[q.key] ?? 0}
                                onChange={(e) =>
                                  setNewPlan({
                                    ...newPlan,
                                    quotas: { ...newPlan.quotas, [q.key]: Number(e.target.value) },
                                  })
                                }
                                className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => setIsCreatingPlan(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateNewPlan}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? "Creating..." : "Create Subscription Plan"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 3: USERS & SUBSCRIPTION DIRECTORY */}
            {/* ============================================================= */}
            {activeTab === "users" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">User Directory & Subscriptions</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Assign tiers, inspect live consumption against limits, and toggle feature overrides per user
                      </p>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900"
                      />
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-medium border-b border-slate-100">
                          <th className="py-3 pr-4">User</th>
                          <th className="py-3 px-3">Plan</th>
                          <th className="py-3 px-3 text-right">Tracked AUM</th>
                          <th className="py-3 px-3 text-right">Monthly SIP</th>
                          <th className="py-3 px-3">Portfolios</th>
                          <th className="py-3 pl-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${getAvatarColor(
                                    u.id
                                  )}`}
                                >
                                  {getInitials(u.display_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate text-sm">
                                    {u.display_name?.trim() || "Anonymous Investor"}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                                    <span>#{u.id}</span>
                                    <span>·</span>
                                    <span className="capitalize">{u.auth_method.replace(/_/g, " ")}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  u.plan_slug === "enterprise"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : u.plan_slug === "pro"
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {u.plan_name}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                              {formatLakhsCrores(u.total_aum)}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                              {formatINR(u.monthly_sip_amount)}
                            </td>
                            <td className="py-3.5 px-3 font-medium text-slate-600">
                              {u.portfolios_count} statements
                            </td>
                            <td className="py-3.5 pl-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleInspectUserQuotas(u)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Inspect monthly usage vs limits"
                                >
                                  Quotas & Overrides
                                </button>
                                <button
                                  onClick={() => setSelectedUserForPlan(u)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Change Plan
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Plan Switcher Modal */}
                {selectedUserForPlan && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Assign Subscription Plan</h3>
                          <p className="text-xs text-slate-500">
                            {selectedUserForPlan.display_name?.trim() || `User #${selectedUserForPlan.id}`} (Current: {selectedUserForPlan.plan_name})
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedUserForPlan(null)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {plans.map((tier) => (
                          <div
                            key={tier.slug}
                            onClick={() => handleAssignPlan(selectedUserForPlan.id, tier.slug)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              selectedUserForPlan.plan_slug === tier.slug
                                ? "border-slate-900 bg-slate-50/80"
                                : "border-slate-200 hover:border-slate-400 bg-white"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{tier.name}</span>
                                <span className="text-xs text-slate-500 font-semibold">{formatINR(tier.price_monthly_inr)}/mo</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                Uploads: {tier.quotas["document_uploads"] === -1 ? "Unlimited" : tier.quotas["document_uploads"]} · AI Queries: {tier.quotas["ai_chat_queries"] === -1 ? "Unlimited" : tier.quotas["ai_chat_queries"]}
                              </p>
                            </div>
                            {selectedUserForPlan.plan_slug === tier.slug && (
                              <Check className="w-4 h-4 text-slate-900 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => setSelectedUserForPlan(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Quotas & Overrides Inspection Modal */}
                {inspectingUser && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            {inspectingUser.display_name?.trim() ? `${inspectingUser.display_name.trim()} (#${inspectingUser.id})` : `User #${inspectingUser.id}`} Quotas & Overrides
                          </h3>
                          <p className="text-xs text-slate-500">Tier: {inspectingUser.plan_name}</p>
                        </div>
                        <button
                          onClick={() => setInspectingUser(null)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {loadingUserQuotas ? (
                        <div className="py-12 text-center text-xs text-slate-400">Loading quota consumption...</div>
                      ) : userQuotasData ? (
                        <div className="space-y-4 text-xs">
                          {/* Metered Quotas */}
                          <div className="space-y-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                              Monthly Usage vs Limits
                            </span>
                            {Object.entries(userQuotasData).map(([key, stat]: [string, any]) => {
                              const isUnl = stat.limit === -1;
                              const pct = isUnl ? 10 : Math.min(100, Math.round((stat.used / (stat.limit || 1)) * 100));
                              return (
                                <div key={key} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-700 capitalize">{key.replace(/_/g, " ")}</span>
                                    <span className="font-bold text-slate-900 font-mono">
                                      {stat.used} / {isUnl ? "Unlimited" : stat.limit}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : "bg-emerald-600"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 block">Resets: {stat.resets_at_local}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Feature Overrides */}
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                              Instant Feature Flag Overrides (Super-Admin)
                            </span>
                            <div className="space-y-2">
                              {[
                                { key: "portfolio_ai_extraction", label: "AI Document Extraction" },
                                { key: "market_alerts_news", label: "Market News Alerts" },
                                { key: "research_assistant", label: "AI Research Copilot" },
                                { key: "export_reports", label: "Export Reports" },
                              ].map((f) => (
                                <div key={f.key} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                                  <span className="font-medium text-slate-800 text-xs">{f.label}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleToggleUserOverride(inspectingUser.id, f.key, false)}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                                    >
                                      Grant Access
                                    </button>
                                    <button
                                      onClick={() => handleToggleUserOverride(inspectingUser.id, f.key, true)}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold cursor-pointer"
                                    >
                                      Revoke Access
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => setInspectingUser(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 4: WEB TRAFFIC & VISITORS */}
            {/* ============================================================= */}
            {activeTab === "web" && webData && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Total Pageviews</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{webData.total_pageviews}</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Last {webData.period_days} days</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Unique Visitors</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{webData.unique_visitors}</div>
                    <span className="text-[11px] text-emerald-600 mt-0.5 block">Anonymized session hashes</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Avg Time on Site</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{webData.avg_session_duration_seconds}s</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Active investor engagement</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Bounce Rate</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{webData.bounce_rate_pct}%</div>
                    <span className="text-[11px] text-emerald-600 mt-0.5 block">Industry avg: 45%</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Traffic Trajectory (Daily Pageviews & Visitors)</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Continuous privacy-safe telemetry stream</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1 bg-indigo-500 rounded-full" />
                        <span className="text-indigo-700">Pageviews</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1 bg-emerald-500 rounded-full" />
                        <span className="text-emerald-700">Unique Visitors</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 pb-2">
                    <div className="h-48 w-full flex items-end gap-2 px-2">
                      {webData.daily_trend.map((pt, idx) => {
                        const maxVal = Math.max(...webData.daily_trend.map((d) => d.pageviews), 10);
                        const pvHeight = Math.max(8, (pt.pageviews / maxVal) * 100);
                        const vHeight = Math.max(4, (pt.visitors / maxVal) * 100);

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                            <div className="w-full max-w-[28px] flex items-end justify-center gap-0.5 h-full">
                              <div
                                style={{ height: `${pvHeight}%` }}
                                className="w-1/2 bg-indigo-500/80 group-hover:bg-indigo-600 rounded-t-sm transition-all"
                                title={`${pt.date}: ${pt.pageviews} pageviews`}
                              />
                              <div
                                style={{ height: `${vHeight}%` }}
                                className="w-1/2 bg-emerald-500/80 group-hover:bg-emerald-600 rounded-t-sm transition-all"
                                title={`${pt.date}: ${pt.visitors} visitors`}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                              {pt.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">Top Visited Routes</h3>
                    <div className="space-y-3">
                      {webData.top_pages.map((p, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 font-mono">{p.path}</span>
                            <span className="font-bold text-slate-900">{p.views} views</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-slate-900 h-full rounded-full"
                              style={{
                                width: `${Math.max(5, (p.views / (webData.top_pages[0]?.views || 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                    <h3 className="text-sm font-bold text-slate-900">Device & Browser Distribution</h3>
                    <div>
                      <span className="text-xs font-medium text-slate-500 mb-2 block">Device Share</span>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {Object.entries(webData.devices).map(([dev, count]) => (
                          <div key={dev} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                            <span className="text-[11px] text-slate-500 capitalize">{dev}</span>
                            <p className="text-base font-bold text-slate-900 mt-0.5">{count}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-500 mb-2 block">Top Browsers</span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(webData.browsers).map(([browser, count]) => (
                          <span
                            key={browser}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                          >
                            <span>{browser}:</span>
                            <span className="font-bold text-slate-900">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 5: USER BEHAVIOR & FUNNEL */}
            {/* ============================================================= */}
            {activeTab === "behavior" && behaviorData && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Investor Exploration & Conversion Funnel</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      How visitors discover, explore features, and convert to active portfolio managers
                    </p>
                  </div>

                  <div className="space-y-4">
                    {behaviorData.exploration_funnel.map((step, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">{step.step}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-900">{step.count} users</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {step.pct}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(4, step.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Feature Engagement Leaderboard</h3>
                  <p className="text-xs text-slate-500">Most frequent user interactions across the dashboard</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-medium border-b border-slate-100">
                          <th className="py-3 pr-4">Action Event</th>
                          <th className="py-3 px-3">Category</th>
                          <th className="py-3 pl-3 text-right">Interactions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {behaviorData.feature_leaderboard.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-3.5 pr-4 font-mono font-semibold text-slate-900">
                              {item.action}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium capitalize">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3.5 pl-3 text-right font-bold text-slate-900">
                              {item.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 6: AI & LLM ECONOMICS */}
            {/* ============================================================= */}
            {activeTab === "llm" && llmData && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Total AI Calls</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{llmData.total_calls}</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">{llmData.total_tokens.toLocaleString()} tokens</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Total Expenditure</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">${llmData.cost_usd.toFixed(4)}</div>
                    <span className="text-[11px] text-emerald-600 mt-0.5 block">≈ ₹{llmData.cost_inr}</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Average Latency</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{llmData.avg_latency_ms} ms</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Sub-second response target</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Fallback Rate</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{llmData.fallback_count}</div>
                    <span className="text-[11px] text-amber-600 mt-0.5 block">Groq ➔ Gemini automatic handoffs</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">Spend & Volume by Provider</h3>
                    <div className="space-y-3">
                      {llmData.by_provider.map((p, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 capitalize">{p.provider}</span>
                            <p className="text-[11px] text-slate-500">{p.calls} calls · Avg {p.avg_latency_ms}ms</p>
                          </div>
                          <span className="font-bold text-slate-900">${p.cost_usd.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">Task Breakdown</h3>
                    <div className="space-y-3">
                      {llmData.by_task.map((t, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 capitalize">{t.task}</span>
                            <p className="text-[11px] text-slate-500">{t.calls} calls · Avg {t.avg_latency_ms}ms</p>
                          </div>
                          <span className="font-bold text-slate-900">${t.cost_usd.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Recent LLM Invocations Log</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-medium border-b border-slate-100">
                          <th className="py-3 pr-4">Time</th>
                          <th className="py-3 px-3">Task</th>
                          <th className="py-3 px-3">Provider & Model</th>
                          <th className="py-3 px-3 text-right">Tokens</th>
                          <th className="py-3 px-3 text-right">Cost</th>
                          <th className="py-3 px-3 text-right">Latency</th>
                          <th className="py-3 pl-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {llmData.recent_logs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              No LLM invocations recorded yet.
                            </td>
                          </tr>
                        ) : (
                          llmData.recent_logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/70">
                              <td className="py-3 pr-4 text-slate-400 font-mono text-[11px]">
                                {log.created_at ? new Date(log.created_at).toLocaleTimeString() : "N/A"}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold capitalize">
                                  {log.task_type}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{log.model}</div>
                                <div className="text-[10px] text-slate-400 capitalize">{log.provider}</div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                                {log.total_tokens}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                                ${log.cost_usd.toFixed(5)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-600">
                                {log.latency_ms}ms
                              </td>
                              <td className="py-3 pl-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 7: DOCUMENT PIPELINE & RAG */}
            {/* ============================================================= */}
            {activeTab === "documents" && docData && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Vector Embeddings (pgvector)</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{docData.total_vector_chunks}</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">768-dimensional passages</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Complete Extractions</span>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">{docData.extraction_statuses.complete || 0}</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Zero parsing errors</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Partial / Warnings</span>
                    <div className="text-2xl font-bold text-amber-700 mt-1">{docData.extraction_statuses.partial || 0}</div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Fallback rules triggered</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Recent Statement Ingestions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-medium border-b border-slate-100">
                          <th className="py-3 pr-4">Source File</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Extracted Value</th>
                          <th className="py-3 px-3">Diagnostic Notes</th>
                          <th className="py-3 pl-3 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {docData.recent_uploads.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 pr-4 font-semibold text-slate-900 max-w-[200px] truncate">
                              {u.source_file}
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.extraction_status === "complete"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {u.extraction_status}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                              {formatLakhsCrores(u.current_value)}
                            </td>
                            <td className="py-3.5 px-3 text-slate-500 max-w-[300px] truncate">
                              {u.extraction_note || "Parsed successfully with deterministic normalization."}
                            </td>
                            <td className="py-3.5 pl-3 text-right text-slate-400 font-mono text-[11px]">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 8: HUMAN FEEDBACK TRACES */}
            {/* ============================================================= */}
            {activeTab === "feedback" && feedbackData && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Human-in-the-Loop Model Correction Traces</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      User corrections recorded when users adjust AI-extracted sectors or holdings. Used for prompt refinement.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-medium border-b border-slate-100">
                          <th className="py-3 pr-4">Holding Name</th>
                          <th className="py-3 px-3">Field</th>
                          <th className="py-3 px-3">AI Extracted Value</th>
                          <th className="py-3 px-3">User Corrected Value</th>
                          <th className="py-3 pl-3 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {feedbackData.recent_corrections.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No manual corrections submitted yet. The AI extraction pipeline is operating at high accuracy.
                            </td>
                          </tr>
                        ) : (
                          feedbackData.recent_corrections.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/70">
                              <td className="py-3.5 pr-4 font-semibold text-slate-900">{c.holding_name}</td>
                              <td className="py-3.5 px-3 capitalize font-medium text-slate-600">{c.field}</td>
                              <td className="py-3.5 px-3 text-rose-700 font-medium line-through">{c.original_value}</td>
                              <td className="py-3.5 px-3 text-emerald-700 font-bold">{c.corrected_value}</td>
                              <td className="py-3.5 pl-3 text-right text-slate-400 font-mono text-[11px]">
                                {c.created_at ? new Date(c.created_at).toLocaleDateString() : "N/A"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
