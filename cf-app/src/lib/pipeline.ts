// BIAI Corporate Intelligence — Data pipeline (Worker version).
// Pure functions only — no filesystem. D1 rows are converted to RawLead[],
// then the same normalization/dedup/date/overdue/audit logic runs on them.
// Numbers match the Python audit (scripts/audit.py) exactly.

import { parseCSVWithHeader } from "./csv";
import {
  ALL_STAGES,
  PIPELINE_STAGES,
  REFERENCE_DATE,
  TERMINAL_STAGES,
  type AuditSummary,
  type DataQualityIssue,
  type DuplicateLink,
  type NormalizedLead,
  type RawLead,
  type Stage,
  type StageSummary,
} from "./types";

// ---------- normalization helpers (identical to the Next.js pipeline) ----------

export function normalizeCompany(name: string): string {
  if (!name) return "";
  let s = name.toLowerCase().trim();
  s = s.replace(/\s+/g, " ");
  const suffixes = [" ltd.", " ltd", " limited", " co.", " co", " company", " group", " industries", " works"];
  for (const suf of suffixes) {
    if (s.endsWith(suf)) { s = s.slice(0, -suf.length).trim(); break; }
  }
  s = s.replace(/[^a-z0-9 ]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "");
}

export function parseDate(raw: string): string | null | "INVALID" {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "INVALID";
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "INVALID";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "INVALID";
  return s;
}

export function normalizeStage(raw: string): Stage {
  const s = (raw || "").trim();
  if ((ALL_STAGES as readonly string[]).includes(s)) return s as Stage;
  const found = (ALL_STAGES as readonly string[]).find((x) => x.toLowerCase() === s.toLowerCase());
  return (found as Stage) ?? "New";
}

export function parseDealValue(raw: string): number {
  const s = (raw || "").trim().replace(/[, ]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ---------- missing-field detection ----------

const REQUIRED_CONTACT_FIELDS: { key: keyof RawLead; label: string }[] = [
  { key: "contactName", label: "contact name" },
  { key: "contactEmail", label: "contact email" },
  { key: "contactPhone", label: "contact phone" },
  { key: "company", label: "company" },
  { key: "contactRole", label: "contact role" },
];

export function findMissingFields(raw: RawLead): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_CONTACT_FIELDS) {
    if (!(raw[f.key] || "").trim()) missing.push(f.label);
  }
  return missing;
}

// ---------- overdue ----------

export function computeOverdue(followUpDate: string | null | "INVALID", stage: Stage): { isOverdue: boolean; reason: string } {
  if (TERMINAL_STAGES.includes(stage as never)) return { isOverdue: false, reason: "terminal-stage" };
  if (followUpDate === null) return { isOverdue: false, reason: "no-followup" };
  if (followUpDate === "INVALID") return { isOverdue: false, reason: "invalid-date" };
  if (followUpDate < REFERENCE_DATE) return { isOverdue: true, reason: "before-reference" };
  return { isOverdue: false, reason: "on-or-after-reference" };
}

// ---------- duplicate detection ----------

interface DupPair { a: string; b: string; kind: "exact" | "potential"; reason: string; }

export function detectDuplicatePairs(leads: RawLead[]): DupPair[] {
  const pairs: DupPair[] = [];
  const seen = new Set<string>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const byCompany = new Map<string, RawLead[]>();
  for (const l of leads) {
    const k = normalizeCompany(l.company);
    if (!k) continue;
    const arr = byCompany.get(k) ?? [];
    arr.push(l);
    byCompany.set(k, arr);
  }
  for (const arr of byCompany.values()) {
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const A = arr[i], B = arr[j];
        const kk = key(A.leadId, B.leadId);
        if (seen.has(kk)) continue;
        seen.add(kk);
        const sameEmail = normalizeEmail(A.contactEmail) && normalizeEmail(A.contactEmail) === normalizeEmail(B.contactEmail);
        const samePhone = normalizePhone(A.contactPhone) && normalizePhone(A.contactPhone) === normalizePhone(B.contactPhone);
        pairs.push({ a: A.leadId, b: B.leadId, kind: "exact", reason: `Identical normalized company name "${normalizeCompany(A.company)}"${sameEmail ? "; same email" : ""}${samePhone ? "; same phone" : ""}.` });
      }
    }
  }
  for (let i = 0; i < leads.length; i++) {
    for (let j = i + 1; j < leads.length; j++) {
      const A = leads[i], B = leads[j];
      const kk = key(A.leadId, B.leadId);
      if (seen.has(kk)) continue;
      const eA = normalizeEmail(A.contactEmail), eB = normalizeEmail(B.contactEmail);
      const pA = normalizePhone(A.contactPhone), pB = normalizePhone(B.contactPhone);
      const sameEmail = !!eA && eA === eB;
      const samePhone = !!pA && pA === pB;
      const sameName = !!A.contactName && A.contactName.toLowerCase() === B.contactName.toLowerCase();
      const diffCompany = normalizeCompany(A.company) !== normalizeCompany(B.company);
      if ((sameEmail || samePhone) && diffCompany) {
        seen.add(kk);
        const idParts: string[] = [];
        if (sameEmail) idParts.push("same email");
        if (samePhone) idParts.push("same phone");
        if (sameName) idParts.push("same contact name");
        pairs.push({ a: A.leadId, b: B.leadId, kind: "potential", reason: `Different company name ("${A.company}" vs "${B.company}") but same contact identity (${idParts.join(", ")}).` });
      }
    }
  }
  return pairs;
}

// ---------- build normalized leads ----------

export function buildNormalizedLeads(rawLeads: RawLead[]): NormalizedLead[] {
  const dupPairs = detectDuplicatePairs(rawLeads);
  const dupMap = new Map<string, DuplicateLink[]>();
  for (const p of dupPairs) {
    const groupKey = `dup-${p.kind}-${[p.a, p.b].sort().join("-")}`;
    dupMap.set(p.a, [...(dupMap.get(p.a) ?? []), { groupKey, kind: p.kind, partnerIds: [p.b], reason: p.reason }]);
    dupMap.set(p.b, [...(dupMap.get(p.b) ?? []), { groupKey, kind: p.kind, partnerIds: [p.a], reason: p.reason }]);
  }

  return rawLeads.map((raw) => {
    const stage = normalizeStage(raw.stage);
    const lastD = parseDate(raw.lastContact);
    const followD = parseDate(raw.nextFollowUp);
    const dealValue = parseDealValue(raw.dealValueRaw);
    const missingFields = findMissingFields(raw);
    const { isOverdue, reason } = computeOverdue(followD, stage);
    const issues: DataQualityIssue[] = [];
    const links = dupMap.get(raw.leadId) ?? [];

    for (const l of links) {
      issues.push({ type: l.kind === "exact" ? "duplicate_exact" : "duplicate_potential", message: l.reason, severity: "warning" });
    }
    for (const f of missingFields) {
      issues.push({ type: "missing_contact", field: f, message: `Missing ${f}.`, severity: "error" });
    }
    if (lastD === "INVALID") issues.push({ type: "invalid_date", field: "last contact", message: `last contact "${raw.lastContact}" is not a valid date.`, severity: "error" });
    if (followD === "INVALID") issues.push({ type: "invalid_date", field: "next follow-up", message: `next follow-up "${raw.nextFollowUp}" is not a valid date.`, severity: "error" });
    if (typeof lastD === "string" && lastD !== "INVALID" && typeof followD === "string" && followD !== "INVALID" && followD < lastD) {
      issues.push({ type: "date_order_violation", message: `Next follow-up (${raw.nextFollowUp}) is before last contact (${raw.lastContact}).`, severity: "error" });
    }
    if (isOverdue) {
      issues.push({ type: "overdue", field: "next follow-up", message: `Follow-up overdue (was due ${raw.nextFollowUp}, before reference date ${REFERENCE_DATE}).`, severity: "warning" });
    }
    const email = raw.contactEmail.trim();
    if (email.includes("@")) {
      const domain = email.split("@")[1] ?? "";
      if (/[A-Z]/.test(domain)) {
        issues.push({ type: "email_casing", field: "contact email", message: `Email domain "${domain}" contains uppercase letters — likely a typo.`, severity: "info" });
      }
    }
    const notesLower = raw.notes.toLowerCase();
    if (notesLower.includes("duplicate")) issues.push({ type: "note_flag", message: "Notes flag this record as a duplicate.", severity: "info" });
    if (notesLower.includes("data error")) issues.push({ type: "note_flag", message: "Notes flag a data error.", severity: "info" });

    return {
      ...raw,
      dealValue,
      normalizedCompany: normalizeCompany(raw.company),
      normalizedEmail: normalizeEmail(raw.contactEmail),
      normalizedPhone: normalizePhone(raw.contactPhone),
      lastContactDate: typeof lastD === "string" && lastD !== "INVALID" ? lastD : null,
      nextFollowUpDate: typeof followD === "string" && followD !== "INVALID" ? followD : null,
      stageNormalized: stage,
      isTerminal: TERMINAL_STAGES.includes(stage as never),
      isOverdue,
      overdueReason: reason,
      missingFields,
      issues,
      duplicateLinks: links,
      hasIssues: issues.length > 0,
    };
  });
}

// ---------- audit summary ----------

export function buildAuditSummary(leads: NormalizedLead[]): AuditSummary {
  const stageSummaries: StageSummary[] = ALL_STAGES.map((stage) => {
    const inStage = leads.filter((l) => l.stageNormalized === stage);
    return { stage, count: inStage.length, value: inStage.reduce((s, l) => s + l.dealValue, 0), isTerminal: TERMINAL_STAGES.includes(stage as never) };
  });
  const totalPipelineValueActive = PIPELINE_STAGES.reduce((s, st) => s + (stageSummaries.find((x) => x.stage === st)?.value ?? 0), 0);
  const totalPipelineValueAll = stageSummaries.reduce((s, x) => s + x.value, 0);
  const exactPairs: [string, string][] = [];
  const potentialPairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const l of leads) {
    for (const link of l.duplicateLinks) {
      for (const p of link.partnerIds) {
        const kk = l.leadId < p ? `${l.leadId}|${p}` : `${p}|${l.leadId}`;
        if (seen.has(kk)) continue;
        seen.add(kk);
        (link.kind === "exact" ? exactPairs : potentialPairs).push([l.leadId, p]);
      }
    }
  }
  const missingContactLeadIds = leads.filter((l) => l.missingFields.length > 0).map((l) => l.leadId);
  const dateOrderViolationLeadIds = leads.filter((l) => l.issues.some((i) => i.type === "date_order_violation")).map((l) => l.leadId);
  const overdueLeadIds = leads.filter((l) => l.isOverdue).map((l) => l.leadId);
  const paidSummary = stageSummaries.find((s) => s.stage === "Paid")!;
  const proposalSummary = stageSummaries.find((s) => s.stage === "Proposal")!;
  const flaggedLeadIds = leads.filter((l) => l.hasIssues).map((l) => l.leadId);
  const uniqueCompaniesNormalized = new Set(leads.map((l) => l.normalizedCompany)).size;

  return {
    referenceDate: REFERENCE_DATE,
    totalRecords: leads.length,
    uniqueCompaniesNormalized,
    exactDuplicatePairs: exactPairs,
    potentialDuplicatePairs: potentialPairs,
    missingContactLeadIds,
    dateOrderViolationLeadIds,
    overdueLeadIds,
    stageSummaries,
    totalPipelineValueActive,
    totalPipelineValueAll,
    paidCount: paidSummary.count,
    paidValue: paidSummary.value,
    proposalCount: proposalSummary.count,
    proposalValue: proposalSummary.value,
    flaggedLeadIds,
  };
}

// ---------- D1 row -> RawLead converter ----------

interface D1LeadRow {
  lead_id: string;
  company: string;
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
}

export function d1RowsToRawLeads(rows: D1LeadRow[]): RawLead[] {
  return rows.map((r) => ({
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
  }));
}

// ---------- CSV text -> RawLead[] (for the import flow) ----------

export function csvTextToRawLeads(csvText: string): RawLead[] {
  const rows = parseCSVWithHeader<Record<string, string>>(csvText);
  return rows.map((r) => ({
    leadId: (r["lead id"] ?? r["lead_id"] ?? "").trim(),
    company: (r["company"] ?? "").trim(),
    industry: (r["industry"] ?? "").trim(),
    contactName: (r["contact name"] ?? r["contact_name"] ?? "").trim(),
    contactRole: (r["contact role"] ?? r["contact_role"] ?? "").trim(),
    contactEmail: (r["contact email"] ?? r["contact_email"] ?? "").trim(),
    contactPhone: (r["contact phone"] ?? r["contact_phone"] ?? "").trim(),
    source: (r["source"] ?? "").trim(),
    stage: (r["stage"] ?? "").trim(),
    dealValueRaw: (r["deal value (BDT)"] ?? r["deal_value"] ?? "").trim(),
    lastContact: (r["last contact"] ?? r["last_contact"] ?? "").trim(),
    nextFollowUp: (r["next follow-up"] ?? r["next_follow_up"] ?? "").trim(),
    notes: (r["notes"] ?? "").trim(),
  }));
}
