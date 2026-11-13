export type BusinessId = string;

export interface Business {
  id: BusinessId;
  name: string;
  tagline: string;
  /** Longer snapshot of what the business does; also given to Claude as context. */
  description?: string;
  /** Small square logo as a data: URL (resized in the browser before upload). */
  logo?: string;
  color: string; // hex accent for this business
  /** Env var prefixes / identifiers used to pull live data. Secrets live in .env.local, never here. */
  sources: {
    stripe?: string[]; // keys into STRIPE_<KEY>_SECRET_KEY
    shopify?: string[]; // keys into SHOPIFY_<KEY>_STORE / SHOPIFY_<KEY>_TOKEN
    mercuryAccountIds?: string[]; // Mercury account ids that belong to this business
    gmail?: { account: string; query?: string }; // account key into GMAIL_<KEY>_REFRESH_TOKEN, optional search filter
  };
}

export type TaskStatus = "backlog" | "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  businessId: BusinessId;
  status: TaskStatus;
  priority: Priority;
  /** Day the task is planned for (YYYY-MM-DD). Drives the daily planner. */
  plannedFor?: string;
  dueDate?: string;
  /** Planned time in minutes (Sunsama-style timeboxing). */
  estimateMin?: number;
  launch?: string; // name of the launch/milestone this belongs to
  createdAt: string;
  completedAt?: string;
}

export interface DailyPoint {
  date: string;
  revenue: number;
}

export interface RevenueStream {
  source: "stripe" | "shopify";
  account: string;
  revenue30d: number;
  orders30d: number;
  mrr?: number;
  live: boolean;
}

export interface BusinessMetrics {
  businessId: BusinessId;
  revenue30d: number;
  revenuePrev30d: number;
  orders30d: number;
  mrr: number;
  cash: number;
  daily: DailyPoint[];
  streams: RevenueStream[];
  live: boolean; // true when any number came from a real API
}

export interface Email {
  id: string;
  businessId: BusinessId;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  live: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  businessId?: BusinessId;
  live: boolean;
}
