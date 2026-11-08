// BIAI Corporate Intelligence — data-cleaning plan logic (pure functions).
// Given the raw leads, each planner returns the exact changes it WOULD make.
// Routes apply those plans inside D1 and snapshot every affected row first,
// so any cleaning action can be undone from the Data Quality Center.

import { normalizeCompany } from "./pipeline";
import type { RawLead } from "./types";

// ---------- shared helpers ----------

/** Collapse runs of whitespace to one space and trim the ends. */
export function tidyText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Fields that are cleaned by the trim action (single-line fields). */
export const TRIM_FIELDS = [
  "company",
  "industry",
  "contact_name",
  "contact_role",
  "contact_email",
  "contact_phone",
  "source",
  "stage",
] as const;

export type TrimField = (typeof TRIM_FIELDS)[number];

const DB_TO_RAW: Record<TrimField, keyof RawLead> = {
  company: "company",
  industry: "industry",
  contact_name: "contactName",
  contact_role: "contactRole",
  contact_email: "contactEmail",
  contact_phone: "contactPhone",
  source: "source",
  stage: "stage",
};

// ---------- 1. trim extra spaces ----------

export interface TrimChange {
  leadId: string;
  fields: { column: TrimField; from: string; to: string }[];
}

export function planTrim(leads: RawLead[]): TrimChange[] {
  const changes: TrimChange[] = [];
  for (const l of leads) {
    const fields: TrimChange["fields"] = [];
    for (const col of TRIM_FIELDS) {
      const raw = (l[DB_TO_RAW[col]] ?? "") as string;
      const cleaned = tidyText(raw);
      if (cleaned !== raw) fields.push({ column: col, from: raw, to: cleaned });
    }
    if (fields.length > 0) changes.push({ leadId: l.leadId, fields });
  }
  return changes;
}

// ---------- 2. lowercase emails ----------

export interface EmailCasingChange {
  leadId: string;
  from: string;
  to: string;
}

export function planEmailCasing(leads: RawLead[]): EmailCasingChange[] {
  const changes: EmailCasingChange[] = [];
  for (const l of leads) {
    const raw = l.contactEmail ?? "";
    const cleaned = raw.toLowerCase();
    if (cleaned !== raw) changes.push({ leadId: l.leadId, from: raw, to: cleaned });
  }
  return changes;
}

// ---------- 3. auto-merge exact duplicate groups ----------

export interface ExactDupGroup {
  groupKey: string;
  keepId: string;
  mergeIds: string[];
  reason: string;
  members: { leadId: string; company: string }[];
}

/** How "complete" a record is — used to pick the survivor of a dup group. */
function richness(l: RawLead): number {
  let score = 0;
  if ((l.company ?? "").trim()) score += 2;
  if ((l.contactName ?? "").trim()) score += 2;
  if ((l.contactEmail ?? "").trim()) score += 2;
  if ((l.contactPhone ?? "").trim()) score += 2;
  if ((l.contactRole ?? "").trim()) score += 1;
  if ((l.industry ?? "").trim()) score += 1;
  if ((l.notes ?? "").trim()) score += 1;
  const dv = Number(String(l.dealValueRaw ?? "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(dv) && dv > 0) score += 2;
  return score;
}

export function planExactDupGroups(leads: RawLead[]): ExactDupGroup[] {
  const groups = new Map<string, RawLead[]>();
  for (const l of leads) {
    const k = normalizeCompany(l.company ?? "");
    if (!k) continue;
    const arr = groups.get(k) ?? [];
    arr.push(l);
    groups.set(k, arr);
  }

  const out: ExactDupGroup[] = [];
  for (const [groupKey, members] of groups) {
    if (members.length < 2) continue;
    // survivor = richest record; ties broken by lowest lead id (stable, auditable)
    const sorted = [...members].sort((a, b) => {
      const d = richness(b) - richness(a);
      if (d !== 0) return d;
      return a.leadId < b.leadId ? -1 : 1;
    });
    const keep = sorted[0];
    const rest = sorted.slice(1);
    out.push({
      groupKey,
      keepId: keep.leadId,
      mergeIds: rest.map((r) => r.leadId),
      reason: `${members.length} leads share the normalized company name "${groupKey}"`,
      members: members.map((m) => ({ leadId: m.leadId, company: m.company })),
    });
  }
  return out.sort((a, b) => (a.keepId < b.keepId ? -1 : 1));
}

// ---------- 4. field-fill used by merge ----------

/**
 * Compute the merged row for a keep+absorb pair. Empty fields on the kept row
 * are filled from the absorbed record; notes are appended (never overwritten);
 * the richer deal value wins when the kept one is empty/zero.
 */
export function computeMergedRow(keep: RawLead, absorb: RawLead): RawLead {
  const pick = (a: string, b: string): string => {
    const ta = tidyText(a ?? "");
    return ta ? a : (b ?? a);
  };
  const merged: RawLead = {
    leadId: keep.leadId,
    company: pick(keep.company, absorb.company),
    industry: pick(keep.industry, absorb.industry),
    contactName: pick(keep.contactName, absorb.contactName),
    contactRole: pick(keep.contactRole, absorb.contactRole),
    contactEmail: pick(keep.contactEmail, absorb.contactEmail),
    contactPhone: pick(keep.contactPhone, absorb.contactPhone),
    source: pick(keep.source, absorb.source),
    stage: keep.stage, // pipeline position of the KEPT record always wins
    dealValueRaw: keep.dealValueRaw,
    lastContact: maxDate(keep.lastContact, absorb.lastContact),
    nextFollowUp: keep.nextFollowUp || absorb.nextFollowUp,
    notes: mergeNotes(keep.notes, absorb.notes, absorb.leadId),
  };

  // deal value: keep the larger parsed value (a duplicate entry may carry the real number)
  const kv = Number(String(keep.dealValueRaw ?? "").replace(/[^0-9.]/g, "")) || 0;
  const av = Number(String(absorb.dealValueRaw ?? "").replace(/[^0-9.]/g, "")) || 0;
  if (av > kv) merged.dealValueRaw = absorb.dealValueRaw;

  return merged;
}

function maxDate(a: string, b: string): string {
  const ta = (a ?? "").trim();
  const tb = (b ?? "").trim();
  if (!ta) return tb;
  if (!tb) return ta;
  return ta >= tb ? ta : tb;
}

function mergeNotes(keepNotes: string, absorbNotes: string, absorbId: string): string {
  const k = (keepNotes ?? "").trim();
  const a = (absorbNotes ?? "").trim();
  if (!a) return keepNotes ?? "";
  if (!k) return a;
  if (k.toLowerCase() === a.toLowerCase()) return k;
  return `${k}\n[Merged from ${absorbId}] ${a}`;
}
