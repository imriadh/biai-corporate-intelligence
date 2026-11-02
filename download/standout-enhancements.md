# How to stand out from other candidates — enhancement roadmap

Your Cloudflare deployment already checks every mandatory box plus several optional ones (login, Gmail send, CSV import, D1 persistence, multi-provider AI). Here's a prioritized list of enhancements that would make a BIAI evaluator remember your submission, grouped by impact.

---

## Tier 1 — high impact, low effort (do these first)

### 1. AI weekly "chase-first" summary (optional Priority 2 in the brief)
Add a button on the Dashboard: "Generate this week's chase plan". The Worker sends the overdue + soon-due leads to Workers AI and returns a prioritized, plain-English action list ("Start with Meghna Pharma — proposal sitting since Oct 27, budget decision this week. Then Mou Telecom…"). This directly answers the brief's optional feature and shows AI doing something a spreadsheet can't.

### 2. Stage-update from the UI (optional Priority 1)
You already have `PATCH /api/leads/:id` wired. Add a small "Update stage" dropdown on the Lead Details screen that calls it. One-line demo: drag L10 from Meeting → Proposal. Shows the pipeline is live, not read-only.

### 3. CSV export of cleaned data (optional Priority 1)
A "Export cleaned CSV" button that downloads the normalized dataset (with duplicate flags + missing-field annotations as extra columns). The pipeline already produces this — it's a 20-line endpoint. Evaluators love "round-trip" demos: messy CSV in → clean CSV out.

### 4. Reference date = today (for live feel)
Swap `REFERENCE_DATE = "2026-11-01"` for `new Date().toISOString().slice(0,10)` in `src/lib/types.ts`. Now overdue updates live as days pass — the app feels real, not frozen. Keep the fixed date only for the audit report reproducibility.

---

## Tier 2 — differentiators that show product thinking

### 5. Follow-up reminders via Cloudflare Cron Triggers
Add a `[triggers] crons = ["0 9 * * 1"]` to `wrangler.toml` — every Monday 9am, the Worker runs a scheduled handler that queries D1 for overdue + soon-due leads and... (next step: email you a digest, or write a summary row to D1). This shows you understand serverless scheduling — most candidates won't do this.

### 6. Lead score / "stuck deal" detector
Add a computed `stuckScore` to each lead: days since last contact × deal value × stage-weight. Highlight the top 3 "stuck but valuable" deals on the dashboard with a distinct badge. This answers "which deal is stuck" from the brief in a way a manager instantly gets.

### 7. Email-template library
Let the user pick a tone (gentle re-engage / firm nudge / invoice payment check / proposal follow-up) before generating. The system prompt already adapts to stage; adding an explicit tone selector makes the AI feel controllable, not magic.

### 8. Audit trail for edits
Every `PATCH /api/leads/:id` writes a row to an `audit_log` table (who, what field, old value, new value, when). The Data Quality Center gets an "Audit" tab. Shows you take data governance seriously — important for a B2B sales tool.

---

## Tier 3 — polish that makes it feel finished

### 9. Keyboard shortcuts + command palette
`Cmd+K` opens a command palette (use `cmdk`, already in the stack) — quick search, jump to lead, ask the AI analyst. This is the kind of detail that makes a tool feel like Linear or Notion.

### 10. Dark mode
You already have the CSS variables structured for it. Add a theme toggle in the top bar. Small effort, big perceived polish.

### 11. Mobile-responsive pipeline as a kanban
On narrow screens, switch the table to a horizontal-swipe kanban (one column per stage). BIAI managers check their phone — a mobile-friendly pipeline is a real selling point.

### 12. Multi-user + roles (when you're ready to grow)
The `users` table already has a `role` column. Add an admin screen to create users, gate the Import screen to `role=admin`, and show a per-owner filter default. This is the "flexibility for growth" the brief hints at.

---

## What NOT to add (time traps)

- Real email sending (SMTP/Mailgun) — the Gmail compose button already solves the "send" UX without deliverability headaches.
- WhatsApp integration — out of scope, and the brief explicitly says skip it.
- Payment integration — not relevant to a sales-pipeline tool.
- Complex RBAC / orgs / teams — the single-user demo is enough; multi-user is Tier 3.

---

## My recommendation for the remaining time

If you have a few hours: do **#1 (chase plan)**, **#2 (stage update)**, and **#4 (live reference date)**. Those three take the demo from "complete" to "wow" with minimal code, and all three are explicitly mentioned in the brief.

For the Loom: spend 30 seconds on each — "here's the AI chase plan for this week", "I can update a stage live", "overdue recalculates against today". That's the story that beats a generic dashboard.
