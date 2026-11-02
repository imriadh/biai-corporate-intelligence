# BIAI Corporate Intelligence

> Every lead. Every follow-up. One clear pipeline.

A production-quality prototype CRM and corporate sales intelligence application built for the **BIAI AI Internship Round 2** challenge (Task 2: Corporate Leads Pipeline).

It turns the 25 messy fictional sample leads supplied by BIAI into a clear, queryable pipeline — flagging duplicates, missing contacts, date errors and overdue follow-ups, and adding an AI follow-up email assistant and a natural-language sales analyst.

---

## What's inside

| Screen | Purpose |
|---|---|
| **Executive Dashboard** | KPI cards (Total Leads, Pipeline Value, Overdue, Proposal, Paid), pipeline bar chart, stage breakdown, overdue list, data-quality summary, recently updated leads |
| **Leads Pipeline** | Searchable, filterable (stage / industry / owner / issues-only), sortable (deal value / follow-up / company) table with overdue / missing / duplicate flags. Click any row to open details |
| **Lead Details + AI Email** | Full record (raw + normalized), timeline, data-quality warnings, and an AI follow-up-email assistant that uses the lead's real notes and respects missing fields |
| **Data Quality Center** | Duplicate detection (exact + potential) with a safe review/merge workflow, missing-contact report, date validation (order violations + overdue), email-casing flags |
| **AI Sales Analyst** | Natural-language questions about the pipeline. Deterministic for common questions (exact calculations); AI-assisted structured query parser for flexible ones. The model never invents records or totals |

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript 5
- **UI:** Tailwind CSS 4, shadcn/ui (New York), Lucide icons, Recharts
- **AI:** Multi-provider — **Z.ai LLM SDK** (built-in default), **Groq**, **OpenRouter**, **NVIDIA** (all OpenAI-compatible). Provider is env-configurable.
- **Data:** The real BIAI CSV is loaded server-side from `data/raw/` and normalized in memory. No external DB needed for the prototype.
- **Tests:** Bun test runner — 37 unit tests covering duplicates, dates, missing contacts, overdue, stage totals, pipeline value.

> The brief specified React + Vite. Next.js 16 was chosen instead because it gives server-side API routes out of the box, keeping AI keys safely on the server with zero extra infrastructure. The component model, TypeScript and Tailwind are identical to a Vite setup.

---

## Local setup

```bash
# 1. Install dependencies
bun install

# 2. Configure AI (optional — the built-in Z.ai provider works with no key)
cp .env.example .env
# edit .env and add GROQ_API_KEY / OPENROUTER_API_KEY if you want those fallbacks

# 3. Run the dev server
bun run dev          # http://localhost:3000

# 4. Run the unit tests
bun test tests/pipeline.test.ts

# 5. Run the data audit (Python, cross-checks the TS pipeline)
python3 scripts/audit.py     # writes download/data-audit-report.md + data-audit.json

# 6. Verify the TS pipeline matches the Python audit
bun run scripts/verify-pipeline.ts
```

The sample data lives in `data/raw/corporate-leads.csv` (25 fictional leads) and `data/raw/stage-definitions.md`. Both are committed so the repo is self-contained.

---

## AI provider configuration

The app tries providers in this priority order until one responds:

1. `AI_PRIMARY_PROVIDER` env var (if set and configured)
2. **Z.ai** — built-in LLM SDK, no external key needed (default, reliable)
3. **Groq** — `GROQ_API_KEY` + `GROQ_BASE_URL` + `GROQ_MODEL`
4. **OpenRouter** — `OPENROUTER_API_KEY` + `OPENROUTER_BASE_URL` + `OPENROUTER_MODEL`
5. **NVIDIA** — `NVIDIA_API_KEY` + `NVIDIA_BASE_URL` + `NVIDIA_MODEL`

If every provider fails, AI features show a clear error and the rest of the app keeps working. Deterministic NL queries (overdue, totals, counts) always work regardless of AI availability.

**Security:** all keys live only in server-side `.env` (gitignored). They are never imported into client code, never committed, never logged. The frontend only ever talks to `/api/ai/*` routes.

See `.env.example` for the full variable list.

---

## How the AI is used

### 1. Follow-up email drafting (`POST /api/ai/email`)
- Sends the selected lead's **real** company, contact, stage, deal value, dates and notes to the model.
- The system prompt forbids inventing meetings, calls, proposals, dates, promises, or missing contact details.
- The model returns `{"subject", "body"}` JSON; the route validates both fields exist.
- Regenerate + Copy buttons. Loading, error and empty states handled.

### 2. Natural-language pipeline queries (`POST /api/ai/query`)
- **Deterministic first:** 9+ common question patterns (overdue, total value in stage, missing contacts, leads in stage, highest value, lost/paid counts, follow-up priority, duplicates, data-quality) are answered with exact calculations over the real dataset — no AI, no hallucination possible.
- **AI-assisted fallback:** for flexible questions, the model returns a **structured query spec** (`filter` / `sort` / `aggregate` / `limit`), never a number or a record. The spec is executed locally against the real leads, so totals and rows always come from actual data.
- Unsupported questions get a clear "not a pipeline question" response with suggestions.

The model is never used when JavaScript can calculate the answer more accurately.

---

## Data engineering

The pipeline (`src/lib/data/pipeline.ts`) is the single source of truth. It:

- **Preserves** all raw imported values (company names, contacts, dates, stage strings, record IDs).
- **Normalizes** additively: whitespace/case for company comparison keys, email lowercasing, phone digit-only, ISO date parsing with impossible-date rejection.
- **Detects duplicates:** exact (identical normalized company name) vs potential (different name but same contact identity — email/phone). Confirmed vs possible are clearly distinguished.
- **Validates dates:** flags unparseable dates and date-order violations (follow-up before last contact). Empty follow-up on Paid/Lost is **not** a violation (terminal stages). Empty last-contact on New-stage leads is **consistent** with the stage definition.
- **Computes overdue** from a fixed reference date (`2026-11-01`, per `stage-definitions.md`), reproducibly. Terminal stages are never actionable overdue.
- **Never auto-deletes or auto-corrects** anything. The Data Quality Center offers a manual review/merge workflow that records a decision without modifying the dataset.

The TypeScript pipeline reproduces the Python audit (`scripts/audit.py`) exactly — verified by `scripts/verify-pipeline.ts` (25/25 checks pass).

---

## Data audit results (from the real 25 leads)

| Metric | Value |
|---|---|
| Total records | 25 |
| Unique companies (normalized) | 24 |
| Exact duplicate pair | 1 (L01 & L23 — Padma Textiles Ltd) |
| Potential duplicate pair | 1 (L02 & L03 — Meghna Pharma Ltd / Meghna Pharmaceuticals) |
| Records with missing contacts | 2 (L06 phone; L24 name+role+email) |
| Invalid date strings | 0 |
| Date-order violations | 1 (L25 — follow-up before last contact) |
| Overdue follow-ups (non-terminal) | 9 |
| Active pipeline value | 3,920,000 BDT |
| Paid deals | 1 (300,000 BDT) |

Full audit: `download/data-audit-report.md`.

---

## Project structure

```
data/raw/                     # BIAI sample CSV + stage definitions (committed)
src/
  app/
    page.tsx                  # server component: loads data, renders shell
    layout.tsx                # root layout + metadata
    globals.css               # theme (teal-emerald accent, semantic status colors)
    api/ai/email/route.ts     # AI follow-up email endpoint
    api/ai/query/route.ts     # NL query endpoint (deterministic + LLM parser)
  lib/
    data/
      types.ts                # domain types
      csv.ts                  # dependency-free CSV parser
      pipeline.ts             # import + normalize + dedupe + dates + overdue + audit
      query-engine.ts         # deterministic NL queries + structured-spec executor
    ai/
      provider.ts             # multi-provider client (Z.ai / Groq / OpenRouter / NVIDIA)
      provider-types.ts       # shared types
      prompts.ts              # system prompts (email + query)
  components/
    biai/
      app-shell.tsx           # top bar, nav, view switching
      dashboard.tsx           # Screen 1
      pipeline-table.tsx      # Screen 2
      lead-detail.tsx         # Screen 3 + AI email assistant
      data-quality.tsx        # Screen 4
      ai-analyst.tsx          # Screen 5
      format.ts / stage-badge.tsx
tests/pipeline.test.ts        # 37 unit tests
scripts/
  audit.py                    # Python data audit (cross-check)
  verify-pipeline.ts          # TS-vs-Python consistency check
  test-grok.ts / test-query.ts # AI provider smoke tests
```

---

## Known limitations & next steps

- **No persistence:** editing a lead's stage or follow-up date is not yet wired (optional Priority 1 feature). The dataset is read-only from the CSV. Adding Prisma + SQLite would enable edits without changing the data layer.
- **Owner inference:** the sample CSV has no explicit owner column, so owners are inferred deterministically from `source` so the Owner filter is meaningful. With a real owner field this becomes a direct lookup.
- **Merge is a review note only:** the duplicate merge workflow records a "keep / dismiss" decision in UI state but does not persist it or physically merge records. This is deliberate (never auto-delete) but a persisted merge log is the natural next step.
- **CSV export** (optional Priority 1) is not yet exposed in the UI; the pipeline already produces the normalized dataset needed for it.
- **AI provider:** the supplied `gsk_*` key is a Groq key, not xAI/Grok; it was rejected by Groq (HTTP 403, likely auto-revoked after exposure). The app falls back to the built-in Z.ai LLM, which works fully. Drop a valid `GROQ_API_KEY` into `.env` to switch providers.

---

## License & data

All companies, people, emails and phone numbers in `data/raw/` are fictional sample data supplied by BIAI for the challenge. No real customer data is used.
