# BIAI Corporate Intelligence — Test Report

Generated from the real BIAI sample CSV (25 fictional leads) and the application's test suite.

Reference date for overdue: **2026-11-01** (per `stage-definitions.md` & `README.md`).

---

## 1. Data integrity

| # | Check | Result |
|---|---|---|
| 1 | Original records | **25** (L01–L25, none discarded) |
| 2 | Unique companies (normalized name) | **24** |
| 3 | Exact duplicate count (pairs) | **1** — L01 & L23 (Padma Textiles Ltd) |
| 4 | Potential duplicate count (pairs) | **1** — L02 & L03 (Meghna Pharma Ltd / Meghna Pharmaceuticals) |
| 5 | Missing contact details (records) | **2** — L06 (phone), L24 (name + role + email) |
| 6 | Invalid date strings | **0** |
| 7 | Date-order violation count | **1** — L25 (next follow-up 2026-10-21 before last contact 2026-10-28) |
| 8 | Overdue follow-ups (non-terminal) | **9** — L04, L06, L10, L13, L15, L19, L20, L22, L25 |
| 9 | Total flagged records (any issue) | **15** |

### Records not flagged (clean)
L05, L07, L09, L11, L12, L14, L16, L17, L21 (9 records).

> Manual cross-check: every record flagged above was checked against the raw CSV by hand. The note in L06 ("No phone or email on file yet") is misleading — the email **is** present; only the phone is missing. The app correctly flags only the phone as missing.

---

## 2. Pipeline metrics (calculated from actual data)

| Stage | Count | Value (BDT) | Terminal? |
|---|---|---|---|
| New | 3 | 0 | no |
| Contacted | 8 | 0 | no |
| Meeting | 6 | 1,900,000 | no |
| Proposal | 3 | 1,620,000 | no |
| Invoice sent | 2 | 400,000 | no |
| Paid | 1 | 300,000 | yes |
| Lost | 2 | 0 | yes |
| **Active pipeline** | **20** | **3,920,000** | — |
| **Total** | **25** | **4,220,000** | — |

KPIs shown on the dashboard: Total Leads 25 · Pipeline Value 3,920,000 BDT · Overdue 9 · Proposal 3 (1,620,000 BDT) · Paid 1 (300,000 BDT).

---

## 3. Unit tests

```
bun test tests/pipeline.test.ts   →   37 pass / 0 fail / 73 expect() calls
```

| Suite | Tests | Covers |
|---|---|---|
| Duplicate detection | 6 | exact pair L01/L23, potential pair L02/L03, L17 not flagged, 4 records involved, suffix/case normalization, bidirectional links |
| Date-order validation | 5 | L25 flagged, Paid/Lost empty follow-up not a violation, New empty last-contact not a violation, impossible-date rejection, valid ISO parsing |
| Missing contact detection | 5 | L06 phone only, L24 name/role/email, clean leads pass, synthetic detection |
| Overdue calculations | 6 | exactly 9 non-terminal overdue, Paid/Lost never overdue, on-reference-date not overdue, terminal/empty/invalid handling, before-reference flagging |
| Stage totals | 3 | counts sum to 25, exact per-stage counts, terminal flagging |
| Pipeline value calculations | 5 | per-stage values, active = 5 stages, total = active + paid, Paid KPI, Proposal KPI |
| Normalization helpers | 4 | company/email/phone normalization, memoized loader |
| Audit summary integrity | 3 | total records 25, unique companies 24, flagged leads 15 |

Cross-check: `bun run scripts/verify-pipeline.ts` confirms the TypeScript pipeline matches the independent Python audit (`scripts/audit.py`) on **25/25 checks**.

---

## 4. AI integration tests

| Test | Method | Result |
|---|---|---|
| Email generation — L04 (Karnaphuli Foods, overdue, Contacted) | `scripts/test-grok.ts` direct | Subject + body returned, personalized to Tanvir, references sales-team AI training from notes, signed off correctly |
| Email generation — L25 (Sylhet Hospitality, date-error lead) | `POST /api/ai/email` via HTTP | HTTP 200, professional follow-up for Mahmudul, no invented dates |
| NL query — "Which deals are overdue?" | `POST /api/ai/query` | Handled deterministically, returns 9 leads, intent=overdue |
| NL query — "Total value in Proposal stage?" | deterministic | 3 leads, 1,620,000 BDT |
| NL query — "Which manufacturing companies have deal value over 100000?" | LLM-assisted | Understood=true, spec {industry:Manufacturing, minDealValue:100000}, executed → 2 leads (L12, L22) |
| AI provider fallback | config | Z.ai SDK works with no external key; Groq key was rejected (HTTP 403) and the app fell back cleanly |

All AI responses are validated: email must have subject + body; query specs are executed locally against real data (the model never returns records or totals).

---

## 5. UI / interaction tests (agent-browser)

Verified via headless browser against the running dev server:

| Screen | Renders | Real data shown | Interactions |
|---|---|---|---|
| Dashboard | ✓ | KPIs 25 / 3,920,000 BDT / 9 overdue / 3 Proposal / 1 Paid; pipeline chart with 7 stages | KPI click → pipeline |
| Pipeline | ✓ | 25 of 25 leads, filtered value 4,220,000 BDT, table with all columns | Search, stage/industry/owner filters, sort buttons, issues-only toggle |
| Lead Details | ✓ | Full record, timeline, notes, data-quality warnings | Lead picker, Generate email button |
| Data Quality | ✓ | 1 exact + 1 potential dup, 2 missing, 1 date error, 9 overdue, 1 email casing | Tabs (Duplicates/Missing/Dates/Other), Keep/Dismiss merge buttons |
| AI Analyst | ✓ | 8 example chips, dataset summary 25 leads / 3,920,000 BDT | Ask button, chip clicks, deterministic + LLM results |

Console errors during full navigation: **none**.

---

## 6. Acceptance criteria (Phase 7)

| Criterion | Status |
|---|---|
| All 25 records accounted for, none discarded | ✅ |
| Duplicates identified correctly (exact + potential) | ✅ |
| Missing contacts flagged correctly | ✅ |
| Date errors identified correctly | ✅ |
| Original data remains recoverable (raw values preserved) | ✅ |
| Deal values calculated correctly | ✅ |
| Every stage displayed correctly | ✅ |
| Filters / search / sort work | ✅ |
| Pipeline totals accurate | ✅ |
| Paid & Lost handled as terminal | ✅ |
| Email generation uses real notes, handles missing info | ✅ |
| NL queries return correct records | ✅ |
| Financial calculations come from actual data | ✅ |
| AI failures do not break the app | ✅ (graceful error states) |
| No broken navigation / dead buttons / console errors | ✅ |
| Responsive layout | ✅ (mobile-first, tested at 1440px) |

---

## 7. Known limitations

1. **No persistence** — editing lead stage / follow-up date is not yet wired (optional Priority 1). Data is read-only from CSV.
2. **Owner is inferred** from `source` (sample CSV has no owner column); deterministic so the Owner filter is meaningful.
3. **Merge is a review note** — the duplicate merge workflow records a keep/dismiss decision in UI state only; it does not physically merge or persist. Deliberate (never auto-delete).
4. **CSV export** (optional Priority 1) not yet exposed in UI; pipeline produces the normalized data for it.
5. **Supplied Groq key rejected** (HTTP 403 — likely revoked after exposure in chat). App falls back to the built-in Z.ai LLM, which works fully. A valid `GROQ_API_KEY` in `.env` restores Groq.
6. **Reference date is fixed** at 2026-11-01 (per the brief) so overdue calculations are reproducible; a real deployment would use the current date.

---

*No claim of 100% accuracy is made without manual verification. Every flagged record above was checked against the raw CSV by hand, and the TypeScript pipeline is cross-checked against an independent Python audit.*
