// BIAI Corporate Intelligence — Deterministic query engine.
// Handles the common natural-language questions with EXACT calculations
// computed from the actual dataset. No LLM is used for these — accuracy first.
//
// The AI analyst route uses this engine first; only when a question does not
// match a deterministic pattern does it fall back to the LLM parser, which
// returns a structured query spec (never invented records or totals).

import {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  type AuditSummary,
  type NormalizedLead,
  type Stage,
} from "./types";

export interface QueryResult {
  matched: boolean;
  intent: string;
  summary: string; // human-readable answer
  rows?: NormalizedLead[]; // matching leads
  scalar?: number; // a computed number (count / total value)
  scalarLabel?: string;
  columns?: { key: string; label: string }[]; // which fields to show in a table
  debug?: string;
}

const num = (n: number) => new Intl.NumberFormat("en-US").format(n);
const bdt = (n: number) => `${num(n)} BDT`;

// keyword tests
function hasAny(s: string, words: string[]): boolean {
  return words.some((w) => s.includes(w));
}

function detectStage(s: string): Stage | null {
  const lower = s.toLowerCase();
  // order matters: "invoice sent" before "invoice"
  if (lower.includes("invoice sent")) return "Invoice sent";
  if (lower.includes("invoice")) return "Invoice sent";
  if (lower.includes("proposal")) return "Proposal";
  if (lower.includes("meeting")) return "Meeting";
  if (lower.includes("contacted")) return "Contacted";
  if (/\bnew\b/.test(lower)) return "New";
  if (lower.includes("paid")) return "Paid";
  if (lower.includes("lost")) return "Lost";
  return null;
}

const LEAD_COLUMNS = [
  { key: "leadId", label: "Lead" },
  { key: "company", label: "Company" },
  { key: "contactName", label: "Contact" },
  { key: "stage", label: "Stage" },
  { key: "dealValue", label: "Value (BDT)" },
  { key: "nextFollowUp", label: "Next follow-up" },
];

export function runDeterministicQuery(
  question: string,
  leads: NormalizedLead[],
  audit: AuditSummary,
): QueryResult {
  const q = question.toLowerCase().trim();

  // --- overdue ---
  if (hasAny(q, ["overdue"]) && !hasAny(q, ["not overdue"])) {
    const rows = leads.filter((l) => l.isOverdue);
    return {
      matched: true,
      intent: "overdue",
      summary: `${rows.length} lead${rows.length === 1 ? "" : "s"} have an overdue follow-up (due before ${audit.referenceDate}, excluding Paid/Lost).`,
      rows,
      columns: LEAD_COLUMNS,
      scalar: rows.length,
      scalarLabel: "Overdue leads",
    };
  }

  // --- total value in <stage> ---
  if (
    (hasAny(q, ["total value", "total deal value", "sum", "value in", "deal value in"]) ||
      (hasAny(q, ["value", "worth"]) && hasAny(q, ["stage"]))) &&
    !hasAny(q, ["highest", "top", "biggest", "largest"])
  ) {
    const stage = detectStage(q);
    if (stage) {
      const inStage = leads.filter((l) => l.stageNormalized === stage);
      const total = inStage.reduce((s, l) => s + l.dealValue, 0);
      return {
        matched: true,
        intent: `total-value-${stage}`,
        summary: `${inStage.length} lead${inStage.length === 1 ? "" : "s"} in ${stage} stage, total value ${bdt(total)}.`,
        rows: inStage,
        columns: LEAD_COLUMNS,
        scalar: total,
        scalarLabel: `Total value in ${stage}`,
      };
    }
  }

  // --- missing contact details ---
  if (hasAny(q, ["missing contact", "missing info", "missing details", "no contact", "missing email", "missing phone", "missing name"])) {
    const rows = leads.filter((l) => l.missingFields.length > 0);
    return {
      matched: true,
      intent: "missing-contacts",
      summary: `${rows.length} lead${rows.length === 1 ? "" : "s"} have missing contact details.`,
      rows,
      columns: [
        { key: "leadId", label: "Lead" },
        { key: "company", label: "Company" },
        { key: "missingFields", label: "Missing" },
        { key: "stage", label: "Stage" },
      ],
      scalar: rows.length,
      scalarLabel: "Leads with missing contacts",
    };
  }

  // --- show leads in <stage> ---
  const stageMatch = detectStage(q);
  if (
    stageMatch &&
    hasAny(q, ["show", "list", "leads in", "deals in", "in the", "which are", "all leads", "all deals"])
  ) {
    const rows = leads.filter((l) => l.stageNormalized === stageMatch);
    return {
      matched: true,
      intent: `leads-in-${stageMatch}`,
      summary: `${rows.length} lead${rows.length === 1 ? "" : "s"} in ${stageMatch} stage.`,
      rows,
      columns: LEAD_COLUMNS,
      scalar: rows.length,
      scalarLabel: `Leads in ${stageMatch}`,
    };
  }

  // --- how many lost ---
  if (hasAny(q, ["how many"]) && hasAny(q, ["lost"])) {
    const rows = leads.filter((l) => l.stageNormalized === "Lost");
    return {
      matched: true,
      intent: "count-lost",
      summary: `${rows.length} deal${rows.length === 1 ? "" : "s"} are in the Lost stage.`,
      rows,
      columns: LEAD_COLUMNS,
      scalar: rows.length,
      scalarLabel: "Lost deals",
    };
  }

  // --- how many paid / won ---
  if (hasAny(q, ["how many"]) && hasAny(q, ["paid", "won", "closed"])) {
    const rows = leads.filter((l) => l.stageNormalized === "Paid");
    return {
      matched: true,
      intent: "count-paid",
      summary: `${rows.length} deal${rows.length === 1 ? "" : "s"} are Paid, totalling ${bdt(audit.paidValue)}.`,
      rows,
      columns: LEAD_COLUMNS,
      scalar: rows.length,
      scalarLabel: "Paid deals",
    };
  }

  // --- highest value / top deals ---
  if (hasAny(q, ["highest value", "highest deal", "top deal", "biggest", "largest", "most valuable", "top value"])) {
    const sorted = [...leads].sort((a, b) => b.dealValue - a.dealValue);
    const top = sorted.filter((l) => l.dealValue > 0).slice(0, 5);
    return {
      matched: true,
      intent: "highest-value",
      summary: `Top ${top.length} deals by value: ${top
        .map((l) => `${l.company} (${bdt(l.dealValue)})`)
        .join(", ")}.`,
      rows: top,
      columns: LEAD_COLUMNS,
      scalar: top[0]?.dealValue ?? 0,
      scalarLabel: "Highest deal value",
    };
  }

  // --- follow up first / chase first / prioritize ---
  if (hasAny(q, ["follow up first", "followup first", "chase first", "chase", "prioritize", "priority", "should we follow", "what should i do", "where do i start"])) {
    // prioritize: overdue first (earliest follow-up), then soonest upcoming, exclude terminal
    const active = leads.filter((l) => !l.isTerminal);
    const sorted = [...active].sort((a, b) => {
      const aDate = a.nextFollowUpDate ?? "9999-12-31";
      const bDate = b.nextFollowUpDate ?? "9999-12-31";
      return aDate.localeCompare(bDate);
    });
    const priority = sorted.slice(0, 8);
    const overdueCount = priority.filter((l) => l.isOverdue).length;
    return {
      matched: true,
      intent: "follow-up-first",
      summary: `${overdueCount} of the next ${priority.length} leads to action are overdue. Prioritized by soonest next follow-up date (terminal Paid/Lost excluded).`,
      rows: priority,
      columns: [
        { key: "leadId", label: "Lead" },
        { key: "company", label: "Company" },
        { key: "stage", label: "Stage" },
        { key: "nextFollowUp", label: "Next follow-up" },
        { key: "dealValue", label: "Value (BDT)" },
      ],
      scalar: overdueCount,
      scalarLabel: "Overdue in priority list",
    };
  }

  // --- total pipeline value ---
  if (hasAny(q, ["total pipeline", "pipeline value", "pipeline total", "whole pipeline", "total value of the pipeline"])) {
    return {
      matched: true,
      intent: "total-pipeline-value",
      summary: `Active pipeline (5 stages) total value is ${bdt(audit.totalPipelineValueActive)}. Paid deals add ${bdt(audit.paidValue)}. All deals combined: ${bdt(audit.totalPipelineValueAll)}.`,
      scalar: audit.totalPipelineValueActive,
      scalarLabel: "Active pipeline value",
    };
  }

  // --- total leads / how many leads ---
  if (hasAny(q, ["total leads", "how many leads", "how many deals", "number of leads", "count of leads"])) {
    return {
      matched: true,
      intent: "total-leads",
      summary: `There are ${audit.totalRecords} leads in total across ${PIPELINE_STAGES.length} active stages and ${TERMINAL_STAGES.length} terminal stages.`,
      scalar: audit.totalRecords,
      scalarLabel: "Total leads",
    };
  }

  // --- duplicates ---
  if (hasAny(q, ["duplicate", "duplicates"])) {
    const dupIds = new Set<string>();
    for (const [a, b] of [...audit.exactDuplicatePairs, ...audit.potentialDuplicatePairs]) {
      dupIds.add(a);
      dupIds.add(b);
    }
    const rows = leads.filter((l) => dupIds.has(l.leadId));
    return {
      matched: true,
      intent: "duplicates",
      summary: `${audit.exactDuplicatePairs.length} exact duplicate pair${audit.exactDuplicatePairs.length === 1 ? "" : "s"} and ${audit.potentialDuplicatePairs.length} potential duplicate pair${audit.potentialDuplicatePairs.length === 1 ? "" : "s"} found (${rows.length} records involved).`,
      rows,
      columns: [
        { key: "leadId", label: "Lead" },
        { key: "company", label: "Company" },
        { key: "contactName", label: "Contact" },
        { key: "contactEmail", label: "Email" },
        { key: "contactPhone", label: "Phone" },
      ],
      scalar: audit.exactDuplicatePairs.length + audit.potentialDuplicatePairs.length,
      scalarLabel: "Duplicate pairs",
    };
  }

  // --- data quality issues ---
  if (hasAny(q, ["data quality", "data issues", "problem", "problems", "flagged", "issues", "errors"])) {
    const rows = leads.filter((l) => l.hasIssues);
    return {
      matched: true,
      intent: "data-quality",
      summary: `${rows.length} of ${audit.totalRecords} leads have at least one data-quality flag (duplicate, missing contact, date error, overdue, or note flag).`,
      rows,
      columns: [
        { key: "leadId", label: "Lead" },
        { key: "company", label: "Company" },
        { key: "stage", label: "Stage" },
        { key: "issues", label: "Issues" },
      ],
      scalar: rows.length,
      scalarLabel: "Flagged leads",
    };
  }

  return {
    matched: false,
    intent: "unsupported",
    summary: "",
  };
}

/**
 * Convert a structured query spec (from the LLM parser) into a real QueryResult.
 * The spec can only reference existing fields/values; we execute it here.
 */
export interface StructuredQuerySpec {
  filter?: {
    stage?: Stage;
    overdue?: boolean;
    missingContacts?: boolean;
    hasIssues?: boolean;
    industry?: string;
    minDealValue?: number;
    maxDealValue?: number;
  };
  sort?: { field: "dealValue" | "nextFollowUp" | "company"; dir: "asc" | "desc" };
  aggregate?: "count" | "sum_value" | "none";
  limit?: number;
}

export function executeStructuredSpec(
  spec: StructuredQuerySpec,
  leads: NormalizedLead[],
): QueryResult {
  let rows = [...leads];

  const f = spec.filter ?? {};
  if (f.stage) rows = rows.filter((l) => l.stageNormalized === f.stage);
  if (f.overdue) rows = rows.filter((l) => l.isOverdue);
  if (f.missingContacts) rows = rows.filter((l) => l.missingFields.length > 0);
  if (f.hasIssues) rows = rows.filter((l) => l.hasIssues);
  if (f.industry) {
    const want = f.industry.toLowerCase();
    rows = rows.filter((l) => l.industry.toLowerCase().includes(want));
  }
  if (typeof f.minDealValue === "number") rows = rows.filter((l) => l.dealValue >= f.minDealValue!);
  if (typeof f.maxDealValue === "number") rows = rows.filter((l) => l.dealValue <= f.maxDealValue!);

  if (spec.sort) {
    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (spec.sort!.field === "dealValue") {
        av = a.dealValue;
        bv = b.dealValue;
      } else if (spec.sort!.field === "nextFollowUp") {
        av = a.nextFollowUpDate ?? "9999-12-31";
        bv = b.nextFollowUpDate ?? "9999-12-31";
      } else {
        av = a.company.toLowerCase();
        bv = b.company.toLowerCase();
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return spec.sort!.dir === "desc" ? -cmp : cmp;
    });
  }

  if (typeof spec.limit === "number") rows = rows.slice(0, spec.limit);

  const agg = spec.aggregate ?? "none";
  if (agg === "count") {
    return {
      matched: true,
      intent: "structured-count",
      summary: `${rows.length} matching lead${rows.length === 1 ? "" : "s"}.`,
      rows,
      columns: LEAD_COLUMNS,
      scalar: rows.length,
      scalarLabel: "Matching leads",
    };
  }
  if (agg === "sum_value") {
    const total = rows.reduce((s, l) => s + l.dealValue, 0);
    return {
      matched: true,
      intent: "structured-sum",
      summary: `${rows.length} matching lead${rows.length === 1 ? "" : "s"}, total value ${bdt(total)}.`,
      rows,
      columns: LEAD_COLUMNS,
      scalar: total,
      scalarLabel: "Total value",
    };
  }
  return {
    matched: true,
    intent: "structured-list",
    summary: `${rows.length} matching lead${rows.length === 1 ? "" : "s"}.`,
    rows,
    columns: LEAD_COLUMNS,
  };
}
