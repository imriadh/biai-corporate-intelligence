// /api/import — CSV upload + upsert (add new leads or update existing).
//
// Industry best practice implemented here:
//   1. Validate the CSV header has the required columns.
//   2. Parse + normalize each row (trim, compute comparison keys).
//   3. Dry-run preview (?preview=true) returns the diff without writing.
//   4. Upsert by lead_id (INSERT ... ON CONFLICT DO UPDATE) — preserves
//      existing records, updates changed fields, adds new leads.
//   5. Never deletes existing leads on import (append/upsert only).
//   6. Logs every import to import_log (file, rows seen/inserted/updated/skipped).
//   7. Future-dated rows (e.g. follow-ups 5 days ahead) are stored as-is;
//      the overdue engine handles them correctly (future dates are not overdue).
//
// This is how you keep the pipeline current: drop in a fresh CSV any time,
// same lead_ids get updated, new lead_ids get added, nothing is lost.

import { Hono } from "hono";
import type { AppEnv } from "../index";
import { csvTextToRawLeads, normalizeCompany, normalizeEmail, normalizePhone, parseDealValue, parseDate } from "../lib/pipeline";
import type { RawLead } from "../lib/types";

export const importRoute = new Hono<AppEnv>();

const REQUIRED_COLS = ["lead id", "company", "stage"];

interface ImportRow {
  leadId: string;
  raw: RawLead;
  issues: string[];
  action: "insert" | "update" | "skip";
}

// POST /api/import  body: { csv: string, fileName?: string }   ?preview=true for dry run
importRoute.post("/", async (c) => {
  let body: { csv?: string; fileName?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  const csvText = body.csv ?? "";
  if (!csvText.trim()) return c.json({ error: "CSV content is required." }, 400);
  const fileName = body.fileName ?? "upload.csv";
  const preview = c.req.query("preview") === "true";

  // parse
  let rawLeads: RawLead[];
  try { rawLeads = csvTextToRawLeads(csvText); }
  catch (e) { return c.json({ error: `CSV parse failed: ${e instanceof Error ? e.message : e}` }, 400); }

  if (rawLeads.length === 0) return c.json({ error: "No rows found in CSV." }, 400);

  // validate required columns / fields per row
  const rows: ImportRow[] = [];
  for (const raw of rawLeads) {
    const issues: string[] = [];
    if (!raw.leadId) issues.push("missing lead id");
    if (!raw.company) issues.push("missing company");
    if (!raw.stage) issues.push("missing stage");
    if (raw.lastContact && parseDate(raw.lastContact) === "INVALID") issues.push(`invalid last contact date "${raw.lastContact}"`);
    if (raw.nextFollowUp && parseDate(raw.nextFollowUp) === "INVALID") issues.push(`invalid next follow-up date "${raw.nextFollowUp}"`);
    rows.push({ leadId: raw.leadId || "(no id)", raw, issues, action: issues.length > 0 ? "skip" : "insert" });
  }

  // determine insert vs update by checking existing lead_ids
  const ids = rows.filter((r) => r.leadId !== "(no id)").map((r) => r.leadId);
  let existingIds = new Set<string>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await c.env.DB.prepare(`SELECT lead_id FROM leads WHERE lead_id IN (${placeholders})`).bind(...ids).all();
    existingIds = new Set((results as { lead_id: string }[]).map((r) => r.lead_id));
  }
  for (const r of rows) {
    if (r.action === "skip") continue;
    r.action = existingIds.has(r.leadId) ? "update" : "insert";
  }

  const summary = {
    fileName,
    rowsSeen: rows.length,
    toInsert: rows.filter((r) => r.action === "insert").length,
    toUpdate: rows.filter((r) => r.action === "update").length,
    toSkip: rows.filter((r) => r.action === "skip").length,
    preview,
  };

  // dry run — return the diff without writing
  if (preview) {
    return c.json({
      ...summary,
      rows: rows.map((r) => ({
        leadId: r.leadId,
        company: r.raw.company,
        stage: r.raw.stage,
        nextFollowUp: r.raw.nextFollowUp,
        action: r.action,
        issues: r.issues,
      })),
    });
  }

  // commit: upsert valid rows
  let inserted = 0, updated = 0, skipped = 0;
  const stmt = c.env.DB.prepare(
    `INSERT INTO leads (lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes, normalized_company, normalized_email, normalized_phone, deal_value, source_file, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(lead_id) DO UPDATE SET
       company=excluded.company, industry=excluded.industry, contact_name=excluded.contact_name, contact_role=excluded.contact_role,
       contact_email=excluded.contact_email, contact_phone=excluded.contact_phone, source=excluded.source, stage=excluded.stage,
       deal_value_raw=excluded.deal_value_raw, last_contact=excluded.last_contact, next_follow_up=excluded.next_follow_up, notes=excluded.notes,
       normalized_company=excluded.normalized_company, normalized_email=excluded.normalized_email, normalized_phone=excluded.normalized_phone,
       deal_value=excluded.deal_value, source_file=excluded.source_file, updated_at=datetime('now')`
  );

  for (const r of rows) {
    if (r.action === "skip") { skipped++; continue; }
    const raw = r.raw;
    await stmt.bind(
      raw.leadId, raw.company, raw.industry, raw.contactName, raw.contactRole, raw.contactEmail, raw.contactPhone,
      raw.source, raw.stage, raw.dealValueRaw, raw.lastContact, raw.nextFollowUp, raw.notes,
      normalizeCompany(raw.company), normalizeEmail(raw.contactEmail), normalizePhone(raw.contactPhone),
      parseDealValue(raw.dealValueRaw), fileName,
    ).run();
    if (r.action === "insert") inserted++; else updated++;
  }

  // log the import
  await c.env.DB.prepare(
    "INSERT INTO import_log (file_name, rows_seen, rows_inserted, rows_updated, rows_skipped, note) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(fileName, rows.length, inserted, updated, skipped, preview ? "preview only" : "committed").run();

  return c.json({ ...summary, inserted, updated, skipped, committed: true });
});

// GET /api/import/log — recent import history
importRoute.get("/log", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT file_name, rows_seen, rows_inserted, rows_updated, rows_skipped, imported_at, note FROM import_log ORDER BY imported_at DESC LIMIT 20"
  ).all();
  return c.json({ log: results });
});
