export interface Account {
  id: number;
  username: string;
  display_name: string | null;
  profile_pic_url: string | null;
  is_connected: boolean;
  last_login_at: string | null;
  min_delay_sec: number;
  max_delay_sec: number;
  daily_cap: number;
  hourly_cap: number;
  work_hours_start: number;
  work_hours_end: number;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: number;
  username: string;
  full_name: string | null;
  pk: string | null;
  profile_pic_url: string | null;
  notes: string | null;
  tags: string | null;
  created_at: string;
}

export interface ContactList {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
}

export interface Template {
  id: number;
  name: string;
  body: string;
  variants: string | null;
  created_at: string;
}

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface Campaign {
  id: number;
  name: string;
  account_id: number;
  template_id: number;
  list_id: number | null;
  status: CampaignStatus;
  start_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  replied: number;
}

export interface CampaignContact {
  id: number;
  contact_id: number;
  contact_username: string | null;
  status: string;
  sent_at: string | null;
  error: string | null;
  rendered_body: string | null;
}

export interface CampaignDetail extends Campaign {
  items: CampaignContact[];
}

export interface Message {
  id: number;
  direction: "outbound" | "inbound";
  status: "queued" | "sent" | "delivered" | "failed" | "read";
  body: string;
  error: string | null;
  created_at: string;
}

export interface Thread {
  id: number;
  account_id: number;
  contact_id: number | null;
  contact_username: string | null;
  title: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_snippet: string | null;
}

export interface ThreadDetail extends Thread {
  messages: Message[];
}

export interface KPI {
  accounts: number;
  contacts: number;
  campaigns_active: number;
  sent_today: number;
  sent_total: number;
  replied_total: number;
  reply_rate: number;
  failed_total: number;
}

export interface TimeseriesPoint {
  date: string;
  sent: number;
  replied: number;
  failed: number;
}

export interface TopAccount {
  account_id: number;
  username: string;
  sent: number;
}

export interface ActivityEvent {
  id: number;
  type: string;
  message: string;
  created_at: string;
}

export interface DashboardData {
  kpi: KPI;
  timeseries: TimeseriesPoint[];
  top_accounts: TopAccount[];
  recent_events: ActivityEvent[];
}
