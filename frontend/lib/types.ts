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

export interface UpdateHoldingPayload {
  name?: string;
  sector?: string;
  invested_amount?: number;
  current_value?: number;
  units?: number;
  nav?: number;
  instrument_type?: string;
}

export interface FlushDataResponse {
  message: string;
  deleted_portfolios: number;
  deleted_holdings: number;
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
  extraction_status?: "complete" | "partial" | "failed";
  extraction_note?: string | null;
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

export interface SipPlan {
  id?: number;
  user_id?: number;
  source_file_name?: string | null;
  fund_name: string;
  fund_sector: string;
  instrument_type: "MUTUAL_FUND" | "ETF" | "STOCK" | string;
  monthly_amount: number;
  frequency: string;
  allocation_pct: number;
  start_date_str?: string | null;
  folio_number?: string | null;
  is_active: boolean;
  extraction_status?: string;
  extraction_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SipProjectionPoint {
  year: number;
  total_invested: number;
  conservative: number;
  moderate: number;
  optimistic: number;
}

export interface SipSectorAllocation {
  sector: string;
  monthly_amount: number;
  allocation_pct: number;
}

export interface SipSummaryResponse {
  total_monthly_outflow: number;
  active_sips_count: number;
  is_concentrated: boolean;
  concentration_summary?: string | null;
  sector_allocations: SipSectorAllocation[];
  sip_plans: SipPlan[];
  projections: SipProjectionPoint[];
}

export interface ChatSourceCitation {
  chunk_id: number;
  source_page?: number | null;
  content_preview: string;
  relevance_score?: number | null;
}

export interface ChatResponse {
  answer: string;
  citations: ChatSourceCitation[];
  follow_up_suggestions: string[];
  latency_ms: number;
  model_used?: string | null;
  provider_used?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatSourceCitation[];
  follow_up_suggestions?: string[];
  latency_ms?: number;
  model_used?: string | null;
  timestamp: string;
}

export interface StockImpact {
  ticker: string;
  name: string;
  impact_pct: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" | string;
  rationale?: string | null;
  is_in_portfolio?: boolean;
  user_holding_name?: string | null;
}

export interface AlertItem {
  id: number;
  user_id: number;
  event_id?: number | null;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "DANGER" | string;
  is_read: boolean;
  created_at: string;
  event_headline?: string | null;
  sectors_affected: string[];
  source_url?: string | null;
  topic_tag?: string | null;
  action_advice?: string | null;
  stocks_affected?: StockImpact[];
}

export interface AlertSummaryResponse {
  unread_count: number;
  total_count: number;
  alerts: AlertItem[];
}

export interface ScanResult {
  events_processed: number;
  alerts_created: number;
  skipped_duplicates: number;
  scan_duration_ms: number;
  message: string;
}

export interface SimulateEventPayload {
  sector: string;
  severity?: "INFO" | "WARNING" | "DANGER" | string;
  headline?: string;
  summary?: string;
}

// --- Super-Admin & Web Analytics Types ---
export interface AdminOverviewUsers {
  total_users: number;
  new_this_month: number;
}

export interface AdminOverviewFinancials {
  total_aum: number;
  total_invested: number;
  avg_xirr: number;
  total_portfolios: number;
  active_sips_count: number;
  total_monthly_sip_outflow: number;
}

export interface AdminOverviewSubscriptions {
  tiers: {
    free: number;
    pro: number;
    enterprise: number;
  };
  mrr_inr: number;
}

export interface AdminOverviewAi {
  total_queries: number;
  total_tokens: number;
  cost_usd: number;
  cost_inr: number;
}

export interface AdminOverviewPipeline {
  total_processed: number;
  success_rate_pct: number;
  complete: number;
  partial: number;
  failed: number;
}

export interface AdminOverviewResponse {
  users: AdminOverviewUsers;
  financials: AdminOverviewFinancials;
  subscriptions: AdminOverviewSubscriptions;
  ai_economics: AdminOverviewAi;
  document_pipeline: AdminOverviewPipeline;
  web_traffic: {
    total_visits: number;
    unique_visitors: number;
  };
  system_health: {
    api_status: string;
    database: string;
    redis_cache: string;
  };
}

export interface WebDailyTrendPoint {
  date: string;
  pageviews: number;
  visitors: number;
}

export interface WebTopPage {
  path: string;
  views: number;
}

export interface WebReferrer {
  source: string;
  count: number;
}

export interface AdminWebAnalyticsResponse {
  period_days: number;
  total_pageviews: number;
  unique_visitors: number;
  avg_session_duration_seconds: number;
  bounce_rate_pct: number;
  daily_trend: WebDailyTrendPoint[];
  top_pages: WebTopPage[];
  referrers: WebReferrer[];
  devices: Record<string, number>;
  browsers: Record<string, number>;
}

export interface FunnelStep {
  step: string;
  count: number;
  pct: number;
}

export interface FeatureLeaderboardItem {
  action: string;
  category: string;
  count: number;
}

export interface AdminBehaviorAnalyticsResponse {
  total_interaction_events: number;
  exploration_funnel: FunnelStep[];
  feature_leaderboard: FeatureLeaderboardItem[];
}

export interface LLMProviderStat {
  provider: string;
  calls: number;
  cost_usd: number;
  avg_latency_ms: number;
}

export interface LLMTaskStat {
  task: string;
  calls: number;
  cost_usd: number;
  avg_latency_ms: number;
}

export interface LLMLogItem {
  id: number;
  task_type: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  fallback_used: boolean;
  status: string;
  created_at: string;
}

export interface AdminLlmAnalyticsResponse {
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_inr: number;
  avg_latency_ms: number;
  fallback_count: number;
  by_provider: LLMProviderStat[];
  by_task: LLMTaskStat[];
  recent_logs: LLMLogItem[];
}

export interface RecentUploadItem {
  id: number;
  user_id: number;
  source_file: string;
  extraction_status: string;
  extraction_note?: string | null;
  total_invested: number;
  current_value: number;
  created_at: string;
}

export interface AdminDocumentAnalyticsResponse {
  total_vector_chunks: number;
  extraction_statuses: Record<string, number>;
  recent_uploads: RecentUploadItem[];
}

export interface AdminFeedbackCorrectionItem {
  id: number;
  user_id: number;
  holding_name: string;
  field: string;
  original_value: string;
  corrected_value: string;
  notes?: string | null;
  created_at: string;
}

export interface AdminFeedbackResponse {
  total_corrections: number;
  by_field: Record<string, number>;
  recent_corrections: AdminFeedbackCorrectionItem[];
}

export interface AdminUserItem {
  id: number;
  display_name?: string | null;
  email_hash: string;
  auth_method: string;
  plan_slug: string;
  plan_name: string;
  portfolios_count: number;
  total_aum: number;
  active_sips_count: number;
  monthly_sip_amount: number;
  created_at: string;
}

export interface AdminPlanItem {
  id: number;
  slug: string;
  name: string;
  price_monthly_inr: number;
  quotas: Record<string, number>;
  features: Record<string, boolean>;
}


