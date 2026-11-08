// Unit tests for the data-cleaning plan logic (pure functions, no D1 needed).
// Run: bun test tests/clean.test.ts   (from cf-app/)

import { describe, expect, test } from "bun:test";
import {
  tidyText,
  planTrim,
  planEmailCasing,
  planExactDupGroups,
  computeMergedRow,
} from "../src/lib/clean";
import type { RawLead } from "../src/lib/types";

function lead(partial: Partial<RawLead> & { leadId: string }): RawLead {
  return {
    company: "", industry: "", contactName: "", contactRole: "", contactEmail: "",
    contactPhone: "", source: "", stage: "New", dealValueRaw: "0",
    lastContact: "", nextFollowUp: "", notes: "",
    ...partial,
  };
}

describe("tidyText", () => {
  test("trims ends and collapses internal runs of spaces", () => {
    expect(tidyText("  Padma   Textiles  ")).toBe("Padma Textiles");
    expect(tidyText("a\tb")).toBe("a b");
  });
});

describe("planTrim", () => {
  test("detects dirty fields and leaves clean leads alone", () => {
    const changes = planTrim([
      lead({ leadId: "L01", company: " Padma Textiles ", contactEmail: "a@b.example" }),
      lead({ leadId: "L02", company: "Clean Co", contactEmail: "x@y.example" }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0].leadId).toBe("L01");
    expect(changes[0].fields.map((f) => f.column)).toEqual(["company"]);
    expect(changes[0].fields[0].to).toBe("Padma Textiles");
  });
});

describe("planEmailCasing", () => {
  test("flags only emails containing uppercase", () => {
    const changes = planEmailCasing([
      lead({ leadId: "L01", contactEmail: "Rafiq@Padma-Textiles.example" }),
      lead({ leadId: "L02", contactEmail: "fine@example.com" }),
      lead({ leadId: "L03", contactEmail: "" }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ leadId: "L01", from: "Rafiq@Padma-Textiles.example", to: "rafiq@padma-textiles.example" });
  });
});

describe("planExactDupGroups", () => {
  test("groups by normalized company and keeps the richest record", () => {
    const groups = planExactDupGroups([
      lead({ leadId: "L03", company: "Meghna Pharma", contactEmail: "s@x.example", contactPhone: "018" }),
      lead({ leadId: "L02", company: "Meghna Pharma Ltd", contactEmail: "s@x.example", contactPhone: "018", contactRole: "Head of Operations", notes: "rich" }),
      lead({ leadId: "L09", company: "Unrelated Ltd", contactEmail: "u@x.example" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("L02"); // richer: role + notes
    expect(groups[0].mergeIds).toEqual(["L03"]);
  });

  test("ties break by lowest lead id", () => {
    const groups = planExactDupGroups([
      lead({ leadId: "L07", company: "Bengal Traders" }),
      lead({ leadId: "L04", company: "Bengal Traders Ltd" }),
    ]);
    expect(groups[0].keepId).toBe("L04");
    expect(groups[0].mergeIds).toEqual(["L07"]);
  });

  test("ignores single-member companies and empty names", () => {
    const groups = planExactDupGroups([
      lead({ leadId: "L01", company: "Solo Ltd" }),
      lead({ leadId: "L02", company: "" }),
    ]);
    expect(groups).toHaveLength(0);
  });
});

describe("computeMergedRow", () => {
  test("fills empty fields, keeps stage, appends notes, larger deal wins", () => {
    const keep = lead({
      leadId: "L02", company: "Meghna Pharma Ltd", stage: "Proposal", dealValueRaw: "700000",
      contactEmail: "s@x.example", notes: "Proposal sent.",
    });
    const absorb = lead({
      leadId: "L03", company: "Meghna Pharmaceuticals", stage: "Meeting", dealValueRaw: "900000",
      contactName: "Dr. Sultana Begum", contactRole: "Head of Operations", notes: "Wants Bangla support.",
    });
    const merged = computeMergedRow(keep, absorb);
    expect(merged.company).toBe("Meghna Pharma Ltd"); // kept — non-empty
    expect(merged.contactName).toBe("Dr. Sultana Begum"); // filled from absorb
    expect(merged.contactRole).toBe("Head of Operations"); // filled from absorb
    expect(merged.stage).toBe("Proposal"); // kept record's stage wins
    expect(merged.dealValueRaw).toBe("900000"); // larger deal value wins
    expect(merged.notes).toBe("Proposal sent.\n[Merged from L03] Wants Bangla support.");
    expect(merged.leadId).toBe("L02");
  });

  test("latest last-contact date wins", () => {
    const keep = lead({ leadId: "A", lastContact: "2026-10-20" });
    const absorb = lead({ leadId: "B", lastContact: "2026-10-27" });
    expect(computeMergedRow(keep, absorb).lastContact).toBe("2026-10-27");
    expect(computeMergedRow(absorb, keep).lastContact).toBe("2026-10-27");
  });

  test("identical notes are not duplicated", () => {
    const keep = lead({ leadId: "A", notes: "Same note" });
    const absorb = lead({ leadId: "B", notes: "Same note" });
    expect(computeMergedRow(keep, absorb).notes).toBe("Same note");
  });
});
