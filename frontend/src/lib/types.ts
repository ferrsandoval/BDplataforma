export type ProfileStatus = "pending" | "processing" | "complete" | "error";
export type SourceStatus = "success" | "not_found" | "error" | "timeout";
export type Sentiment = "positive" | "neutral" | "negative";

export interface SocialMediaEntry {
  platform: string;
  url?: string;
  name?: string;
  bio?: string;
  followers?: number;
  public_posts_sample: string[];
}

export interface NewsMention {
  title: string;
  source: string;
  date?: string;
  url?: string;
  sentiment?: Sentiment;
}

export interface PublicRecord {
  type: string;
  source: string;
  date?: string;
  description: string;
  url?: string;
}

export interface LoanEntry {
  id: string;
  amount: number;
  date: string;
  status: string;
  days_overdue: number;
}

export interface Reference {
  name: string;
  relationship: string;
  phone: string;
}

export interface EmploymentInfo {
  is_government_employee?: boolean | null;
  government_entity?: string | null;
  nss?: string | null;
  employment_status?: string | null;
  evidence: string[];
}

export interface PublicProfileData {
  social_media: SocialMediaEntry[];
  news_mentions: NewsMention[];
  public_records: PublicRecord[];
}

export interface InternalHistory {
  loans: LoanEntry[];
  payment_score?: number;
  references: Reference[];
}

export interface SourceStatusEntry {
  source: string;
  status: SourceStatus;
  duration_ms: number;
}

export interface EnrichedProfile {
  request_id: string;
  created_at: string;
  status: ProfileStatus;
  processing_duration_ms?: number;
  input: Record<string, unknown>;
  ai_summary?: string;
  employment_info?: EmploymentInfo;
  public_profile: PublicProfileData;
  internal_history: InternalHistory;
  sources_queried: SourceStatusEntry[];
}

export interface ProfileListItem {
  request_id: string;
  created_at: string;
  status: ProfileStatus;
  input: Record<string, unknown>;
}

export interface ProfileListResponse {
  total: number;
  page: number;
  pages: number;
  items: ProfileListItem[];
}

export interface StatsResponse {
  total_searches: number;
  avg_processing_time_ms: number;
}

export interface EnrichmentRequest {
  nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  curp?: string;
  rfc?: string;
  telefono?: string;
  operador_id: string;
}

export interface EnrichmentResponse {
  request_id: string;
  status: ProfileStatus;
}
