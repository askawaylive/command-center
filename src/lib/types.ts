export type BusinessId = string;
export type BusinessType = "app" | "ecommerce" | "saas" | "commission";

export interface Business {
  id: BusinessId;
  name: string;
  tagline: string;
  /** Longer snapshot of what the business does; also given to Claude as context. */
  description?: string;
  /** Small square logo as a data: URL (resized in the browser before upload). */
  logo?: string;
  color: string; // hex accent for this business
  /** What kind of business it is; picks the dashboard on its page. */
  type?: BusinessType;
  /** @deprecated older setting; "commission" maps to type "commission". */
  model?: "sales" | "commission";
  commission?: { rate: number; costPct: number }; // percent of gross profit; default direct-cost % of a job
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
  /** Step of the launch this sits in (e.g. "Start now", "Build"); drives the launch pad columns. */
  stage?: string;
  /** Ids of tasks that must be done before this one can be completed. */
  dependsOn?: string[];
  /** Flag for tasks that cost money (shown in red). */
  costs?: boolean;
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
  subscribers?: number; // active subscriptions (Stripe)
  live: boolean;
}

export interface BusinessMetrics {
  businessId: BusinessId;
  revenue30d: number;
  revenuePrev30d: number;
  orders30d: number;
  mrr: number;
  subscribers: number;
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
  threadId?: string;
  /** True when this inbox was connected with permission to send, so replies work. */
  canReply?: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  businessId?: BusinessId;
  live: boolean;
}

export interface Contact {
  id: string;
  name: string;
  /** Which business this person is for. Empty means personal / not tied to one. */
  businessId?: BusinessId;
  role?: string; // e.g. "Supplier", "Investor", "Editor"
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
  /** Small square profile picture as a data: URL. */
  photo?: string;
  createdAt: string;
}

export type JobStatus = "sent" | "sold" | "completed" | "lost" | "cancelled";

/** A quoted job for a commission business (e.g. a painting estimate). */
export interface Job {
  id: string;
  businessId: BusinessId;
  customer: string;
  address?: string;
  quoteNumber?: string;
  amount: number; // contract / proposal price
  /** Direct costs as % of price, until the real cost is known. Falls back to the business default. */
  costPct?: number;
  actualCost?: number; // reconciled direct cost, once known
  status: JobStatus;
  sentDate: string; // YYYY-MM-DD proposal issued
  soldDate?: string; // accepted + deposit
  scheduledDate?: string; // expected completion
  completedDate?: string;
  notes?: string;
  createdAt: string;
}
