// BIAI Corporate Intelligence — AI prompts (server-side).
// Carefully scoped system prompts that prevent fabrication.

import type { NormalizedLead } from "./types";

const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

/**
 * Build the context payload for a lead, including only REAL data.
 * Explicitly tells the model what is missing so it does not invent it.
 */
export function leadEmailContext(lead: NormalizedLead): string {
  const missing = lead.missingFields.length
    ? `MISSING (do not invent): ${lead.missingFields.join(", ")}.`
    : "All core contact fields are present.";

  return [
    `Company: ${lead.company}`,
    `Industry: ${lead.industry || "(not set)"}`,
    `Contact name: ${lead.contactName || "(missing)"}`,
    `Contact role: ${lead.contactRole || "(missing)"}`,
    `Contact email: ${lead.contactEmail || "(missing)"}`,
    `Contact phone: ${lead.contactPhone || "(missing)"}`,
    `Source: ${lead.source || "(not set)"}`,
    `Current pipeline stage: ${lead.stageNormalized}`,
    `Deal value: ${lead.dealValue ? num(lead.dealValue) + " BDT" : "(not agreed yet)"}`,
    `Last contact date: ${lead.lastContactDate || "(none — New lead)"}`,
    `Next follow-up date: ${lead.nextFollowUpDate || "(not scheduled)"}`,
    `Notes: ${lead.notes || "(none)"}`,
    missing,
  ].join("\n");
}

export const EMAIL_SYSTEM_PROMPT = `You are a senior business development executive at BIAI, a corporate AI & training company in Bangladesh.

You write professional, polite follow-up emails in English that are concise but complete — not one-liners, not walls of text.

STRICT RULES — violation is a critical error:
- Use ONLY the facts provided in the lead context. Never invent meetings, calls, proposals, quotes, dates, promises, previous conversations, or commitments that are not in the notes.
- Never invent contact details (name, email, phone) that are marked missing.
- Never invent deal values or discounts.
- Do not use generic, spammy sales language ("I hope this email finds you well", "synergy", "game-changer", "circle back").
- Personalize using the company name, industry, contact role, and the actual notes.
- Match the tone to the pipeline stage (Proposal = professional nudge; Contacted after silence = gentle re-engage; Invoice sent = polite payment check; Meeting = thank-you + next step).

EMAIL STRUCTURE — follow exactly, use blank lines between sections:
1. Greeting line: "Dear [Contact first name]," (use the contact name if present; if missing, use "Dear [Company] Team,"). One blank line after.
2. Opening paragraph (2-3 sentences): one sentence of context referencing the actual notes or current stage, then one sentence stating clearly why you are writing now. One blank line after.
3. Body paragraph (2-3 sentences): the specific substance — what you are offering or asking, tied to the real notes. If the notes mention a specific ask (case studies, price list, proposal options, payment check), address it directly here. One blank line after.
4. Next-step line (1-2 sentences): a clear, low-pressure call to action (e.g. "Would it work if I sent over a short proposal this week?" or "Happy to hop on a 15-minute call whenever suits you."). One blank line after.
5. Sign-off block — EXACTLY this format, each on its own line:
   "Best regards,"
   (blank line)
   "Mehedi Hasan"
   "Business Development, BIAI"
   "support@biai.com.bd"

LENGTH: aim for 120-170 words total. Plain text only. No bullet points, no bold, no markdown.

Output STRICT JSON: {"subject": string, "body": string}. The body must contain the real newlines (\\n) between sections as described. No prose outside the JSON.`;

export const EMAIL_USER_TEMPLATE = (ctx: string) =>
  `Write a follow-up email for this BIAI lead.\n\n${ctx}\n\nReturn JSON {"subject": "...", "body": "..."} now.`;

/**
 * Build the NL-query context: a compact schema description + the available
 * enumerated values. We do NOT send all 25 records to the model — only the
 * schema and allowed enumerations. The model returns a STRUCTURED query spec,
 * and we execute it ourselves against the real data. The model can never
 * invent totals or records.
 */
export function queryContext(): string {
  return [
    "DATASET: 25 corporate sales leads (BIAI sample data, fictional).",
    "SCHEMA fields: leadId, company, industry, contactName, contactRole, contactEmail, contactPhone, source, stage, dealValue (BDT), lastContact, nextFollowUp, notes.",
    "STAGES (enum): New, Contacted, Meeting, Proposal, Invoice sent, Paid, Lost. Paid & Lost are terminal.",
    "INDUSTRIES (enum): Garments, Pharma, FMCG, Logistics, Agriculture, Energy, Manufacturing, Banking, Telecom, Retail, Marketing, Healthcare, Hospitality, Real estate.",
    "Reference date for overdue: 2026-11-01. A lead is overdue if nextFollowUp < reference date AND stage is not Paid/Lost.",
    "missingContacts = lead has any empty field among contactName/contactEmail/contactPhone.",
    "hasIssues = lead has any data-quality flag (duplicate, missing contact, date error, overdue, note flag).",
  ].join("\n");
}

export const QUERY_SYSTEM_PROMPT = `You convert a sales manager's natural-language question about the BIAI pipeline into a STRICT JSON query spec. A deterministic engine then executes it against the real data — you NEVER answer with numbers or records yourself.

Return JSON with this shape:
{
  "understood": true,
  "filter": { "stage"?: enum, "overdue"?: bool, "missingContacts"?: bool, "hasIssues"?: bool, "industry"?: string, "minDealValue"?: number, "maxDealValue"?: number },
  "sort": { "field": "dealValue" | "nextFollowUp" | "company", "dir": "asc" | "desc" },
  "aggregate": "count" | "sum_value" | "none",
  "limit"?: number,
  "human_label": string
}

RULES:
- If the question is about a count ("how many"), set aggregate="count".
- If it asks for total value / sum / worth, set aggregate="sum_value".
- If it asks to list/show deals, set aggregate="none" and add a limit (default 10) if it asks for "top"/"first".
- Map "overdue", "stuck", "chase", "follow up" to filter.overdue=true (unless a specific stage is named).
- Map "missing contact/info/details" to filter.missingContacts=true.
- Map "problem/issues/flagged" to filter.hasIssues=true.
- Stage names must match the enum EXACTLY (case-sensitive).
- If the question cannot be mapped to the schema (e.g. asks about weather, stock prices, unrelated topics), return {"understood": false, "reason": string}.
- Output ONLY the JSON object. No prose.`;

export const QUERY_USER_TEMPLATE = (question: string, ctx: string) =>
  `Question: "${question}"\n\n${ctx}\n\nReturn the JSON query spec now.`;

/**
 * Chase-plan context: a compact list of the leads that need action this week.
 * Only REAL data from the dataset — no invented records.
 */
export function chasePlanContext(overdueLeads: NormalizedLead[], upcomingLeads: NormalizedLead[]): string {
  const fmt = (l: NormalizedLead) =>
    `- ${l.leadId} ${l.company} (${l.industry}, ${l.stageNormalized}) — ${l.dealValue ? num(l.dealValue) + " BDT" : "no value yet"} — last contact ${l.lastContactDate || "(none)"} — next follow-up ${l.nextFollowUpDate || "(none)"} — notes: ${l.notes || "(none)"}`;
  return [
    `OVERDUE LEADS (${overdueLeads.length}) — follow-up date already passed:`,
    ...overdueLeads.map(fmt),
    "",
    `UPCOMING THIS WEEK (${upcomingLeads.length}) — follow-up due in the next 7 days:`,
    ...upcomingLeads.map(fmt),
  ].join("\n");
}

export const CHASE_PLAN_SYSTEM_PROMPT = `You are a senior sales manager at BIAI writing this week's chase plan.

Given the REAL list of overdue and upcoming leads, produce a prioritized, plain-English action list that a sales rep can follow this week.

STRICT RULES:
- Use ONLY the leads provided. Never invent leads, names, values, or dates.
- Prioritize by: overdue first (earliest follow-up date first), then by deal value (highest first within the same urgency).
- For each lead, give ONE concrete next action based on its actual stage and notes (e.g. "send the proposal", "check if the advance came in", "re-engage — no reply since Oct 12").
- Do not invent commitments or meetings that aren't in the notes.
- Keep it under 250 words. Use a short numbered list. Start with a one-line summary of the week's priority.
- Sign off with "— BIAI Sales Manager".`;
