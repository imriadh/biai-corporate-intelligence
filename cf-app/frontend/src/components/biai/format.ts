// Formatting + small display helpers shared across all BIAI screens.

import type { NormalizedLead, Stage } from "@/lib/types";

export function fmtBDT(n: number): string {
  return new Intl.NumberFormat("en-US").format(n) + " BDT";
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const STAGE_COLORS: Record<Stage, { dot: string; badge: string; label: string }> = {
  New: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 border-slate-200", label: "New" },
  Contacted: { dot: "bg-brand", badge: "bg-brand-soft text-brand border-brand-muted", label: "Contacted" },
  Meeting: { dot: "bg-brand", badge: "bg-brand-soft text-brand border-brand-muted", label: "Meeting" },
  Proposal: { dot: "bg-status-warn", badge: "bg-amber-50 text-status-warn border-amber-200", label: "Proposal" },
  "Invoice sent": { dot: "bg-status-warn", badge: "bg-amber-50 text-status-warn border-amber-200", label: "Invoice sent" },
  Paid: { dot: "bg-status-paid", badge: "bg-emerald-50 text-status-paid border-emerald-200", label: "Paid" },
  Lost: { dot: "bg-status-lost", badge: "bg-rose-50 text-status-lost border-rose-200", label: "Lost" },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Owner inferred from source/contact (sample data has no explicit owner column). */
export function ownerFor(lead: NormalizedLead): string {
  // Deterministic pseudo-owner from source so the Owner filter is meaningful.
  const map: Record<string, string> = {
    "Cold email": "Tahsin R.",
    Referral: "Nadia K.",
    LinkedIn: "Arif M.",
    Event: "Nadia K.",
    "Website form": "Tahsin R.",
    "Facebook ad": "Arif M.",
    "Walk-in": "Sadia L.",
  };
  return map[lead.source] ?? "Unassigned";
}

export const ALL_OWNERS = ["Tahsin R.", "Nadia K.", "Arif M.", "Sadia L.", "Unassigned"];
