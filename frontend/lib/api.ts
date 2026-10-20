import {
  PortfolioSummary,
  HealthResponse,
  SipSummaryResponse,
  ChatResponse,
  AlertSummaryResponse,
  ScanResult,
  SimulateEventPayload,
  AdminOverviewResponse,
  AdminWebAnalyticsResponse,
  AdminBehaviorAnalyticsResponse,
  AdminLlmAnalyticsResponse,
  AdminDocumentAnalyticsResponse,
  AdminFeedbackResponse,
  AdminUserItem,
  AdminPlanItem,
  UpdateHoldingPayload,
  FlushDataResponse,
  BrokerOption,
  SellEstimateRequest,
  SellEstimateResult,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAuthHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders || {});
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("finsight_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = getAuthHeaders(init.headers);
  return fetch(url, {
    ...init,
    headers,
  });
}

export interface ApiEnvelope<T> {
  success: boolean;
  request_id: string;
  path: string;
  timestamp: string;
  data?: T;
  error?: {
    code: string;
    http_status: number;
    message: string;
    details?: any;
  };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Health check failed with status ${res.status}`;
    throw new Error(msg);
  }
  return json.data !== undefined ? json.data : json;
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary | null> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/summary`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 404 || json?.error?.code === "FS_NOT_FOUND_4040") {
      return null;
    }
    const msg = json?.error?.message || `Failed to fetch portfolio: ${res.statusText}`;
    throw new Error(msg);
  }
  return json.data !== undefined ? json.data : json;
}

export async function updateHolding(
  holdingId: number,
  payload: UpdateHoldingPayload
): Promise<PortfolioSummary> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/holdings/${holdingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Failed to update holding: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function deleteHolding(holdingId: number): Promise<PortfolioSummary> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/holdings/${holdingId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Failed to delete holding: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function flushInvestmentData(): Promise<FlushDataResponse> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/flush`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Failed to flush investment data: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function seedDemoPortfolio(): Promise<PortfolioSummary> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/seed-sample`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Failed to seed demo portfolio: ${res.statusText}`;
    throw new Error(msg);
  }
  return json.data !== undefined ? json.data : json;
}

export async function refreshPortfolioPrices(): Promise<PortfolioSummary> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/refresh-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Failed to refresh live prices: ${res.statusText}`;
    throw new Error(msg);
  }
  return json.data !== undefined ? json.data : json;
}

export async function uploadStatement(
  file: File,
  password?: string
): Promise<PortfolioSummary> {
  const formData = new FormData();
  formData.append("file", file);
  if (password && password.trim()) {
    formData.append("password", password.trim());
  }

  const res = await authFetch(`${API_BASE_URL}/portfolio/upload`, {
    method: "POST",
    body: formData,
  });

  const json: ApiEnvelope<PortfolioSummary> = await res.json();

  if (!res.ok) {
    const code = json?.error?.code;
    let userMsg = json?.error?.message;

    if (code === "FS_QUOTA_4290") {
      userMsg = "Monthly upload quota reached. Upgrade to Pro for unlimited uploads.";
    } else if (code === "FS_FILE_4000") {
      userMsg = "Unsupported file type. Please upload a PDF, image, CSV, or Excel file.";
    } else if (code === "FS_FILE_4001") {
      userMsg = "File too large. Maximum supported file size is 15MB.";
    } else if (code === "FS_FILE_4002") {
      userMsg = "The PDF is password protected or the password provided was incorrect.";
    } else if (code === "FS_VALIDATION_4220") {
      userMsg = json?.error?.message || "Could not detect valid holdings. Please verify statement format.";
    }

    throw new Error(userMsg || `Upload failed with status ${res.status}`);
  }

  return json.data !== undefined ? json.data : (json as any);
}

export async function fetchSipSummary(): Promise<SipSummaryResponse | null> {
  const res = await authFetch(`${API_BASE_URL}/sip/summary`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 404 || json?.error?.code === "FS_NOT_FOUND_4040") {
      return null;
    }
    throw new Error(json?.error?.message || `Failed to fetch SIP summary: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function seedDemoSip(): Promise<SipSummaryResponse> {
  const res = await authFetch(`${API_BASE_URL}/sip/seed-sample`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Failed to seed demo SIPs: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function uploadSipDocument(
  file: File,
  password?: string
): Promise<SipSummaryResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (password && password.trim()) {
    formData.append("password", password.trim());
  }

  const res = await authFetch(`${API_BASE_URL}/sip/upload`, {
    method: "POST",
    body: formData,
  });

  const json: ApiEnvelope<SipSummaryResponse> = await res.json();

  if (!res.ok) {
    const code = json?.error?.code;
    let userMsg = json?.error?.message;

    if (code === "FS_QUOTA_4290") {
      userMsg = "Monthly upload quota reached. Upgrade to Pro for unlimited uploads.";
    } else if (code === "FS_FILE_4000") {
      userMsg = "Unsupported file type. Please upload a screenshot, PDF, CSV, or Excel file.";
    } else if (code === "FS_FILE_4001") {
      userMsg = "File too large. Maximum supported file size is 15MB.";
    } else if (code === "FS_VALIDATION_4220") {
      userMsg = json?.error?.message || "Could not detect active SIP mandates. Please verify the screenshot or document.";
    }

    throw new Error(userMsg || `SIP upload failed with status ${res.status}`);
  }

  return json.data !== undefined ? json.data : (json as any);
}

export async function deleteSipPlan(sipId: number): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/sip/${sipId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json?.error?.message || "Failed to remove SIP");
  }
}

export async function askCopilot(
  query: string,
  portfolioId?: number,
  sessionId: string = "default"
): Promise<ChatResponse> {
  const res = await authFetch(`${API_BASE_URL}/chat/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      portfolio_id: portfolioId,
      session_id: sessionId,
    }),
  });

  const json: ApiEnvelope<ChatResponse> = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Chat request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return json.data !== undefined ? json.data : (json as any);
}

export async function clearCopilotHistory(sessionId: string = "default"): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/chat/history?session_id=${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json?.error?.message || "Failed to clear chat memory");
  }
}

export async function fetchAlerts(userId?: number): Promise<AlertSummaryResponse> {
  const query = userId !== undefined ? `?user_id=${userId}` : "";
  const res = await authFetch(`${API_BASE_URL}/alerts/${query}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Failed to fetch alerts: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function scanAlerts(): Promise<ScanResult> {
  const res = await authFetch(`${API_BASE_URL}/alerts/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Market scan failed: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

export async function markAlertRead(alertId: number, userId?: number): Promise<void> {
  const query = userId !== undefined ? `?user_id=${userId}` : "";
  const res = await authFetch(`${API_BASE_URL}/alerts/${alertId}/read${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json?.error?.message || "Failed to mark alert as read");
  }
}

export async function markAllAlertsRead(userId?: number): Promise<void> {
  const query = userId !== undefined ? `?user_id=${userId}` : "";
  const res = await authFetch(`${API_BASE_URL}/alerts/read-all${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json?.error?.message || "Failed to mark all alerts as read");
  }
}

export async function simulateMarketEvent(
  payload: SimulateEventPayload,
  userId: number = 1
): Promise<ScanResult> {
  const res = await authFetch(`${API_BASE_URL}/alerts/simulate?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Simulate event failed: ${res.statusText}`);
  }
  return json.data !== undefined ? json.data : json;
}

// =============================================================================
// Super-Admin & Web Analytics API Client Methods
// =============================================================================

export async function fetchAdminOverview(): Promise<AdminOverviewResponse> {
  const res = await authFetch(`${API_BASE_URL}/admin/analytics/overview`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch admin overview");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminWebAnalytics(days: number = 14): Promise<AdminWebAnalyticsResponse> {
  const res = await authFetch(`${API_BASE_URL}/admin/analytics/web?days=${days}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch web analytics");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminBehaviorAnalytics(): Promise<AdminBehaviorAnalyticsResponse> {
  const res = await authFetch(`${API_BASE_URL}/admin/analytics/behavior`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch behavior analytics");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminLlmAnalytics(): Promise<AdminLlmAnalyticsResponse> {
  const res = await authFetch(`${API_BASE_URL}/admin/analytics/llm`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch LLM analytics");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminDocumentAnalytics(): Promise<AdminDocumentAnalyticsResponse> {
  const res = await authFetch(`${API_BASE_URL}/admin/analytics/documents`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch document analytics");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminFeedbackAnalytics(): Promise<AdminFeedbackResponse> {
  const res = await authFetch(`${API_BASE_URL}/admin/analytics/feedback`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch feedback analytics");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminUsers(): Promise<AdminUserItem[]> {
  const res = await authFetch(`${API_BASE_URL}/admin/users`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch user directory");
  return json.data !== undefined ? json.data : json;
}

export async function fetchAdminPlans(): Promise<AdminPlanItem[]> {
  const res = await authFetch(`${API_BASE_URL}/admin/plans`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch plans");
  return json.data !== undefined ? json.data : json;
}

export async function fetchFeatures(): Promise<Array<{ id: number; key: string; name: string; description?: string; default_enabled: boolean }>> {
  const res = await authFetch(`${API_BASE_URL}/admin/features`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch features");
  return json.data !== undefined ? json.data : json;
}

export async function createPlan(payload: {
  slug: string;
  name: string;
  price_monthly_inr: number;
  quotas: Record<string, number>;
  features: Record<string, boolean>;
}): Promise<any> {
  const res = await authFetch(`${API_BASE_URL}/admin/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to create plan");
  return json.data !== undefined ? json.data : json;
}

export async function updatePlan(
  planId: number,
  payload: {
    name?: string;
    price_monthly_inr?: number;
    quotas?: Record<string, number>;
    features?: Record<string, boolean>;
  }
): Promise<any> {
  const res = await authFetch(`${API_BASE_URL}/admin/plans/${planId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to update plan");
  return json.data !== undefined ? json.data : json;
}

export async function assignUserPlan(userId: number, planSlug: string): Promise<any> {
  const res = await authFetch(`${API_BASE_URL}/admin/users/${userId}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_slug: planSlug }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to assign plan");
  return json.data !== undefined ? json.data : json;
}

export async function overrideUserFeature(
  userId: number,
  featureKey: string,
  enabled: boolean,
  reason?: string
): Promise<any> {
  const res = await authFetch(`${API_BASE_URL}/admin/users/${userId}/features/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature_key: featureKey, enabled, reason: reason || "Super-admin manual override" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to override feature");
  return json.data !== undefined ? json.data : json;
}

export async function deleteUserFeatureOverride(userId: number, featureKey: string): Promise<any> {
  const res = await authFetch(`${API_BASE_URL}/admin/users/${userId}/features/override/${featureKey}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to remove feature override");
  return json.data !== undefined ? json.data : json;
}

export async function fetchUserQuotas(userId: number): Promise<Record<string, any>> {
  const res = await authFetch(`${API_BASE_URL}/admin/users/${userId}/quotas`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch quotas");
  return json.data !== undefined ? json.data : json;
}

export async function trackAnalytics(payload: {
  type?: "pageview" | "event";
  path?: string;
  title?: string;
  referrer?: string;
  duration_seconds?: number;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  metadata?: any;
  visitor_id?: string;
  session_id?: string;
  user_id?: number | null;
}): Promise<void> {
  try {
    const body = JSON.stringify({
      type: payload.type || "pageview",
      path: payload.path || window.location.pathname,
      title: payload.title || document.title,
      referrer: payload.referrer || document.referrer || "Direct",
      duration_seconds: payload.duration_seconds || 0,
      category: payload.category || "navigation",
      action: payload.action || "pageview",
      label: payload.label,
      value: payload.value,
      metadata: payload.metadata || {},
      visitor_id: payload.visitor_id,
      session_id: payload.session_id,
      user_id: payload.user_id ?? null,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API_BASE_URL}/analytics/collect`, blob);
    } else {
      fetch(`${API_BASE_URL}/analytics/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (e) {
    // Non-blocking telemetry
  }
}

export async function fetchSupportedBrokers(): Promise<BrokerOption[]> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/brokers`, { cache: "default" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || "Failed to fetch broker list");
  }
  return json.data !== undefined ? json.data : json;
}

export async function calculateSellEstimate(
  payload: SellEstimateRequest
): Promise<SellEstimateResult> {
  const res = await authFetch(`${API_BASE_URL}/portfolio/sell-estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || "Failed to calculate sell estimate");
  }
  return json.data !== undefined ? json.data : json;
}
