// /api/ai — email drafting + NL query.
// Uses the multi-provider chat() with Cloudflare Workers AI as primary.

import { Hono } from "hono";
import type { AppEnv } from "../index";
import { chat, extractJSON, type Env } from "../lib/ai";
import { EMAIL_SYSTEM_PROMPT, EMAIL_USER_TEMPLATE, leadEmailContext, QUERY_SYSTEM_PROMPT, QUERY_USER_TEMPLATE, queryContext, CHASE_PLAN_SYSTEM_PROMPT, chasePlanContext } from "../lib/prompts";
import { runDeterministicQuery, executeStructuredSpec, type QueryResult } from "../lib/query-engine";
import { d1RowsToRawLeads, buildNormalizedLeads, buildAuditSummary } from "../lib/pipeline";
import { todayUTC, type NormalizedLead } from "../lib/types";

export const aiRoute = new Hono<AppEnv>();

function refDate(env: Env): string {
  return (env.REFERENCE_DATE as string) || todayUTC();
}

async function loadDataset(env: Env): Promise<{ leads: NormalizedLead[]; audit: ReturnType<typeof buildAuditSummary> }> {
  const { results } = await env.DB.prepare(
    "SELECT lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes FROM leads ORDER BY lead_id"
  ).all();
  const rd = refDate(env);
  const leads = buildNormalizedLeads(d1RowsToRawLeads(results as never), rd);
  return { leads, audit: buildAuditSummary(leads, rd) };
}

function serializeRows(rows: QueryResult["rows"], columns: QueryResult["columns"]) {
  if (!rows || !columns) return [];
  return rows.map((l) => {
    const o: Record<string, string> = {};
    for (const c of columns) {
      const key = c.key as keyof NormalizedLead;
      if (c.key === "dealValue") o[c.label] = new Intl.NumberFormat("en-US").format(l.dealValue) + " BDT";
      else if (c.key === "issues") o[c.label] = l.issues.map((i) => i.type).join(", ");
      else if (c.key === "missingFields") o[c.label] = l.missingFields.join(", ");
      else o[c.label] = String(l[key] ?? "");
    }
    return o;
  });
}

// POST /api/ai/email { leadId } → { subject, body, provider, model, ms, gmailUrl }
aiRoute.post("/email", async (c) => {
  let body: { leadId?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  const leadId = (body.leadId ?? "").trim();
  if (!leadId) return c.json({ error: "leadId is required." }, 400);

  const { leads } = await loadDataset(c.env);
  const lead = leads.find((l) => l.leadId === leadId);
  if (!lead) return c.json({ error: `Lead ${leadId} not found.` }, 404);

  try {
    // Use the fast 8B model for email (1-2s vs 4-9s for 70B).
    // Plain-text format (not JSON) — the 8B handles plain text reliably.
    const result = await chat(c.env, [
      { role: "system", content: EMAIL_SYSTEM_PROMPT },
      { role: "user", content: EMAIL_USER_TEMPLATE(leadEmailContext(lead)) },
    ], { temperature: 0.5, maxTokens: 600, model: "@cf/meta/llama-3.1-8b-instruct-fast" });

    // Parse plain-text "Subject: ...\n\n<body>" format (no JSON needed)
    const raw = result.content.trim();
    let subject = "";
    let body = raw;
    const lines = raw.split("\n");
    const subjectLine = lines.find((l) => /^Subject:/i.test(l.trim()));
    if (subjectLine) {
      // Strip "Subject:" prefix (and any doubled prefix the model might add)
      subject = subjectLine.replace(/^Subject:\s*/i, "").replace(/^Subject:\s*/i, "").trim();
      const subjectIdx = lines.indexOf(subjectLine);
      // body = everything after the subject line, skipping the blank line after it
      body = lines.slice(subjectIdx + 1).join("\n").replace(/^\s*\n/, "").trim();
    } else {
      // fallback: no "Subject:" prefix — use first line as subject, rest as body
      subject = lines[0].trim();
      body = lines.slice(1).join("\n").trim();
    }
    if (!subject || !body) {
      return c.json({ error: "The model returned an incomplete response. Please try Regenerate.", provider: result.provider, model: result.model }, 502);
    }

    // Gmail compose URL — uses /u/0/ for the signed-in account (opens fast).
    const to = lead.contactEmail || "";
    const gmailUrl = `https://mail.google.com/mail/u/0/?tf=cm${to ? `&to=${encodeURIComponent(to)}` : ""}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return c.json({
      subject,
      body,
      provider: result.provider,
      model: result.model,
      ms: result.ms,
      to,
      gmailUrl,
      mailtoUrl,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error." }, 502);
  }
});

// POST /api/ai/query { question } → deterministic first, then LLM-assisted spec
aiRoute.post("/query", async (c) => {
  let body: { question?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  const question = (body.question ?? "").trim();
  if (!question) return c.json({ error: "question is required." }, 400);

  const { leads, audit } = await loadDataset(c.env);

  // 1) deterministic
  const det = runDeterministicQuery(question, leads, audit);
  if (det.matched) {
    return c.json({
      handledBy: "deterministic",
      intent: det.intent,
      summary: det.summary,
      scalar: det.scalar,
      scalarLabel: det.scalarLabel,
      columns: det.columns,
      table: serializeRows(det.rows, det.columns),
      rowCount: det.rows?.length ?? 0,
    });
  }

  // 2) LLM-assisted structured query spec
  try {
    const result = await chat(c.env, [
      { role: "system", content: QUERY_SYSTEM_PROMPT },
      { role: "user", content: QUERY_USER_TEMPLATE(question, queryContext()) },
    ], { temperature: 0, maxTokens: 400, jsonMode: true });

    let spec: { understood?: boolean; reason?: string; filter?: Parameters<typeof executeStructuredSpec>[0]["filter"]; sort?: Parameters<typeof executeStructuredSpec>[0]["sort"]; aggregate?: Parameters<typeof executeStructuredSpec>[0]["aggregate"]; limit?: number; human_label?: string };
    try { spec = extractJSON(result.content); }
    catch { return c.json({ handledBy: "llm", error: "The model could not produce a valid query spec.", provider: result.provider }, 502); }

    if (spec.understood === false) {
      return c.json({
        handledBy: "llm",
        understood: false,
        summary: spec.reason ?? "I could not map that question to the pipeline data. Try asking about stages, overdue deals, deal values, missing contacts, or duplicates.",
        suggestion: "Examples: 'Which deals are overdue?', 'Total value in Proposal stage', 'Which companies have missing contact details?', 'Show leads in Meeting stage', 'Which deals have the highest value?'",
        provider: result.provider,
      });
    }

    const executed = executeStructuredSpec({ filter: spec.filter, sort: spec.sort, aggregate: spec.aggregate, limit: spec.limit }, leads);
    return c.json({
      handledBy: "llm",
      understood: true,
      intent: executed.intent,
      humanLabel: spec.human_label ?? question,
      summary: executed.summary,
      scalar: executed.scalar,
      scalarLabel: executed.scalarLabel,
      columns: executed.columns,
      table: serializeRows(executed.rows, executed.columns),
      rowCount: executed.rows?.length ?? 0,
      provider: result.provider,
      model: result.model,
      spec,
    });
  } catch (err) {
    return c.json({
      handledBy: "llm",
      error: err instanceof Error ? err.message : "Unknown error.",
      suggestion: "AI provider unavailable. Deterministic questions still work — try 'Which deals are overdue?' or 'Total value in Proposal stage'.",
    }, 502);
  }
});

// POST /api/ai/chase-plan → structured action checklist (AI-generated from real overdue+upcoming leads)
interface ChasePlanItem { leadId: string; company: string; action: string; priority: string }
aiRoute.post("/chase-plan", async (c) => {
  const { leads } = await loadDataset(c.env);
  const today = refDate(c.env);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const overdue = leads
    .filter((l) => l.isOverdue)
    .sort((a, b) => (a.nextFollowUpDate ?? "").localeCompare(b.nextFollowUpDate ?? ""));
  const upcoming = leads
    .filter((l) => !l.isOverdue && !l.isTerminal && l.nextFollowUpDate && l.nextFollowUpDate >= today && l.nextFollowUpDate <= weekAhead)
    .sort((a, b) => (a.nextFollowUpDate ?? "").localeCompare(b.nextFollowUpDate ?? ""));

  if (overdue.length === 0 && upcoming.length === 0) {
    return c.json({ summary: "No overdue or upcoming follow-ups this week. You're all caught up.", items: [], overdue: 0, upcoming: 0, provider: "none" });
  }

  try {
    const result = await chat(c.env, [
      { role: "system", content: CHASE_PLAN_SYSTEM_PROMPT },
      { role: "user", content: chasePlanContext(overdue, upcoming) + `\n\nToday is ${today}. Write the chase plan now. Return STRICT JSON only.` },
    ], { temperature: 0.4, maxTokens: 800 });

    let parsed: { summary?: string; items?: ChasePlanItem[] };
    try {
      parsed = extractJSON<{ summary?: string; items?: ChasePlanItem[] }>(result.content);
    } catch {
      // fallback: return the raw text as the summary with no items
      return c.json({
        summary: result.content.slice(0, 300),
        items: [],
        overdue: overdue.length,
        upcoming: upcoming.length,
        provider: result.provider,
        model: result.model,
        ms: result.ms,
        warning: "The model returned a non-structured response; showing the text summary instead.",
      });
    }

    // Validate items: drop any with an unknown leadId (the model must not invent leads)
    const knownIds = new Set(leads.map((l) => l.leadId));
    const validItems = (parsed.items ?? []).filter((it) => knownIds.has(it.leadId));

    return c.json({
      summary: parsed.summary ?? "This week's chase plan",
      items: validItems,
      overdue: overdue.length,
      upcoming: upcoming.length,
      provider: result.provider,
      model: result.model,
      ms: result.ms,
    });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : "Unknown error.",
      overdue: overdue.length,
      upcoming: upcoming.length,
    }, 502);
  }
});
