// Verification script: confirms the TS pipeline matches the Python audit.
// Run: bun run scripts/verify-pipeline.ts
import { loadData } from "../src/lib/data/pipeline";

const { leads, audit } = loadData();

console.log("=== TS PIPELINE VERIFICATION ===");
console.log("Total records:", audit.totalRecords);
console.log("Unique companies (normalized):", audit.uniqueCompaniesNormalized);
console.log("Exact dup pairs:", audit.exactDuplicatePairs);
console.log("Potential dup pairs:", audit.potentialDuplicatePairs);
console.log("Missing contact lead ids:", audit.missingContactLeadIds);
console.log("Date-order violations:", audit.dateOrderViolationLeadIds);
console.log("Overdue lead ids:", audit.overdueLeadIds);
console.log("Stage summaries:");
for (const s of audit.stageSummaries) {
  console.log(`  ${s.stage}: count=${s.count}, value=${s.value}, terminal=${s.isTerminal}`);
}
console.log("Total active pipeline value:", audit.totalPipelineValueActive);
console.log("Total all value:", audit.totalPipelineValueAll);
console.log("Paid:", audit.paidCount, "/", audit.paidValue);
console.log("Proposal:", audit.proposalCount, "/", audit.proposalValue);
console.log("Flagged ids:", audit.flaggedLeadIds);

// Expected from Python audit
const expected = {
  totalRecords: 25,
  uniqueCompaniesNormalized: 24,
  exactDupPairs: [["L01", "L23"]],
  potentialDupPairs: [["L02", "L03"]],
  missingContact: ["L06", "L24"],
  dateOrderViolations: ["L25"],
  overdue: ["L04", "L06", "L10", "L13", "L15", "L19", "L20", "L22", "L25"],
  stageCounts: { New: 3, Contacted: 8, Meeting: 6, Proposal: 3, "Invoice sent": 2, Paid: 1, Lost: 2 },
  stageValues: { New: 0, Contacted: 0, Meeting: 1900000, Proposal: 1620000, "Invoice sent": 400000, Paid: 300000, Lost: 0 },
  totalActive: 3920000,
  totalAll: 4220000,
  paidCount: 1,
  paidValue: 300000,
};

let pass = true;
const check = (name: string, got: unknown, exp: unknown) => {
  const g = JSON.stringify(got);
  const e = JSON.stringify(exp);
  const ok = g === e;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: got=${g} expected=${e}`);
  if (!ok) pass = false;
};

check("totalRecords", audit.totalRecords, expected.totalRecords);
check("uniqueCompaniesNormalized", audit.uniqueCompaniesNormalized, expected.uniqueCompaniesNormalized);
check("exactDupPairs", audit.exactDuplicatePairs, expected.exactDupPairs);
check("potentialDupPairs", audit.potentialDuplicatePairs, expected.potentialDupPairs);
check("missingContact", audit.missingContactLeadIds, expected.missingContact);
check("dateOrderViolations", audit.dateOrderViolationLeadIds, expected.dateOrderViolations);
check("overdue", audit.overdueLeadIds, expected.overdue);
for (const s of audit.stageSummaries) {
  check(`stage count ${s.stage}`, s.count, (expected.stageCounts as Record<string, number>)[s.stage]);
  check(`stage value ${s.stage}`, s.value, (expected.stageValues as Record<string, number>)[s.stage]);
}
check("totalActive", audit.totalPipelineValueActive, expected.totalActive);
check("totalAll", audit.totalPipelineValueAll, expected.totalAll);
check("paidCount", audit.paidCount, expected.paidCount);
check("paidValue", audit.paidValue, expected.paidValue);

console.log("\n=== RESULT:", pass ? "ALL PASS ✅" : "FAILURES ❌", "===");
process.exit(pass ? 0 : 1);
