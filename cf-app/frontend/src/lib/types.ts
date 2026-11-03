// BIAI Corporate Intelligence — Core domain types
// Mirrors the CSV schema exactly; normalization is additive, never destructive.

export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Meeting",
  "Proposal",
  "Invoice sent",
] as const;

export const TERMINAL_STAGES = ["Paid", "Lost"] as const;

export const ALL_STAGES = [...PIPELINE_STAGES, ...TERMINAL_STAGES] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type TerminalStage = (typeof TERMINAL_STAGES)[number];
export type Stage = PipelineStage | TerminalStage;

export const STAGE_ORDER: Record<Stage, number> = {
  New: 0,
  Contacted: 1,
  Meeting: 2,
  Proposal: 3,
  "Invoice sent": 4,
  Paid: 5,
  Lost: -1,
};

// Reference date for overdue calculations (per stage-definitions.md & README)
export const REFERENCE_DATE = "2026-11-01";

export interface RawLead {
  leadId: string;
  company: string;
  industry: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  source: string;
  stage: string; // raw, as imported
  dealValueRaw: string;
  lastContact: string;
  nextFollowUp: string;
  notes: string;
}

export type IssueType =
  | "duplicate_exact"
  | "duplicate_potential"
  | "missing_contact"
  | "invalid_date"
  | "date_order_violation"
  | "overdue"
  | "email_casing"
  | "note_flag";

export type Severity = "error" | "warning" | "info";

export interface DataQualityIssue {
  type: IssueType;
  field?: string;
  message: string;
  severity: Severity;
}

export interface DuplicateLink {
  groupKey: string;
  kind: "exact" | "potential";
  partnerIds: string[]; // other lead ids in the same group
  reason: string;
}

export interface NormalizedLead extends RawLead {
  // normalized (computed, additive)
  dealValue: number;
  normalizedCompany: string;
  normalizedEmail: string;
  normalizedPhone: string;
  lastContactDate: string | null; // ISO yyyy-mm-dd, or null if empty
  nextFollowUpDate: string | null;
  stageNormalized: Stage;
  isTerminal: boolean;
  isOverdue: boolean;
  overdueReason: string;
  missingFields: string[];
  issues: DataQualityIssue[];
  duplicateLinks: DuplicateLink[];
  hasIssues: boolean;
}

export interface StageSummary {
  stage: Stage;
  count: number;
  value: number;
  isTerminal: boolean;
}

export interface AuditSummary {
  referenceDate: string;
  totalRecords: number;
  uniqueCompaniesNormalized: number;
  exactDuplicatePairs: [string, string][];
  potentialDuplicatePairs: [string, string][];
  missingContactLeadIds: string[];
  dateOrderViolationLeadIds: string[];
  overdueLeadIds: string[];
  stageSummaries: StageSummary[];
  totalPipelineValueActive: number;
  totalPipelineValueAll: number;
  paidCount: number;
  paidValue: number;
  proposalCount: number;
  proposalValue: number;
  flaggedLeadIds: string[];
}
