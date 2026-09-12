export interface Holding {
  id: number;
  name: string;
  symbol?: string | null;
  instrument_type: "MUTUAL_FUND" | "STOCK" | "ETF";
  sector: string;
  market_cap_category?: "LARGE_CAP" | "MID_CAP" | "SMALL_CAP" | null;
  invested_amount: number;
  current_value: number;
  units?: number | null;
  nav?: number | null;
  allocation_pct: number;
}

export interface SectorAllocation {
  sector: string;
  allocation_pct: number;
  total_value: number;
}

export interface PortfolioSummary {
  id: number;
  total_invested: number;
  current_value: number;
  absolute_return_pct: number;
  xirr_pct?: number | null;
  is_concentrated: boolean;
  concentration_summary?: string | null;
  holdings: Holding[];
  sector_allocations: SectorAllocation[];
  created_at: string;
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  environment: string;
  total_latency_ms: number;
  services: {
    database?: {
      status: string;
      latency_ms: number;
      pgvector_ready: boolean;
    };
    redis?: {
      status: string;
      latency_ms: number;
    };
  };
}
