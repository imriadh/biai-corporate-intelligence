// Frontend API client — talks to the Hono Worker on the same origin.
// All calls send credentials (the httpOnly session cookie) automatically.

import type { AuditSummary, NormalizedLead } from "./types";

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string };
    const msg = err.error ?? `HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return data as T;
}

export interface LoginResponse { user: { username: string; name: string; role: string } }
export interface MeResponse { user: { sub: string; name: string; role: string } | null }
export interface AuditResponse { audit: AuditSummary; leads: NormalizedLead[] }
export interface LeadResponse { lead: NormalizedLead }
export interface EmailResponse {
  subject: string; body: string; provider?: string; model?: string; ms?: number;
  to?: string; gmailUrl?: string; mailtoUrl?: string;
}
export interface QueryResponse {
  handledBy: "deterministic" | "llm";
  understood?: boolean;
  intent?: string;
  humanLabel?: string;
  summary: string;
  scalar?: number;
  scalarLabel?: string;
  columns?: { key: string; label: string }[];
  table?: Record<string, string>[];
  rowCount?: number;
  provider?: string;
  model?: string;
  error?: string;
  suggestion?: string;
}
export interface ImportPreviewRow {
  leadId: string; company: string; stage: string; nextFollowUp: string;
  action: "insert" | "update" | "skip"; issues: string[];
}
export interface ImportResponse {
  fileName: string; rowsSeen: number; toInsert: number; toUpdate: number; toSkip: number;
  preview: boolean; rows?: ImportPreviewRow[];
  inserted?: number; updated?: number; skipped?: number; committed?: boolean;
}

export const api = {
  me: () => apiFetch<MeResponse>("/api/auth/me"),
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  audit: () => apiFetch<AuditResponse>("/api/leads/audit"),
  lead: (id: string) => apiFetch<LeadResponse>(`/api/leads/${encodeURIComponent(id)}`),
  patchLead: (id: string, patch: { stage?: string; nextFollowUp?: string; notes?: string }) =>
    apiFetch<{ ok: boolean; leadId: string }>(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  email: (leadId: string) =>
    apiFetch<EmailResponse>("/api/ai/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    }),
  query: (question: string) =>
    apiFetch<QueryResponse>("/api/ai/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  importPreview: (csv: string, fileName: string) =>
    apiFetch<ImportResponse>(`/api/import?preview=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, fileName }),
    }),
  importCommit: (csv: string, fileName: string) =>
    apiFetch<ImportResponse>("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, fileName }),
    }),
  importLog: () => apiFetch<{ log: { file_name: string; rows_seen: number; rows_inserted: number; rows_updated: number; rows_skipped: number; imported_at: string; note: string }[] }>("/api/import/log"),
};
