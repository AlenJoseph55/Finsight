import { PortfolioSummary, HealthResponse } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE_URL}/portfolio/summary`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 404 || json?.error?.code === "FS_NOT_FOUND_4040") {
      // Auto-seed sample portfolio if empty
      return seedDemoPortfolio();
    }
    const msg = json?.error?.message || `Failed to fetch portfolio: ${res.statusText}`;
    throw new Error(msg);
  }
  return json.data !== undefined ? json.data : json;
}

export async function seedDemoPortfolio(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE_URL}/portfolio/seed-sample`, {
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
