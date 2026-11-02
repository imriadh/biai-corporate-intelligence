// BIAI Corporate Intelligence — Unit tests for the data pipeline.
// Run: bun test
//
// Covers (per Phase 4):
//   - Duplicate detection (exact + potential)
//   - Date-order validation
//   - Missing contact detection
//   - Overdue calculations
//   - Stage totals
//   - Pipeline value calculations
//
// These run against the real BIAI sample CSV (25 leads) and assert the exact
// numbers from the Python audit (download/data-audit.json).

import { describe, expect, it } from "bun:test";
import {
  buildNormalizedLeads,
  buildAuditSummary,
  importRawLeads,
  detectDuplicatePairs,
  computeOverdue,
  findMissingFields,
  normalizeCompany,
  normalizeEmail,
  normalizePhone,
  parseDate,
} from "../src/lib/data/pipeline";
import { loadData } from "../src/lib/data/pipeline";
import { PIPELINE_STAGES, TERMINAL_STAGES, REFERENCE_DATE } from "../src/lib/data/types";
import type { RawLead } from "../src/lib/data/types";

const rawLeads = importRawLeads();
const leads = buildNormalizedLeads(rawLeads);
const audit = buildAuditSummary(leads);

// ---------- helpers to build synthetic leads for edge-case tests ----------
function makeLead(over: Partial<RawLead>): RawLead {
  return {
    leadId: "X01",
    company: "Test Co Ltd",
    industry: "Garments",
    contactName: "Jane Doe",
    contactRole: "Director",
    contactEmail: "jane@testco.example",
    contactPhone: "01711-000000",
    source: "Cold email",
    stage: "New",
    dealValueRaw: "0",
    lastContact: "",
    nextFollowUp: "",
    notes: "",
    ...over,
  };
}

// ============================================================
// 1. Duplicate detection
// ============================================================
describe("Duplicate detection", () => {
  it("detects the exact duplicate pair L01 & L23 (same normalized company name)", () => {
    const pairs = detectDuplicatePairs(rawLeads);
    const exact = pairs.filter((p) => p.kind === "exact");
    expect(exact.length).toBe(1);
    const pair = exact[0];
    const ids = [pair.a, pair.b].sort();
    expect(ids).toEqual(["L01", "L23"]);
  });

  it("detects the potential duplicate pair L02 & L03 (different name, same contact)", () => {
    const pairs = detectDuplicatePairs(rawLeads);
    const potential = pairs.filter((p) => p.kind === "potential");
    expect(potential.length).toBe(1);
    const pair = potential[0];
    const ids = [pair.a, pair.b].sort();
    expect(ids).toEqual(["L02", "L03"]);
  });

  it("does not flag L17 (Megna Retail) as a duplicate of L02/L03 (Meghna Pharma)", () => {
    // similar prefix but different industry, contact, email, phone
    const pairs = detectDuplicatePairs(rawLeads);
    const involvesL17 = pairs.filter((p) => p.a === "L17" || p.b === "L17");
    expect(involvesL17.length).toBe(0);
  });

  it("flags 4 records total as involved in duplicates", () => {
    const ids = new Set<string>();
    for (const p of detectDuplicatePairs(rawLeads)) {
      ids.add(p.a);
      ids.add(p.b);
    }
    expect(ids.size).toBe(4);
    expect([...ids].sort()).toEqual(["L01", "L02", "L03", "L23"]);
  });

  it("treats company-name suffix and case differences as the same company", () => {
    const a = makeLead({ leadId: "A", company: "Padma Textiles Ltd" });
    const b = makeLead({ leadId: "B", company: "padma textiles limited" });
    const pairs = detectDuplicatePairs([a, b]);
    expect(normalizeCompany(a.company)).toBe(normalizeCompany(b.company));
    expect(pairs.length).toBe(1);
    expect(pairs[0].kind).toBe("exact");
  });

  it("links duplicate partners bidirectionally on normalized leads", () => {
    const l01 = leads.find((l) => l.leadId === "L01")!;
    const l23 = leads.find((l) => l.leadId === "L23")!;
    expect(l01.duplicateLinks.some((d) => d.partnerIds.includes("L23"))).toBe(true);
    expect(l23.duplicateLinks.some((d) => d.partnerIds.includes("L01"))).toBe(true);
  });
});

// ============================================================
// 2. Date-order validation
// ============================================================
describe("Date-order validation", () => {
  it("flags L25 — next follow-up before last contact", () => {
    expect(audit.dateOrderViolationLeadIds).toEqual(["L25"]);
    const l25 = leads.find((l) => l.leadId === "L25")!;
    expect(l25.issues.some((i) => i.type === "date_order_violation")).toBe(true);
  });

  it("does not treat empty follow-up on Paid/Lost as a date violation", () => {
    // L08 (Lost), L12 (Paid), L16 (Lost) have empty follow-up — should NOT be violations
    expect(audit.dateOrderViolationLeadIds).not.toContain("L08");
    expect(audit.dateOrderViolationLeadIds).not.toContain("L12");
    expect(audit.dateOrderViolationLeadIds).not.toContain("L16");
  });

  it("does not treat empty last-contact on New-stage leads as a violation", () => {
    // L09, L24 are New with empty last contact — consistent with stage, not a violation
    expect(audit.dateOrderViolationLeadIds).not.toContain("L09");
    expect(audit.dateOrderViolationLeadIds).not.toContain("L24");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("2026-13-01")).toBe("INVALID");
    expect(parseDate("2026-02-30")).toBe("INVALID");
    expect(parseDate("not-a-date")).toBe("INVALID");
  });

  it("accepts valid ISO dates and nulls empty", () => {
    expect(parseDate("2026-11-01")).toBe("2026-11-01");
    expect(parseDate("")).toBeNull();
  });
});

// ============================================================
// 3. Missing contact detection
// ============================================================
describe("Missing contact detection", () => {
  it("flags exactly L06 (missing phone) and L24 (missing name/role/email)", () => {
    expect(audit.missingContactLeadIds.sort()).toEqual(["L06", "L24"]);
  });

  it("L06 has only the phone missing (email is present despite the misleading note)", () => {
    const l06 = leads.find((l) => l.leadId === "L06")!;
    expect(l06.missingFields).toEqual(["contact phone"]);
  });

  it("L24 is missing contact name, role and email (phone present)", () => {
    const l24 = leads.find((l) => l.leadId === "L24")!;
    expect(l24.missingFields.sort()).toEqual(["contact email", "contact name", "contact role"]);
  });

  it("does not flag fully-populated leads", () => {
    const l01 = leads.find((l) => l.leadId === "L01")!;
    expect(l01.missingFields).toEqual([]);
  });

  it("detects missing fields on a synthetic lead", () => {
    expect(findMissingFields(makeLead({ contactName: "", contactEmail: "" }))).toContain("contact name");
    expect(findMissingFields(makeLead({ contactName: "", contactEmail: "" }))).toContain("contact email");
  });
});

// ============================================================
// 4. Overdue calculations
// ============================================================
describe("Overdue calculations", () => {
  it("flags exactly 9 non-terminal overdue leads", () => {
    expect(audit.overdueLeadIds.length).toBe(9);
    expect(audit.overdueLeadIds.sort()).toEqual(
      ["L04", "L06", "L10", "L13", "L15", "L19", "L20", "L22", "L25"].sort(),
    );
  });

  it("never flags Paid or Lost leads as overdue", () => {
    for (const id of ["L08", "L12", "L16"]) {
      expect(audit.overdueLeadIds).not.toContain(id);
    }
  });

  it("does not flag L07 (follow-up 2026-11-02, on/after reference)", () => {
    expect(audit.overdueLeadIds).not.toContain("L07");
  });

  it("computeOverdue respects terminal stages", () => {
    expect(computeOverdue("2020-01-01", "Paid").isOverdue).toBe(false);
    expect(computeOverdue("2020-01-01", "Lost").isOverdue).toBe(false);
  });

  it("computeOverdue returns false for empty/invalid follow-up", () => {
    expect(computeOverdue(null, "Contacted").isOverdue).toBe(false);
    expect(computeOverdue("INVALID", "Contacted").isOverdue).toBe(false);
  });

  it("computeOverdue flags a date before the reference", () => {
    expect(computeOverdue("2026-10-31", "Contacted").isOverdue).toBe(true);
    expect(computeOverdue(REFERENCE_DATE, "Contacted").isOverdue).toBe(false); // on the day = not overdue
  });
});

// ============================================================
// 5. Stage totals
// ============================================================
describe("Stage totals", () => {
  it("counts all 25 leads across the 7 stages", () => {
    const total = audit.stageSummaries.reduce((s, x) => s + x.count, 0);
    expect(total).toBe(25);
  });

  it("has the exact expected counts per stage", () => {
    const byStage = Object.fromEntries(audit.stageSummaries.map((s) => [s.stage, s.count]));
    expect(byStage).toEqual({
      New: 3,
      Contacted: 8,
      Meeting: 6,
      Proposal: 3,
      "Invoice sent": 2,
      Paid: 1,
      Lost: 2,
    });
  });

  it("marks only Paid and Lost as terminal", () => {
    for (const s of audit.stageSummaries) {
      expect(s.isTerminal).toBe(TERMINAL_STAGES.includes(s.stage as never));
    }
  });
});

// ============================================================
// 6. Pipeline value calculations
// ============================================================
describe("Pipeline value calculations", () => {
  it("sums deal values per stage correctly", () => {
    const byStage = Object.fromEntries(audit.stageSummaries.map((s) => [s.stage, s.value]));
    expect(byStage).toEqual({
      New: 0,
      Contacted: 0,
      Meeting: 1_900_000,
      Proposal: 1_620_000,
      "Invoice sent": 400_000,
      Paid: 300_000,
      Lost: 0,
    });
  });

  it("active pipeline value = sum of 5 active stages", () => {
    expect(audit.totalPipelineValueActive).toBe(3_920_000);
    const manual = PIPELINE_STAGES.reduce(
      (s, st) => s + (audit.stageSummaries.find((x) => x.stage === st)?.value ?? 0),
      0,
    );
    expect(audit.totalPipelineValueActive).toBe(manual);
  });

  it("total all value = active + Paid", () => {
    expect(audit.totalPipelineValueAll).toBe(4_220_000);
    expect(audit.totalPipelineValueAll).toBe(audit.totalPipelineValueActive + audit.paidValue);
  });

  it("Paid KPI = 1 deal, 300000 BDT", () => {
    expect(audit.paidCount).toBe(1);
    expect(audit.paidValue).toBe(300_000);
  });

  it("Proposal KPI = 3 deals, 1620000 BDT", () => {
    expect(audit.proposalCount).toBe(3);
    expect(audit.proposalValue).toBe(1_620_000);
  });
});

// ============================================================
// 7. Normalization helpers
// ============================================================
describe("Normalization helpers", () => {
  it("normalizes company names (case, suffix, punctuation)", () => {
    expect(normalizeCompany("Padma Textiles Ltd")).toBe(normalizeCompany("padma textiles limited"));
    expect(normalizeCompany("  Meghna   Pharma  Ltd. ")).toBe("meghna pharma");
    expect(normalizeCompany("")).toBe("");
  });

  it("normalizes emails to lowercase", () => {
    expect(normalizeEmail("JANE@TestCo.Example")).toBe("jane@testco.example");
    expect(normalizeEmail("")).toBe("");
  });

  it("normalizes phones to digits only", () => {
    expect(normalizePhone("01711-200101")).toBe("01711200101");
    expect(normalizePhone("+880 1711-200101")).toBe("8801711200101");
    expect(normalizePhone("")).toBe("");
  });

  it("memoized loadData returns the same instance", () => {
    const a = loadData();
    const b = loadData();
    expect(a).toBe(b);
  });
});

// ============================================================
// 8. End-to-end audit summary integrity
// ============================================================
describe("Audit summary integrity", () => {
  it("total records = 25", () => {
    expect(audit.totalRecords).toBe(25);
  });

  it("unique companies (normalized) = 24", () => {
    expect(audit.uniqueCompaniesNormalized).toBe(24);
  });

  it("flagged leads = 15", () => {
    expect(audit.flaggedLeadIds.length).toBe(15);
    expect(audit.flaggedLeadIds.sort()).toEqual(
      ["L01","L02","L03","L04","L06","L10","L13","L15","L18","L19","L20","L22","L23","L24","L25"].sort(),
    );
  });
});
