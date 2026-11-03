# BIAI Submission — What to Send (4 deliverables)

Exactly what to submit for the BIAI AI Intern Round 2 task. Each item is ready.

---

## 1. Loom video (≤ 5 minutes) — 20% of score

**Full script + recording tips:** see `loom-script-final.md`

**TL;DR for recording:**
- ~5:00, screen + your face for intro/outro
- Flow: landing → one-click login → dashboard → AI email → Send via Gmail → data quality (duplicates + date error) → AI analyst (2 questions) → chase plan → CSV export
- Pre-warm: generate one email before recording so the on-camera one is fast
- Open Gmail in a background tab first so the "Send via Gmail" click lands instantly

**What evaluators want to see:** the problem in one sentence, the app working on the 25 sample leads, the AI genuinely helping (not a bolted-on chatbot), and you confidently explaining your choices.

---

## 2. Working demo link

```
https://biai-corporate-intelligence.imriad.workers.dev
```

- Landing page at `/` — share this as the primary link
- App at `/app` — the "Open the app" button takes them there
- Login: `admin` / `biai-demo-2026` (one-click button, no typing needed)
- All features work on the real 25 BIAI leads, persisted in Cloudflare D1

---

## 3. Your work (the code)

```
https://github.com/imriadh/biai-corporate-intelligence
```

- Private repo — add `support@biai.com.bd` as a collaborator if they ask, or make it public for the submission
- **Cloudflare app:** `cf-app/` — Hono Worker (`src/`) + Vite React frontend (`frontend/`) + D1 migrations (`migrations/`) + `wrangler.toml`
- **Original Next.js reference app:** repo root (`src/`, `tests/`, `data/raw/`) — same domain logic, 37 unit tests
- **Data audit:** `download/data-audit-report.md` + `scripts/audit.py` (independent Python audit)
- **No secrets committed** — `.env` is gitignored, AI keys are Cloudflare secrets
- `README.md` at root + `cf-app/README.md` have full setup + deployment instructions

**Files to point them at if they want to verify:**
- `cf-app/src/lib/pipeline.ts` — the data engine (normalization, duplicate detection, date validation, overdue)
- `cf-app/src/routes/ai.ts` — the AI email + NL query + chase-plan endpoints
- `tests/pipeline.test.ts` — 37 unit tests (73 assertions)
- `download/data-audit-report.md` — the full audit of all 25 leads

---

## 4. Short note (half page)

**Ready to paste:** see `submission-short-note.md`

It covers exactly what the brief asks:
- What was built (6 screens, Cloudflare stack, all 25 leads loaded)
- Which AI tools were used and how (Claude for scaffolding, Cloudflare Workers AI for runtime, Z.ai key stored but no balance)
- How AI is integrated (email drafting + two-layer NL query — deterministic for common, AI-assisted structured spec for flexible)
- How data validation works (single pipeline, additive normalization, preserves raw values, cross-checked against Python audit)
- What does not work yet (merge not persisted, SHA-256 hashing, Z.ai no balance, fixed reference date)
- What to fix next (persist merge, cron digest, bcrypt, live reference date, mobile kanban)

---

## How the 25 leads were flagged (the "show us" requirement)

| Flag | Count | Leads |
|---|---|---|
| Exact duplicate | 1 pair | L01 & L23 (Padma Textiles Ltd) |
| Potential duplicate | 1 pair | L02 & L03 (Meghna Pharma — same contact, different name) |
| Missing contact details | 2 records | L06 (phone), L24 (name + role + email) |
| Date-order violation | 1 record | L25 (follow-up before last contact) |
| Overdue follow-up | 9 records | L04, L06, L10, L13, L15, L19, L20, L22, L25 |
| **Total flagged** | **15 of 25** | verified by 37 unit tests + independent Python audit |

---

## Quick performance note (if asked)

- AI email generation: ~1-2 seconds (Llama 3.1 8B on Workers AI free tier)
- Deterministic NL queries: ~0.3 seconds (no AI — exact math)
- Gmail compose opens: instant (pre-filled URL opens in a new tab)
- All data persisted in Cloudflare D1 — survives redeployment
