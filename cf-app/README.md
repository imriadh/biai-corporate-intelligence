# BIAI Corporate Intelligence — Cloudflare Edition

> Every lead. Every follow-up. One clear pipeline.

AI-powered corporate sales intelligence CRM, rebuilt on **Cloudflare Workers + D1 + Hono + Vite + React**. Deployed at a public workers.dev URL with persistent SQLite (D1), credential login, AI follow-up emails (with one-click Gmail send), a natural-language pipeline analyst, and a CSV import/update flow.

**Live demo:** https://biai-corporate-intelligence.imriad.workers.dev
**Login:** `admin` / `biai-demo-2026`

---

## Architecture

```
React + Vite + TypeScript (frontend)  ──static assets──►  Cloudflare Worker (Hono)
                                                              │
                          /api/auth/*      ──►  credential login + JWT (httpOnly cookie)
                          /api/leads/*     ──►  D1 (leads + users + import_log)
                          /api/ai/email    ──►  Cloudflare Workers AI (primary) + Z.ai/Groq/OpenRouter (fallback)
                          /api/ai/query    ──►  deterministic engine + Workers AI structured-query parser
                          /api/import      ──►  CSV upsert into D1 (preview → commit)
                          /*               ──►  static assets (SPA)
```

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript 5, Tailwind CSS 3, shadcn/ui, Lucide, Recharts |
| Backend | Hono 4 on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) — `leads`, `users`, `import_log` tables |
| AI | **Cloudflare Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, free 10k req/day) as primary; Z.ai / Groq / OpenRouter as env-configurable fallbacks |
| Auth | Credential-only login, JWT (HMAC-SHA256 via Web Crypto) in an httpOnly cookie |
| Hosting | Cloudflare Workers + Static Assets (single Worker serves API + SPA) |

---

## The 6 screens

1. **Login** — credential-only (no signup yet). Demo: `admin` / `biai-demo-2026`. The `users` table supports multiple users + roles for future growth.
2. **Executive Dashboard** — KPI cards (Total Leads, Pipeline Value, Overdue, Proposal, Paid), pipeline bar chart, stage breakdown, overdue + data-quality summaries, recently updated leads.
3. **Leads Pipeline** — searchable, filterable (stage / industry / owner / issues-only), sortable table with overdue / missing / duplicate flags. Click any row → Lead Details.
4. **Lead Details + AI Email** — full record, timeline, data-quality warnings, AI follow-up-email generator. **"Send via Gmail"** button opens Gmail compose with To/Subject/Body pre-filled — no copy/paste needed.
5. **Data Quality Center** — duplicate detection (exact + potential) with **real merge / delete actions**, one-click cleaning (trim spaces, lowercase emails, auto-merge exact duplicates), full-field lead editing, and a **cleanup history with one-click Undo** for every change.
6. **AI Sales Analyst** — natural-language questions. Deterministic for common questions (exact calculations); AI-assisted structured query parser for flexible ones.
7. **Import** — upload/paste a CSV → preview (insert/update/skip per row) → commit upsert into D1. Future-dated rows are handled correctly.

---

## Cloudflare deployment (how to reproduce)

### Prerequisites
- A Cloudflare account + an API token with permissions for Workers, D1, and Workers AI.
- Node 20+ / Bun 1.3+.

### 1. Clone + install
```bash
git clone https://github.com/imriadh/biai-corporate-intelligence.git
cd biai-corporate-intelligence/cf-app
bun install
cd frontend && bun install && cd ..
```

### 2. Create the D1 database + apply the migrations
```bash
# create D1
wrangler d1 create biai-leads
# → copy the database_id into wrangler.toml [[d1_databases]]

# apply schema + seed 25 leads + demo user (remote)
wrangler d1 execute biai-leads --file=migrations/0001_init.sql --remote
# apply cleanup_log (data-cleaning undo history)
wrangler d1 execute biai-leads --file=migrations/0002_cleanup.sql --remote
```

### 3. Set secrets (AI keys + JWT)
```bash
wrangler secret put JWT_SECRET        # paste a strong random string
wrangler secret put ZAI_API_KEY       # optional fallback (Z.ai GLM key)
# wrangler secret put GROQ_API_KEY    # optional further fallback
```
`AI_PRIMARY_PROVIDER = "workersai"` is set in `wrangler.toml [vars]` so the app uses the free Cloudflare Workers AI by default. Flip it to `zai` / `groq` / `openrouter` to use a configured fallback provider instead.

### 4. Build the frontend + deploy
```bash
cd frontend && bun run build && cd ..   # outputs to frontend/dist
wrangler deploy                          # uploads Worker + static assets
```
Wrangler prints the public URL: `https://biai-corporate-intelligence.<your-subdomain>.workers.dev`.

### 5. Local dev
```bash
# terminal 1 — Worker dev (port 8787)
wrangler dev
# terminal 2 — Vite dev (port 5173, proxies /api → 8787)
cd frontend && bun run dev
```
Open http://localhost:5173. Apply the migration locally first: `wrangler d1 execute biai-leads --file=migrations/0001_init.sql --local`.

---

## How AI is integrated

| Feature | How it works |
|---|---|
| **Follow-up email** | `POST /api/ai/email { leadId }` → sends the lead's real notes/stage/contact to Workers AI with a strict no-fabrication system prompt → returns `{ subject, body, gmailUrl, mailtoUrl }`. The **Send via Gmail** button opens `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…` with everything pre-filled. |
| **NL query** | `POST /api/ai/query { question }` → deterministic engine answers common questions (overdue, totals, counts, missing, priority) with exact math, no AI. Flexible questions go to Workers AI which returns a **structured query spec** executed locally — the model never invents records or totals. |

Provider fallback chain: `workersai` → `zai` → `groq` → `openrouter`. If Workers AI is rate-limited, the app tries the next configured provider. If all fail, AI features show a clear error and the rest of the app keeps working.

> The supplied Z.ai key (`4a3fe0988b7f4e2080e224c957773991.…`) authenticates but the account has no balance ("Insufficient balance or no resource package"). It is stored as a secret fallback per the architecture requirement; Workers AI is the active provider.

---

## CSV import / update — handling future-dated data (industry best practice)

The **Import** screen implements the standard CRM data-refresh pattern:

1. **Upload or paste** a CSV (same schema as the BIAI `corporate-leads.csv`).
2. **Preview** (`?preview=true`) — a dry run that shows, per row, whether it will `insert` (new lead id), `update` (existing lead id), or `skip` (invalid — missing required fields or bad dates).
3. **Commit** — upserts via `INSERT … ON CONFLICT(lead_id) DO UPDATE`. Existing leads are updated, new leads are added, **nothing is ever deleted**.
4. **Audit log** — every import is recorded in `import_log` (file, rows seen/inserted/updated/skipped, timestamp).

**Future-dated data:** follow-up dates 5 days ahead (or any future date) are stored as-is. Overdue is computed at read time against the reference date, so a follow-up scheduled 5 days from now simply shows as "upcoming", not overdue. Drop in a fresh CSV any time — the pipeline stays current without losing history.

---

## Data integrity (from the real 25 BIAI leads, via D1)

| Metric | Value |
|---|---|
| Total records | 25 (all loaded into D1, none discarded) |
| Unique companies (normalized) | 24 |
| Exact duplicate pair | 1 (L01 & L23 — Padma Textiles Ltd) |
| Potential duplicate pair | 1 (L02 & L03 — Meghna Pharma) |
| Missing contacts | 2 (L06, L24) |
| Date-order violations | 1 (L25) |
| Overdue (non-terminal) | 9 |
| Active pipeline value | 3,920,000 BDT |
| Paid deals | 1 (300,000 BDT) |

D1 persistence verified: after redeployment, `GET /api/leads/audit` returns the same numbers.

---

## Security

- **No AI keys in frontend JS.** All AI calls go through `/api/ai/*` Worker routes; keys live as Cloudflare secrets (set via `wrangler secret put`).
- **Auth required.** Every `/api/*` route (except `/api/auth/login` and `/api/health`) requires a valid JWT in an httpOnly cookie.
- **httpOnly cookie.** The session token is never readable by client JavaScript.
- **`.env` / secrets never committed.** The repo's `.gitignore` excludes `.env*`; Cloudflare secrets are stored server-side only.

---

## Project structure

```
cf-app/
  wrangler.toml              # Worker config: D1 binding, AI binding, assets, vars
  migrations/0001_init.sql   # leads + users + import_log schema + 25 seed leads
  src/                       # Hono Worker backend
    index.ts                 # app entry, auth middleware, route mounting, SPA fallback
    routes/                  # leads, ai, auth, import
    lib/                     # ai (multi-provider), auth (JWT), pipeline, query-engine, prompts, types, csv
  frontend/                  # Vite + React frontend
    src/
      App.tsx                # auth gating + data fetch
      main.tsx
      components/biai/       # login, app-shell, dashboard, pipeline-table, lead-detail, data-quality, ai-analyst, import-screen
      components/ui/         # shadcn/ui components
      lib/                   # api client, types, utils
```

The pure domain logic (`pipeline.ts`, `query-engine.ts`, `prompts.ts`, `csv.ts`, `types.ts`) is framework-agnostic and shared between the Worker and (conceptually) the Next.js reference app in the repo root.

---

## Local testing

```bash
# Worker typecheck
bun run typecheck

# Frontend build
cd frontend && bun run build

# Unit tests (domain logic — run from the repo root Next.js project)
cd .. && bun test tests/pipeline.test.ts   # 37 tests, 73 assertions
```

---

## Deployed verification (run against the live URL)

```bash
URL="https://biai-corporate-intelligence.imriad.workers.dev"
curl -s "$URL/api/health"                                   # → {"status":"ok",…}
curl -s -c c.txt -X POST "$URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"biai-demo-2026"}'      # → {"user":{…}}
curl -s -b c.txt "$URL/api/leads/audit" | jq '.audit.totalRecords, .audit.totalPipelineValueActive'
# → 25, 3920000
curl -s -b c.txt -X POST "$URL/api/ai/email" \
  -H "Content-Type: application/json" -d '{"leadId":"L04"}'  # → {subject, body, gmailUrl, …}
```

---

## Known limitations

- **Credential-only login** (no signup) — by design for the demo; the `users` table supports adding more users/roles for growth.
- **Password hashing is SHA-256** (Web Crypto). Acceptable for a single demo credential over HTTPS; upgrade to bcrypt/argon2 (via a Worker-compatible library) before real multi-user use.
- **Reference date is fixed** at 2026-11-01 (per the BIAI brief) so overdue calculations are reproducible. For a live deployment, swap `REFERENCE_DATE` in `src/lib/types.ts` for `new Date().toISOString().slice(0,10)`.
- **Z.ai account has no balance** — the supplied key is stored as a fallback but Workers AI is the active provider.
- **Merge is a review note** — the duplicate merge workflow records keep/dismiss in UI state; a persisted merge log is the natural next step (the `import_log` pattern shows how).

---

## License & data

All companies, people, emails and phone numbers in the seed data are fictional sample data supplied by BIAI for the challenge. No real customer data is used.
