// /api/clean — one-click data cleaning: preview, apply, undo, history.
// Every apply snapshots the affected rows BEFORE writing, so any action
// (and any combination) can be undone with one click from the UI.

import { Hono } from "hono";
import type { AppEnv } from "../index";
import { d1RowsToRawLeads } from "../lib/pipeline";
import {
  planTrim,
  planEmailCasing,
  planExactDupGroups,
  computeMergedRow,
  type TrimChange,
  type EmailCasingChange,
  type ExactDupGroup,
} from "../lib/clean";
import { fetchLeadRows, logCleanup, renormalizeLead, undoFromSnapshot } from "../lib/db-utils";
import { todayUTC } from "../lib/types";

export const cleanRoute = new Hono<AppEnv>();

function refDate(env: AppEnv["Bindings"]): string {
  return (env.REFERENCE_DATE as string) || todayUTC();
}
void refDate; // reserved for future date-aware cleaning rules

async function allRawLeads(env: AppEnv["Bindings"]) {
  const { results } = await env.DB.prepare(
    "SELECT lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes FROM leads ORDER BY lead_id",
  ).all();
  return d1RowsToRawLeads(results as unknown as Parameters<typeof d1RowsToRawLeads>[0]);
}

const ACTION_IDS = ["trim_spaces", "lowercase_emails", "merge_exact_duplicates"] as const;
type ActionId = (typeof ACTION_IDS)[number];

const ACTION_META: Record<ActionId, { label: string; description: string }> = {
  trim_spaces: {
    label: "Trim extra spaces",
    description:
      "Removes leading/trailing spaces and collapses double spaces in company, contact and other text fields.",
  },
  lowercase_emails: {
    label: "Lowercase email addresses",
    description:
      "Emails are case-insensitive; MIXED CASE addresses are normalized to lowercase so filters and duplicate detection match reliably.",
  },
  merge_exact_duplicates: {
    label: "Auto-merge exact duplicate companies",
    description:
      "For each company appearing more than once: keeps the most complete record, fills its empty fields from the duplicates, keeps the larger deal value, appends their notes — then deletes the duplicate rows.",
  },
};

// GET /api/clean/preview — what each action WOULD change (no writes).
cleanRoute.get("/preview", async (c) => {
  const raw = await allRawLeads(c.env);
  const trims = planTrim(raw);
  const emails = planEmailCasing(raw);
  const dupGroups = planExactDupGroups(raw);

  const actions = [
    {
      id: "trim_spaces" as const,
      ...ACTION_META.trim_spaces,
      affected: trims.length,
      rows: trims.map((t: TrimChange) => ({
        leadId: t.leadId,
        detail: t.fields.map((f) => `${f.column}: "${f.from}" → "${f.to}"`).join(" · "),
      })),
    },
    {
      id: "lowercase_emails" as const,
      ...ACTION_META.lowercase_emails,
      affected: emails.length,
      rows: emails.map((e: EmailCasingChange) => ({
        leadId: e.leadId,
        detail: `${e.from} → ${e.to}`,
      })),
    },
    {
      id: "merge_exact_duplicates" as const,
      ...ACTION_META.merge_exact_duplicates,
      affected: dupGroups.reduce((n, g) => n + g.mergeIds.length, 0),
      rows: dupGroups.map((g: ExactDupGroup) => ({
        leadId: g.keepId,
        detail: `keep ${g.keepId} · delete ${g.mergeIds.join(", ")} — ${g.reason}`,
      })),
    },
  ];

  return c.json({ actions });
});

// POST /api/clean/apply — run the selected actions. Body: { actions: ActionId[] }
cleanRoute.post("/apply", async (c) => {
  let body: { actions?: string[] };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  const wanted = (body.actions ?? []).filter((a): a is ActionId => (ACTION_IDS as readonly string[]).includes(a));
  if (wanted.length === 0) return c.json({ error: "No valid actions selected." }, 400);

  const env = c.env;

  // 1) Plan everything from the CURRENT data (pure, no writes yet).
  const raw = await allRawLeads(env);
  const byId = new Map(raw.map((l) => [l.leadId, l]));
  const trims = wanted.includes("trim_spaces") ? planTrim(raw) : [];
  const emails = wanted.includes("lowercase_emails") ? planEmailCasing(raw) : [];
  const dupGroups = wanted.includes("merge_exact_duplicates") ? planExactDupGroups(raw) : [];

  // 2) Snapshot every possibly-affected row BEFORE any write.
  const affectedIds = [
    ...new Set([
      ...trims.flatMap((t) => [t.leadId]),
      ...emails.map((e) => e.leadId),
      ...dupGroups.flatMap((g) => [g.keepId, ...g.mergeIds]),
    ]),
  ];
  const snapshot = await fetchLeadRows(env.DB, affectedIds);

  // 3) Apply.
  const touched = new Set<string>();
  const deleted: string[] = [];
  const perAction: { id: string; label: string; changed: number; deleted: number }[] = [];
  const summaryBits: string[] = [];

  if (trims.length) {
    for (const t of trims) {
      const sets = t.fields.map((f) => `${f.column} = ?`);
      const vals = t.fields.map((f) => f.to);
      await env.DB.prepare(`UPDATE leads SET ${sets.join(", ")}, updated_at = datetime('now') WHERE lead_id = ?`)
        .bind(...vals, t.leadId)
        .run();
      touched.add(t.leadId);
    }
    perAction.push({ id: "trim_spaces", label: ACTION_META.trim_spaces.label, changed: trims.length, deleted: 0 });
    summaryBits.push(`trimmed ${trims.length} lead(s)`);
  }

  if (emails.length) {
    for (const e of emails) {
      await env.DB.prepare("UPDATE leads SET contact_email = ?, updated_at = datetime('now') WHERE lead_id = ?")
        .bind(e.to, e.leadId)
        .run();
      touched.add(e.leadId);
    }
    perAction.push({ id: "lowercase_emails", label: ACTION_META.lowercase_emails.label, changed: emails.length, deleted: 0 });
    summaryBits.push(`lowercased ${emails.length} email(s)`);
  }

  if (dupGroups.length) {
    for (const g of dupGroups) {
      const keep = byId.get(g.keepId);
      if (!keep) continue;
      let merged = keep;
      for (const mid of g.mergeIds) {
        const absorb = byId.get(mid);
        if (!absorb) continue;
        merged = computeMergedRow(merged, absorb);
      }
      await env.DB.prepare(
        `UPDATE leads SET company=?, industry=?, contact_name=?, contact_role=?, contact_email=?, contact_phone=?,
           source=?, stage=?, deal_value_raw=?, last_contact=?, next_follow_up=?, notes=?, updated_at=datetime('now')
         WHERE lead_id=?`,
      )
        .bind(
          merged.company, merged.industry, merged.contactName, merged.contactRole, merged.contactEmail,
          merged.contactPhone, merged.source, merged.stage, merged.dealValueRaw, merged.lastContact,
          merged.nextFollowUp, merged.notes, g.keepId,
        )
        .run();
      for (const mid of g.mergeIds) {
        await env.DB.prepare("DELETE FROM leads WHERE lead_id = ?").bind(mid).run();
        deleted.push(mid);
      }
      touched.add(g.keepId);
    }
    perAction.push({
      id: "merge_exact_duplicates",
      label: ACTION_META.merge_exact_duplicates.label,
      changed: dupGroups.length,
      deleted: deleted.length,
    });
    summaryBits.push(`merged ${dupGroups.length} duplicate group(s)`);
  }

  // 4) Recompute normalized helper columns for every surviving touched row.
  for (const id of touched) await renormalizeLead(env.DB, id);

  // 5) Log with the pre-apply snapshot (enables one-click undo).
  const logId = await logCleanup(env.DB, {
    action: "bulk_clean",
    summary: summaryBits.length ? summaryBits.join(", ") : "nothing to change",
    targetIds: [...touched, ...deleted],
    deletedIds: deleted,
    snapshot,
    performedBy: c.get("user")?.name,
  });

  return c.json({
    ok: true,
    logId,
    perAction,
    updatedIds: [...touched],
    deletedIds: deleted,
    totalAffected: affectedIds.length,
  });
});

// GET /api/clean/log — recent cleanup history (newest first, 20 entries).
cleanRoute.get("/log", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, action, summary, target_ids, deleted_ids, created_at FROM cleanup_log ORDER BY id DESC LIMIT 20",
  ).all();
  const log = (results ?? []).map((r) => {
    const row = r as { id: number; action: string; summary: string; target_ids: string; deleted_ids: string; created_at: string };
    return {
      id: row.id,
      action: row.action,
      summary: row.summary,
      targetIds: JSON.parse(row.target_ids || "[]") as string[],
      deletedIds: JSON.parse(row.deleted_ids || "[]") as string[],
      createdAt: row.created_at,
    };
  });
  return c.json({ log });
});

// POST /api/clean/undo — restore the pre-action snapshot. Body: { logId }
cleanRoute.post("/undo", async (c) => {
  let body: { logId?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  if (!body.logId) return c.json({ error: "logId is required." }, 400);

  const row = await c.env.DB.prepare("SELECT id, snapshot FROM cleanup_log WHERE id = ?")
    .bind(body.logId)
    .first<{ id: number; snapshot: string }>();
  if (!row) return c.json({ error: `Cleanup log ${body.logId} not found.` }, 404);

  const restored = await undoFromSnapshot(c.env.DB, row.snapshot);
  return c.json({ ok: true, restoredIds: restored });
});
