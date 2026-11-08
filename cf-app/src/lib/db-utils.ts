// BIAI Corporate Intelligence — D1 helpers for the data-cleaning feature.
// Every mutating action (edit / delete / merge / bulk clean) snapshots the
// full pre-action rows into cleanup_log first, so "Undo" can restore them.

import { normalizeCompany, normalizeEmail, normalizePhone, parseDealValue } from "./pipeline";

export const LEAD_COLS =
  "lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes";

export interface LeadRow {
  lead_id: string;
  company: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  stage: string | null;
  deal_value_raw: string | null;
  last_contact: string | null;
  next_follow_up: string | null;
  notes: string | null;
  [k: string]: unknown;
}

/** Fetch full rows (snapshot shape) for the given ids. */
export async function fetchLeadRows(db: D1Database, ids: string[]): Promise<LeadRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT ${LEAD_COLS} FROM leads WHERE lead_id IN (${placeholders})`)
    .bind(...ids)
    .all();
  return (results ?? []) as unknown as LeadRow[];
}

/** Recompute the normalized helper columns for one lead from its raw values. */
export async function renormalizeLead(db: D1Database, leadId: string): Promise<void> {
  const row = await db
    .prepare("SELECT company, contact_email, contact_phone, deal_value_raw FROM leads WHERE lead_id = ?")
    .bind(leadId)
    .first<LeadRow>();
  if (!row) return;
  await db
    .prepare("UPDATE leads SET normalized_company = ?, normalized_email = ?, normalized_phone = ?, deal_value = ? WHERE lead_id = ?")
    .bind(
      normalizeCompany(row.company ?? ""),
      normalizeEmail(row.contact_email ?? ""),
      normalizePhone(row.contact_phone ?? ""),
      parseDealValue(row.deal_value_raw ?? ""),
      leadId,
    )
    .run();
}

/** Write a cleanup_log entry with a full pre-action snapshot. Returns its id. */
export async function logCleanup(
  db: D1Database,
  entry: {
    action: string;
    summary: string;
    targetIds: string[];
    deletedIds?: string[];
    snapshot: LeadRow[];
    performedBy?: string;
  },
): Promise<number> {
  const res = await db
    .prepare(
      "INSERT INTO cleanup_log (action, summary, target_ids, deleted_ids, snapshot, performed_by) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      entry.action,
      entry.summary,
      JSON.stringify(entry.targetIds),
      JSON.stringify(entry.deletedIds ?? []),
      JSON.stringify(entry.snapshot),
      entry.performedBy ?? null,
    )
    .run();
  return res.meta.last_row_id as number;
}

/**
 * Undo a logged action: re-insert / restore every snapshotted row verbatim
 * (INSERT OR REPLACE resurrects deleted leads and reverts updated fields),
 * then recompute the normalized helper columns from the restored raw values.
 */
export async function undoFromSnapshot(db: D1Database, snapshotJson: string): Promise<string[]> {
  let snapshot: LeadRow[];
  try {
    snapshot = JSON.parse(snapshotJson) as LeadRow[];
  } catch {
    throw new Error("Corrupt cleanup log entry — cannot undo.");
  }
  if (!Array.isArray(snapshot) || snapshot.length === 0) return [];

  const restored: string[] = [];
  for (const row of snapshot) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO leads
           (lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone,
            source, stage, deal_value_raw, last_contact, next_follow_up, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(
        row.lead_id,
        row.company ?? "",
        row.industry ?? "",
        row.contact_name ?? "",
        row.contact_role ?? "",
        row.contact_email ?? "",
        row.contact_phone ?? "",
        row.source ?? "",
        row.stage ?? "",
        row.deal_value_raw ?? "",
        row.last_contact ?? "",
        row.next_follow_up ?? "",
        row.notes ?? "",
      )
      .run();
    await renormalizeLead(db, row.lead_id);
    restored.push(row.lead_id);
  }
  return restored;
}
