// /api/leads — list, get, update, audit summary.
// Reads from D1, runs the normalization pipeline, returns NormalizedLead[].

import { Hono } from "hono";
import type { AppEnv } from "../index";
import { d1RowsToRawLeads, buildNormalizedLeads, buildAuditSummary, normalizeCompany, normalizeEmail, normalizePhone, parseDealValue } from "../lib/pipeline";
import type { NormalizedLead } from "../lib/types";

export const leadsRoute = new Hono<AppEnv>();

async function fetchAllLeads(env: AppEnv["Bindings"]): Promise<NormalizedLead[]> {
  const { results } = await env.DB.prepare(
    "SELECT lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes FROM leads ORDER BY lead_id"
  ).all();
  const raw = d1RowsToRawLeads(results as unknown as Parameters<typeof d1RowsToRawLeads>[0]);
  return buildNormalizedLeads(raw);
}

// GET /api/leads — all leads (normalized)
leadsRoute.get("/", async (c) => {
  const leads = await fetchAllLeads(c.env);
  return c.json({ leads });
});

// GET /api/leads/audit — full audit summary (KPIs, dup pairs, etc.)
leadsRoute.get("/audit", async (c) => {
  const leads = await fetchAllLeads(c.env);
  const audit = buildAuditSummary(leads);
  return c.json({ audit, leads });
});

// GET /api/leads/:id — single lead
leadsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes FROM leads WHERE lead_id = ?"
  ).bind(id).first();
  if (!row) return c.json({ error: `Lead ${id} not found.` }, 404);
  const leads = buildNormalizedLeads(d1RowsToRawLeads([row as never]));
  return c.json({ lead: leads[0] });
});

// PATCH /api/leads/:id — update stage / next follow-up / notes (optional Priority 1 feature)
leadsRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  let body: { stage?: string; nextFollowUp?: string; notes?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }

  const sets: string[] = [];
  const vals: (string | number)[] = [];
  if (body.stage) { sets.push("stage = ?"); vals.push(body.stage); }
  if (body.nextFollowUp !== undefined) { sets.push("next_follow_up = ?"); vals.push(body.nextFollowUp); }
  if (body.notes !== undefined) { sets.push("notes = ?"); vals.push(body.notes); }
  if (sets.length === 0) return c.json({ error: "No fields to update." }, 400);

  sets.push("updated_at = datetime('now')");
  // re-normalize the changed fields too
  if (body.stage) { /* stage normalized at read time */ }
  vals.push(id);
  await c.env.DB.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE lead_id = ?`).bind(...vals).run();
  return c.json({ ok: true, leadId: id });
});
