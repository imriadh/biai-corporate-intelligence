# BIAI Corporate Intelligence — Data Audit Report

**Reference date (overdue cut-off):** 2026-11-01 (per `stage-definitions.md` & `README.md`)
**Source file:** `corporate-leads.csv` (25 fictional sample leads supplied by BIAI)
**Audit generated:** reproducible via `scripts/audit.py`

## 1. Summary

| Metric | Value |
|---|---|
| Total original records | 25 |
| Unique companies (normalized name) | 24 |
| Exact duplicate pairs | 1 |
| Potential duplicate pairs | 1 |
| Records involved in duplicates | 4 |
| Records with missing contact fields | 2 |
| Invalid date strings | 0 |
| Date-order violations | 1 |
| Overdue follow-ups (non-terminal) | 9 |
| Other data-quality flags | 4 |
| Total unique records flagged (any issue) | 15 |

## 2. Pipeline metrics (calculated from actual data)

| Stage | Lead count | Deal value (BDT) |
|---|---|---|
| New | 3 | 0 BDT |
| Contacted | 8 | 0 BDT |
| Meeting | 6 | 1,900,000 BDT |
| Proposal | 3 | 1,620,000 BDT |
| Invoice sent | 2 | 400,000 BDT |
| Paid | 1 | 300,000 BDT |
| Lost | 2 | 0 BDT |
| **Active pipeline (5 stages)** | **22** | **3,920,000 BDT** |
| **Total (all stages)** | **25** | **4,220,000 BDT** |

- **Total Leads:** 25
- **Total Pipeline Value (active 5 stages):** 3,920,000 BDT
- **Overdue Follow-ups:** 9
- **Deals in Proposal:** 3 (1,620,000 BDT)
- **Paid Deals:** 1 (300,000 BDT)

## 3. Duplicate companies

### 3a. Exact duplicates (identical normalized company name)

- **L01 & L23** — Identical normalized company name 'padma textiles'. Same email: True, same phone: True.
  - L01: `Padma Textiles Ltd` / `Rafiq Uddin` / `rafiq@padma-textiles.example` / `01711-200101`
  - L23: `Padma Textiles Ltd` / `Rafiq Uddin` / `rafiq@padma-textiles.example` / `01711-200101`

### 3b. Potential duplicates (different company name, same contact identity)

- **L02 & L03** — Same contact identity (email=True, phone=True, name=Dr. Sultana Begum) but different company name: 'Meghna Pharma Ltd' vs 'Meghna Pharmaceuticals'
  - L02: `Meghna Pharma Ltd` / `Dr. Sultana Begum` / `sultana@meghna-pharma.example` / `01819-200102`
  - L03: `Meghna Pharmaceuticals` / `Dr. Sultana Begum` / `sultana@meghna-pharma.example` / `01819-200102`

> Both pairs are confirmed duplicates — the CSV notes for L03 and L23 state "DUPLICATE" explicitly. L01/L23 is an exact record clone; L02/L03 is the same contact under two company-name spellings. No records are auto-deleted; a safe review/merge workflow is provided in the Data Quality Center.

## 4. Missing contact details

| Lead | Company | Missing fields |
|---|---|---|
| L06 | Sylhet Tea Traders | contact phone |
| L24 | Noakhali Agro Mart | contact name, contact email, contact role |

## 5. Invalid dates & date-order violations

### 5a. Invalid/unparseable date strings

_None._

### 5b. Date-order violations

- **L25** (Sylhet Hospitality Group): Next follow-up (2026-10-21) is before last contact (2026-10-28)

> Note: empty follow-up dates on Paid/Lost records (L08, L12, L16) are **not** violations — terminal stages have no expected follow-up. Empty `last contact` on New-stage records (L09, L24) is **consistent** with the New stage definition ("nobody has contacted them yet").

## 6. Overdue follow-ups

Overdue = follow-up date is before the reference date **2026-11-01** AND stage is not terminal (Paid/Lost).

| Lead | Company | Stage | Next follow-up |
|---|---|---|---|
| L04 | Karnaphuli Foods | Contacted | 2026-10-29 |
| L06 | Sylhet Tea Traders | Contacted | 2026-10-22 |
| L10 | Oriental Bank Branch Ops | Meeting | 2026-10-30 |
| L13 | Mou Telecom | Contacted | 2026-10-28 |
| L15 | Gulshan Dental Chain | Contacted | 2026-10-19 |
| L19 | Ruhi Digital Agency | Meeting | 2026-10-30 |
| L20 | Cumilla Pharma Depot | Contacted | 2026-10-27 |
| L22 | Khulna Jute Works | Invoice sent | 2026-10-24 |
| L25 | Sylhet Hospitality Group | Contacted | 2026-10-21 |

## 7. Other data-quality issues

- **L03** (note_flags_duplicate): Notes explicitly flag this record as a duplicate.
- **L18** (email_casing) — value: `shahidul@bogurateXtile.example`: Email domain contains uppercase (likely typo); email domains are case-insensitive but this signals a data-entry error.
- **L23** (note_flags_duplicate): Notes explicitly flag this record as a duplicate.
- **L25** (note_flags_date_error): Notes explicitly flag a date error.

## 8. Records with no issues (clean)

(10 of 25): L05, L07, L08, L09, L11, L12, L14, L16, L17, L21

## 9. Data preservation policy

- Original `corporate-leads.csv` is kept verbatim in `data/raw/` and is never modified.
- The app stores a normalized copy alongside the raw values; every UI screen can show both.
- Duplicate merge is **never automatic** — the Data Quality Center shows both records and offers a manual review/merge workflow.
- Overdue status is computed at runtime from the reference date (2026-11-01), so it is fully reproducible.
- No sample record is silently discarded; all 25 are loaded and shown.
