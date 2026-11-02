#!/usr/bin/env python3
"""
BIAI Corporate Intelligence — Data Audit (Phase 0)
Single source of truth. The TypeScript app pipeline must reproduce these numbers.
"""
import csv
import json
import re
from datetime import date
from pathlib import Path

CSV_PATH = Path("/home/z/my-project/biai-app/data/raw/corporate-leads.csv")
OUT_DIR = Path("/home/z/my-project/download")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Reference date per stage-definitions.md & README: "1 November 2026"
REFERENCE_DATE = date(2026, 11, 1)

PIPELINE_STAGES = ["New", "Contacted", "Meeting", "Proposal", "Invoice sent"]
TERMINAL_STAGES = ["Paid", "Lost"]
ALL_STAGES = PIPELINE_STAGES + TERMINAL_STAGES

def norm_company(name: str) -> str:
    """Comparison key: lowercase, collapse whitespace, strip punctuation/suffixes."""
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r"\s+", " ", s)
    # strip common legal suffixes for fuzzy matching
    for suf in [" ltd", " limited", " ltd.", " co", " co.", " company", " group", " industries", " works"]:
        if s.endswith(suf):
            s = s[: -len(suf)].strip()
    s = re.sub(r"[^a-z0-9 ]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def norm_email(email: str) -> str:
    if not email:
        return ""
    return email.strip().lower()

def norm_phone(phone: str) -> str:
    if not phone:
        return ""
    return re.sub(r"[^0-9]", "", phone)

def parse_date(raw: str):
    if not raw or not raw.strip():
        return None
    s = raw.strip()
    try:
        return date.fromisoformat(s)
    except ValueError:
        return "INVALID"

def is_overdue(followup_raw, stage):
    if stage in TERMINAL_STAGES:
        return False, "terminal"
    d = parse_date(followup_raw)
    if d is None:
        return False, "no-followup"
    if d == "INVALID":
        return False, "invalid-date"
    return (d < REFERENCE_DATE, "before-ref" if d < REFERENCE_DATE else "after-ref")

# ---- Load ----
rows = []
with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(r)

total_records = len(rows)

# ---- Audit categories ----
duplicates_exact = []
duplicates_potential = []
missing_contacts = []
invalid_dates = []
date_order_violations = []
overdue_leads = []
other_issues = []

# index by normalized keys
by_company = {}
by_email = {}
by_phone = {}

for r in rows:
    lid = r["lead id"].strip()
    company = r["company"].strip()
    cname = r["contact name"].strip()
    crole = r["contact role"].strip()
    email = r["contact email"].strip()
    phone = r["contact phone"].strip()
    stage = r["stage"].strip()
    last = r["last contact"].strip()
    followup = r["next follow-up"].strip()
    nc = norm_company(company)
    ne = norm_email(email)
    np_ = norm_phone(phone)
    by_company.setdefault(nc, []).append(lid)
    if ne:
        by_email.setdefault(ne, []).append(lid)
    if np_:
        by_phone.setdefault(np_, []).append(lid)

# Duplicate detection
seen_pairs = set()
# Exact: same normalized company name
for key, lids in by_company.items():
    if len(lids) > 1:
        for i in range(len(lids)):
            for j in range(i + 1, len(lids)):
                pair = tuple(sorted([lids[i], lids[j]]))
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                a, b = pair
                ra = next(x for x in rows if x["lead id"].strip() == a)
                rb = next(x for x in rows if x["lead id"].strip() == b)
                # confirm with contact identity
                same_email = norm_email(ra["contact email"]) == norm_email(rb["contact email"]) and norm_email(ra["contact email"]) != ""
                same_phone = norm_phone(ra["contact phone"]) == norm_phone(rb["contact phone"]) and norm_phone(ra["contact phone"]) != ""
                duplicates_exact.append({
                    "pair": [a, b],
                    "company": company,
                    "reason": f"Identical normalized company name '{key}'",
                    "same_email": same_email,
                    "same_phone": same_phone,
                    "records": [ra, rb],
                })

# Potential: different company name but same contact identity (email and/or phone)
all_lids = [r["lead id"].strip() for r in rows]
for i in range(len(rows)):
    for j in range(i + 1, len(rows)):
        a, b = all_lids[i], all_lids[j]
        pair = tuple(sorted([a, b]))
        if pair in seen_pairs:
            continue
        ra, rb = rows[i], rows[j]
        ne_a, ne_b = norm_email(ra["contact email"]), norm_email(rb["contact email"])
        np_a, np_b = norm_phone(ra["contact phone"]), norm_phone(rb["contact phone"])
        same_email = ne_a and ne_a == ne_b
        same_phone = np_a and np_a == np_b
        same_contact_name = ra["contact name"].strip().lower() == rb["contact name"].strip().lower() and ra["contact name"].strip()
        # different company name but same contact identity
        if (same_email or same_phone) and norm_company(ra["company"]) != norm_company(rb["company"]):
            seen_pairs.add(pair)
            duplicates_potential.append({
                "pair": [a, b],
                "reason": f"Same contact identity (email={same_email}, phone={same_phone}, name={same_contact_name}) but different company name: '{ra['company']}' vs '{rb['company']}'",
                "records": [ra, rb],
            })

# Missing contacts
for r in rows:
    lid = r["lead id"].strip()
    issues = []
    if not r["contact name"].strip():
        issues.append("contact name")
    if not r["contact email"].strip():
        issues.append("contact email")
    if not r["contact phone"].strip():
        issues.append("contact phone")
    if not r["company"].strip():
        issues.append("company")
    if not r["contact role"].strip():
        issues.append("contact role")
    if issues:
        missing_contacts.append({"lead_id": lid, "company": r["company"], "missing": issues})

# Date validation
for r in rows:
    lid = r["lead id"].strip()
    stage = r["stage"].strip()
    last = r["last contact"].strip()
    followup = r["next follow-up"].strip()
    last_d = parse_date(last)
    followup_d = parse_date(followup)
    # invalid date strings
    if last_d == "INVALID":
        invalid_dates.append({"lead_id": lid, "field": "last contact", "value": last, "reason": "Unparseable date"})
    if followup_d == "INVALID":
        invalid_dates.append({"lead_id": lid, "field": "next follow-up", "value": followup, "reason": "Unparseable date"})
    # date order violation: follow-up before last contact (only if both valid & non-empty)
    if isinstance(last_d, date) and isinstance(followup_d, date):
        if followup_d < last_d:
            date_order_violations.append({
                "lead_id": lid,
                "company": r["company"],
                "last_contact": last,
                "next_followup": followup,
                "reason": f"Next follow-up ({followup}) is before last contact ({last})",
            })

# Overdue
for r in rows:
    lid = r["lead id"].strip()
    stage = r["stage"].strip()
    followup = r["next follow-up"].strip()
    od, reason = is_overdue(followup, stage)
    if od:
        overdue_leads.append({"lead_id": lid, "company": r["company"], "stage": stage, "next_followup": followup, "reason": reason})

# Other issues
for r in rows:
    lid = r["lead id"].strip()
    email = r["contact email"].strip()
    notes = r["notes"].strip()
    if email and re.search(r"[A-Z]", email.split("@")[1] if "@" in email else ""):
        other_issues.append({"lead_id": lid, "type": "email_casing", "value": email, "reason": "Email domain contains uppercase (likely typo); email domains are case-insensitive but this signals a data-entry error."})
    if "DUPLICATE" in notes.upper():
        other_issues.append({"lead_id": lid, "type": "note_flags_duplicate", "reason": "Notes explicitly flag this record as a duplicate."})
    if "Data error" in notes or "data error" in notes:
        other_issues.append({"lead_id": lid, "type": "note_flags_date_error", "reason": "Notes explicitly flag a date error."})

# ---- Pipeline metrics ----
stage_counts = {s: 0 for s in ALL_STAGES}
stage_values = {s: 0 for s in ALL_STAGES}
for r in rows:
    s = r["stage"].strip()
    if s in stage_counts:
        stage_counts[s] += 1
        try:
            v = int(r["deal value (BDT)"].strip() or "0")
        except ValueError:
            v = 0
        stage_values[s] += v

total_pipeline_value_active = sum(stage_values[s] for s in PIPELINE_STAGES)
total_pipeline_value_all = sum(stage_values.values())
paid_value = stage_values["Paid"]
paid_count = stage_counts["Paid"]

unique_companies_exact = len({norm_company(r["company"].strip()) for r in rows})

# All flagged record ids
flagged_ids = set()
for d in duplicates_exact + duplicates_potential:
    flagged_ids.update(d["pair"])
for m in missing_contacts:
    flagged_ids.add(m["lead_id"])
for i in invalid_dates:
    flagged_ids.add(i["lead_id"])
for v in date_order_violations:
    flagged_ids.add(v["lead_id"])
for o in overdue_leads:
    flagged_ids.add(o["lead_id"])
for o in other_issues:
    flagged_ids.add(o["lead_id"])

# ---- Write audit report ----
def fmt_bdt(n):
    return f"{n:,} BDT"

report = []
report.append("# BIAI Corporate Intelligence — Data Audit Report")
report.append("")
report.append(f"**Reference date (overdue cut-off):** {REFERENCE_DATE.isoformat()} (per `stage-definitions.md` & `README.md`)")
report.append(f"**Source file:** `corporate-leads.csv` (25 fictional sample leads supplied by BIAI)")
report.append(f"**Audit generated:** reproducible via `scripts/audit.py`")
report.append("")
report.append("## 1. Summary")
report.append("")
report.append("| Metric | Value |")
report.append("|---|---|")
report.append(f"| Total original records | {total_records} |")
report.append(f"| Unique companies (normalized name) | {unique_companies_exact} |")
report.append(f"| Exact duplicate pairs | {len(duplicates_exact)} |")
report.append(f"| Potential duplicate pairs | {len(duplicates_potential)} |")
report.append(f"| Records involved in duplicates | {len({x for d in duplicates_exact+duplicates_potential for x in d['pair']})} |")
report.append(f"| Records with missing contact fields | {len(missing_contacts)} |")
report.append(f"| Invalid date strings | {len(invalid_dates)} |")
report.append(f"| Date-order violations | {len(date_order_violations)} |")
report.append(f"| Overdue follow-ups (non-terminal) | {len(overdue_leads)} |")
report.append(f"| Other data-quality flags | {len(other_issues)} |")
report.append(f"| Total unique records flagged (any issue) | {len(flagged_ids)} |")
report.append("")
report.append("## 2. Pipeline metrics (calculated from actual data)")
report.append("")
report.append("| Stage | Lead count | Deal value (BDT) |")
report.append("|---|---|---|")
for s in ALL_STAGES:
    report.append(f"| {s} | {stage_counts[s]} | {fmt_bdt(stage_values[s])} |")
report.append(f"| **Active pipeline (5 stages)** | **{sum(stage_counts[s] for s in PIPELINE_STAGES)}** | **{fmt_bdt(total_pipeline_value_active)}** |")
report.append(f"| **Total (all stages)** | **{total_records}** | **{fmt_bdt(total_pipeline_value_all)}** |")
report.append("")
report.append(f"- **Total Leads:** {total_records}")
report.append(f"- **Total Pipeline Value (active 5 stages):** {fmt_bdt(total_pipeline_value_active)}")
report.append(f"- **Overdue Follow-ups:** {len(overdue_leads)}")
report.append(f"- **Deals in Proposal:** {stage_counts['Proposal']} ({fmt_bdt(stage_values['Proposal'])})")
report.append(f"- **Paid Deals:** {paid_count} ({fmt_bdt(paid_value)})")
report.append("")
report.append("## 3. Duplicate companies")
report.append("")
report.append("### 3a. Exact duplicates (identical normalized company name)")
report.append("")
if not duplicates_exact:
    report.append("_None._")
for d in duplicates_exact:
    a, b = d["pair"]
    report.append(f"- **{a} & {b}** — {d['reason']}. Same email: {d['same_email']}, same phone: {d['same_phone']}.")
    ra, rb = d["records"]
    report.append(f"  - {a}: `{ra['company']}` / `{ra['contact name']}` / `{ra['contact email']}` / `{ra['contact phone']}`")
    report.append(f"  - {b}: `{rb['company']}` / `{rb['contact name']}` / `{rb['contact email']}` / `{rb['contact phone']}`")
report.append("")
report.append("### 3b. Potential duplicates (different company name, same contact identity)")
report.append("")
if not duplicates_potential:
    report.append("_None._")
for d in duplicates_potential:
    a, b = d["pair"]
    report.append(f"- **{a} & {b}** — {d['reason']}")
    ra, rb = d["records"]
    report.append(f"  - {a}: `{ra['company']}` / `{ra['contact name']}` / `{ra['contact email']}` / `{ra['contact phone']}`")
    report.append(f"  - {b}: `{rb['company']}` / `{rb['contact name']}` / `{rb['contact email']}` / `{rb['contact phone']}`")
report.append("")
report.append("> Both pairs are confirmed duplicates — the CSV notes for L03 and L23 state \"DUPLICATE\" explicitly. L01/L23 is an exact record clone; L02/L03 is the same contact under two company-name spellings. No records are auto-deleted; a safe review/merge workflow is provided in the Data Quality Center.")
report.append("")
report.append("## 4. Missing contact details")
report.append("")
if not missing_contacts:
    report.append("_None._")
report.append("| Lead | Company | Missing fields |")
report.append("|---|---|---|")
for m in missing_contacts:
    report.append(f"| {m['lead_id']} | {m['company']} | {', '.join(m['missing'])} |")
report.append("")
report.append("## 5. Invalid dates & date-order violations")
report.append("")
report.append("### 5a. Invalid/unparseable date strings")
report.append("")
if not invalid_dates:
    report.append("_None._")
for i in invalid_dates:
    report.append(f"- **{i['lead_id']}** — field `{i['field']}` value `{i['value']}`: {i['reason']}")
report.append("")
report.append("### 5b. Date-order violations")
report.append("")
if not date_order_violations:
    report.append("_None._")
for v in date_order_violations:
    report.append(f"- **{v['lead_id']}** ({v['company']}): {v['reason']}")
report.append("")
report.append("> Note: empty follow-up dates on Paid/Lost records (L08, L12, L16) are **not** violations — terminal stages have no expected follow-up. Empty `last contact` on New-stage records (L09, L24) is **consistent** with the New stage definition (\"nobody has contacted them yet\").")
report.append("")
report.append("## 6. Overdue follow-ups")
report.append("")
report.append("Overdue = follow-up date is before the reference date **2026-11-01** AND stage is not terminal (Paid/Lost).")
report.append("")
if not overdue_leads:
    report.append("_None._")
report.append("| Lead | Company | Stage | Next follow-up |")
report.append("|---|---|---|---|")
for o in overdue_leads:
    report.append(f"| {o['lead_id']} | {o['company']} | {o['stage']} | {o['next_followup']} |")
report.append("")
report.append("## 7. Other data-quality issues")
report.append("")
if not other_issues:
    report.append("_None._")
for o in other_issues:
    extra = f" — value: `{o.get('value','')}`" if o.get('value') else ""
    report.append(f"- **{o['lead_id']}** ({o['type']}){extra}: {o['reason']}")
report.append("")
report.append("## 8. Records with no issues (clean)")
report.append("")
clean = [r["lead id"].strip() for r in rows if r["lead id"].strip() not in flagged_ids]
report.append(f"({len(clean)} of {total_records}): {', '.join(clean) if clean else 'none'}")
report.append("")
report.append("## 9. Data preservation policy")
report.append("")
report.append("- Original `corporate-leads.csv` is kept verbatim in `data/raw/` and is never modified.")
report.append("- The app stores a normalized copy alongside the raw values; every UI screen can show both.")
report.append("- Duplicate merge is **never automatic** — the Data Quality Center shows both records and offers a manual review/merge workflow.")
report.append("- Overdue status is computed at runtime from the reference date (2026-11-01), so it is fully reproducible.")
report.append("- No sample record is silently discarded; all 25 are loaded and shown.")
report.append("")

(OUT_DIR / "data-audit-report.md").write_text("\n".join(report), encoding="utf-8")
print(f"Audit report written: {OUT_DIR / 'data-audit-report.md'}")

# Also dump a machine-readable JSON for cross-checking with the TS pipeline
audit_json = {
    "reference_date": REFERENCE_DATE.isoformat(),
    "total_records": total_records,
    "unique_companies_normalized": unique_companies_exact,
    "exact_duplicate_pairs": [d["pair"] for d in duplicates_exact],
    "potential_duplicate_pairs": [d["pair"] for d in duplicates_potential],
    "missing_contact_lead_ids": [m["lead_id"] for m in missing_contacts],
    "invalid_dates": invalid_dates,
    "date_order_violations": [v["lead_id"] for v in date_order_violations],
    "overdue_lead_ids": [o["lead_id"] for o in overdue_leads],
    "stage_counts": stage_counts,
    "stage_values": stage_values,
    "total_pipeline_value_active": total_pipeline_value_active,
    "total_pipeline_value_all": total_pipeline_value_all,
    "paid_count": paid_count,
    "paid_value": paid_value,
    "flagged_ids": sorted(flagged_ids),
}
(OUT_DIR / "data-audit.json").write_text(json.dumps(audit_json, indent=2), encoding="utf-8")
print(f"Audit JSON written: {OUT_DIR / 'data-audit.json'}")
print("\n=== KEY NUMBERS ===")
print(f"Total records: {total_records}")
print(f"Unique companies (normalized): {unique_companies_exact}")
print(f"Exact dup pairs: {len(duplicates_exact)} -> {[d['pair'] for d in duplicates_exact]}")
print(f"Potential dup pairs: {len(duplicates_potential)} -> {[d['pair'] for d in duplicates_potential]}")
print(f"Missing contact records: {len(missing_contacts)} -> {[m['lead_id'] for m in missing_contacts]}")
print(f"Invalid date strings: {len(invalid_dates)}")
print(f"Date-order violations: {len(date_order_violations)} -> {[v['lead_id'] for v in date_order_violations]}")
print(f"Overdue (non-terminal): {len(overdue_leads)} -> {[o['lead_id'] for o in overdue_leads]}")
print(f"Stage counts: {stage_counts}")
print(f"Stage values: {stage_values}")
print(f"Total active pipeline value: {total_pipeline_value_active}")
print(f"Total all value: {total_pipeline_value_all}")
print(f"Paid: {paid_count} / {paid_value}")
print(f"Flagged ids: {sorted(flagged_ids)}")
