// /api/leads — list, get, update, audit summary.
// Reads from D1, runs the normalization pipeline, returns NormalizedLead[].

import { Hono } from "hono";
import type { AppEnv } from "../index";
import { d1RowsToRawLeads, buildNormalizedLeads, buildAuditSummary, normalizeCompany, normalizeEmail, normalizePhone, parseDealValue } from "../lib/pipeline";
import { computeMergedRow } from "../lib/clean";
import { LEAD_COLS, fetchLeadRows, logCleanup, renormalizeLead, type LeadRow } from "../lib/db-utils";
import { todayUTC, type NormalizedLead } from "../lib/types";

export const leadsRoute = new Hono<AppEnv>();

function refDate(env: AppEnv["Bindings"]): string {
  return (env.REFERENCE_DATE as string) || todayUTC();
}

async function fetchAllLeads(env: AppEnv["Bindings"]): Promise<NormalizedLead[]> {
  const { results } = await env.DB.prepare(
    "SELECT lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes FROM leads ORDER BY lead_id"
  ).all();
  const raw = d1RowsToRawLeads(results as unknown as Parameters<typeof d1RowsToRawLeads>[0]);
  return buildNormalizedLeads(raw, refDate(env));
}

// GET /api/leads — all leads (normalized)
leadsRoute.get("/", async (c) => {
  const leads = await fetchAllLeads(c.env);
  return c.json({ leads });
});

// GET /api/leads/audit — full audit summary (KPIs, dup pairs, etc.)
leadsRoute.get("/audit", async (c) => {
  const leads = await fetchAllLeads(c.env);
  const audit = buildAuditSummary(leads, refDate(c.env));
  return c.json({ audit, leads });
});

// GET /api/leads/export.csv — download the cleaned pipeline as a spreadsheet.
// MUST be defined before /:id or Hono matches "export.csv" as a lead id.
leadsRoute.get("/export.csv", async (c) => {
  const leads = await fetchAllLeads(c.env);
  const header = [
    "lead id", "company", "industry", "contact name", "contact role",
    "contact email", "contact phone", "source", "stage", "deal value (BDT)",
    "last contact", "next follow-up", "follow-up status",
    "missing fields", "duplicate flags", "data-quality issues", "notes",
  ];
  const esc = (s: string) => {
    const needs = /[",\n]/.test(s);
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) => [
    l.leadId, l.company, l.industry, l.contactName, l.contactRole,
    l.contactEmail, l.contactPhone, l.source, l.stageNormalized, String(l.dealValue),
    l.lastContact, l.nextFollowUp,
    l.isOverdue ? "overdue" : (l.isTerminal ? "terminal" : (l.nextFollowUpDate ? "upcoming" : "no follow-up")),
    l.missingFields.join("; "),
    l.duplicateLinks.map((d) => `${d.kind} of ${d.partnerIds.join(",")}`).join("; "),
    l.issues.map((i) => i.type).join("; "),
    l.notes,
  ].map(esc).join(","));
  const csv = [header.map(esc).join(","), ...rows].join("\n");
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="biai-pipeline-cleaned.csv"`);
  return c.body(csv);
});

// GET /api/leads/:id — single lead
leadsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes FROM leads WHERE lead_id = ?"
  ).bind(id).first();
  if (!row) return c.json({ error: `Lead ${id} not found.` }, 404);
  const leads = buildNormalizedLeads(d1RowsToRawLeads([row as never]), refDate(c.env));
  return c.json({ lead: leads[0] });
});

// All raw fields that PATCH accepts (camelCase → column map).
const PATCH_FIELDS: Record<string, string> = {
  company: "company",
  industry: "industry",
  contactName: "contact_name",
  contactRole: "contact_role",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  source: "source",
  stage: "stage",
  dealValueRaw: "deal_value_raw",
  lastContact: "last_contact",
  nextFollowUp: "next_follow_up",
  notes: "notes",
};

// PATCH /api/leads/:id — edit any raw field. The pre-edit row is snapshotted
// into cleanup_log so the edit can be undone from the Data Quality Center.
leadsRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }

  const sets: string[] = [];
  const vals: (string | number)[] = [];
  for (const [key, column] of Object.entries(PATCH_FIELDS)) {
    if (body[key] === undefined) continue;
    const v = String(body[key] ?? "");
    // light validation: email-ish values must contain @ when non-empty
    if (key === "contactEmail" && v.trim() && !v.includes("@")) {
      return c.json({ error: `"${v}" doesn't look like an email address.` }, 400);
    }
    // dates must be empty or valid ISO yyyy-mm-dd
    if ((key === "lastContact" || key === "nextFollowUp") && v.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
      return c.json({ error: `${key} must be an ISO date (yyyy-mm-dd) or empty.` }, 400);
    }
    sets.push(`${column} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update." }, 400);

  const existing = await c.env.DB.prepare(`SELECT ${LEAD_COLS} FROM leads WHERE lead_id = ?`).bind(id).first();
  if (!existing) return c.json({ error: `Lead ${id} not found.` }, 404);

  // snapshot BEFORE the edit (for undo)
  const logId = await logCleanup(c.env.DB, {
    action: "edit",
    summary: `edited ${sets.length} field(s) on ${id}`,
    targetIds: [id],
    snapshot: [existing as unknown as LeadRow],
    performedBy: c.get("user")?.name,
  });

  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE lead_id = ?`).bind(...vals, id).run();
  // keep the normalized helper columns in sync with the new raw values
  await renormalizeLead(c.env.DB, id);

  return c.json({ ok: true, leadId: id, logId });
});

// DELETE /api/leads/:id — remove a lead. Snapshotted first → undoable.
leadsRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT ${LEAD_COLS} FROM leads WHERE lead_id = ?`).bind(id).first();
  if (!existing) return c.json({ error: `Lead ${id} not found.` }, 404);

  const logId = await logCleanup(c.env.DB, {
    action: "delete",
    summary: `deleted ${id}`,
    targetIds: [id],
    deletedIds: [id],
    snapshot: [existing as unknown as LeadRow],
    performedBy: c.get("user")?.name,
  });

  await c.env.DB.prepare("DELETE FROM leads WHERE lead_id = ?").bind(id).run();
  return c.json({ ok: true, deletedId: id, logId });
});

// POST /api/leads/merge — merge duplicate { keepId, mergeId } into one record.
// Empty fields on the kept lead are filled from the absorbed one, notes are
// appended (never overwritten), the larger deal value wins. The absorbed row
// is deleted. Both pre-merge rows are snapshotted → fully undoable.
leadsRoute.post("/merge", async (c) => {
  let body: { keepId?: string; mergeId?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  const keepId = (body.keepId ?? "").trim();
  const mergeId = (body.mergeId ?? "").trim();
  if (!keepId || !mergeId) return c.json({ error: "keepId and mergeId are required." }, 400);
  if (keepId === mergeId) return c.json({ error: "Cannot merge a lead into itself." }, 400);

  const rows = await fetchLeadRows(c.env.DB, [keepId, mergeId]);
  const keepRow = rows.find((r) => r.lead_id === keepId);
  const mergeRow = rows.find((r) => r.lead_id === mergeId);
  if (!keepRow || !mergeRow) return c.json({ error: "One or both leads were not found." }, 404);

  const toRaw = (r: typeof keepRow) => ({
    leadId: r.lead_id,
    company: r.company ?? "",
    industry: r.industry ?? "",
    contactName: r.contact_name ?? "",
    contactRole: r.contact_role ?? "",
    contactEmail: r.contact_email ?? "",
    contactPhone: r.contact_phone ?? "",
    source: r.source ?? "",
    stage: r.stage ?? "",
    dealValueRaw: r.deal_value_raw ?? "",
    lastContact: r.last_contact ?? "",
    nextFollowUp: r.next_follow_up ?? "",
    notes: r.notes ?? "",
  });

  const merged = computeMergedRow(toRaw(keepRow), toRaw(mergeRow));

  const logId = await logCleanup(c.env.DB, {
    action: "merge",
    summary: `merged ${mergeId} into ${keepId}`,
    targetIds: [keepId, mergeId],
    deletedIds: [mergeId],
    snapshot: [keepRow, mergeRow] as unknown as LeadRow[],
    performedBy: c.get("user")?.name,
  });

  await c.env.DB.prepare(
    `UPDATE leads SET company=?, industry=?, contact_name=?, contact_role=?, contact_email=?, contact_phone=?,
       source=?, stage=?, deal_value_raw=?, last_contact=?, next_follow_up=?, notes=?, updated_at=datetime('now')
     WHERE lead_id=?`,
  )
    .bind(
      merged.company, merged.industry, merged.contactName, merged.contactRole, merged.contactEmail,
      merged.contactPhone, merged.source, merged.stage, merged.dealValueRaw, merged.lastContact,
      merged.nextFollowUp, merged.notes, keepId,
    )
    .run();
  await renormalizeLead(c.env.DB, keepId);
  await c.env.DB.prepare("DELETE FROM leads WHERE lead_id = ?").bind(mergeId).run();

  // return the fresh normalized kept lead for immediate UI feedback
  const fresh = await c.env.DB.prepare(`SELECT ${LEAD_COLS} FROM leads WHERE lead_id = ?`).bind(keepId).first();
  const leads = buildNormalizedLeads(d1RowsToRawLeads([fresh as never]), refDate(c.env));
  return c.json({ ok: true, kept: keepId, merged: mergeId, logId, lead: leads[0] });
});
